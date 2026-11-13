import { Platform } from 'react-native';
import { API_BASE_URL, fetchWithTimeout } from './apiConfig';
import { saveAuthData, saveGoogleAccount } from './authStorage';
import { showNotification } from './alertHelper';
import { promptGoogleSignIn, getGoogleClientId } from './googleAuth';

export { promptGoogleSignIn, getGoogleClientId };

function formatDefaultName(emailStr, provider) {
  if (!emailStr) return `${provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'Google'} User`;
  const username = emailStr.split('@')[0].replace(/[._-]/g, ' ');
  return username.charAt(0).toUpperCase() + username.slice(1);
}

/**
 * Handle OAuth sign in & sign up flow
 */
export async function performOAuthLogin({
  provider = 'google',
  email,
  name,
  idToken,
  accessToken,
  navigation,
  isSignUp = false,
  onSuccess,
  onError,
}) {
  // If provider is Google and no token/email was passed, initiate real Google OAuth
  if (provider === 'google' && !idToken && !accessToken && (!email || !email.trim())) {
    return promptGoogleSignIn({
      navigation,
      isSignUp,
      onSuccess,
      onError: (err) => {
        if (onError) onError(err);
        else showNotification('Google Sign-In', err);
      },
    });
  }

  try {
    const cleanEmail = email ? email.trim().toLowerCase() : null;
    const cleanName = name ? name.trim() : formatDefaultName(cleanEmail, provider);

    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/oauth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        email: cleanEmail,
        name: cleanName,
        id_token: idToken || null,
        access_token: accessToken || null,
        provider_id: `${provider}_${Date.now()}`,
      }),
    }, 8000);

    const data = await response.json();

    if (response.ok && data.access_token) {
      await saveAuthData({
        user: data.user,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (provider === 'google') {
        await saveGoogleAccount(data.user);
      }

      if (onSuccess) {
        onSuccess(data);
      } else if (navigation) {
        if ((data.is_new_user || isSignUp) && navigation.replace) {
          navigation.replace('PersonalInfo', { name: data.user.name, userId: data.user.id });
        } else if (navigation.replace) {
          navigation.replace('Main');
        } else if (navigation.navigate) {
          navigation.navigate('Main');
        }
      }
      return data;
    } else {
      const errorMsg = data.detail || `Failed to authenticate with ${provider}.`;
      if (onError) onError(errorMsg);
      else showNotification('Authentication Failed', errorMsg);
      return null;
    }
  } catch (err) {
    const isTimeout = err?.message && err.message.includes('timed out');
    const errorMsg = isTimeout
      ? 'Connection timed out. Please ensure the backend server is running on port 8000 and your phone is on the same Wi-Fi.'
      : (err?.message || 'Could not connect to authentication server. Please check your network connection.');
    if (onError) onError(errorMsg);
    else showNotification('Connection Error', errorMsg);
    return null;
  }
}
