import { Platform } from 'react-native';
import { API_BASE_URL } from './apiConfig';
import { saveAuthData } from './authStorage';
import { showNotification } from './alertHelper';

/**
 * Handle OAuth (Google / Apple) sign in & sign up flow
 */
export async function performOAuthLogin({ provider = 'google', email, name, navigation, isSignUp = false, onSuccess, onError }) {
  try {
    console.log(`[OAuth] Initiating ${provider} ${isSignUp ? 'Sign Up' : 'Sign In'}...`);
    
    // Default profile for quick OAuth sign-in / demo if not filled
    const oauthEmail = email || (provider === 'google' ? 'google.user@pantrix.app' : 'apple.user@pantrix.app');
    const oauthName = name || (provider === 'google' ? 'Google User' : 'Apple User');

    const response = await fetch(`${API_BASE_URL}/auth/oauth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        email: oauthEmail.trim().toLowerCase(),
        name: oauthName.trim(),
        provider_id: `${provider}_${Date.now()}`
      }),
    });

    const data = await response.json();
    console.log(`[OAuth] Response:`, data);

    if (response.ok && data.access_token) {
      await saveAuthData({
        user: data.user,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

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
      const errorMsg = data.detail || `Failed to sign up with ${provider}.`;
      console.warn(`[OAuth] Authentication failed:`, errorMsg);
      if (onError) onError(errorMsg);
      else showNotification('Authentication Failed', errorMsg);
      return null;
    }
  } catch (err) {
    console.error(`[OAuth] ${provider} error:`, err);
    const errorMsg = 'Could not connect to authentication server. Please check your connection.';
    if (onError) onError(errorMsg);
    else showNotification('Network Error', errorMsg);
    return null;
  }
}
