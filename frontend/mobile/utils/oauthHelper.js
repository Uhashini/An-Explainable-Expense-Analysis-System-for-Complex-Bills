import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { API_BASE_URL } from './apiConfig';
import { saveAuthData, saveGoogleAccount, getGoogleAccount } from './authStorage';
import { showNotification } from './alertHelper';

// Ensure WebBrowser finishes any existing session
try {
  WebBrowser.maybeCompleteAuthSession();
} catch (e) {
  // Ignore in environments where not supported
}

/**
 * Handle OAuth (Google / Apple) sign in & sign up flow
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
  try {
    if (!email || !email.trim()) {
      const err = 'Email address is required for Google Sign-In.';
      if (onError) onError(err);
      else showNotification('Missing Email', err);
      return null;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name && name.trim() ? name.trim() : cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    console.log(`[OAuth] Connecting ${provider} account: ${cleanEmail}`);

    const response = await fetch(`${API_BASE_URL}/auth/oauth/login`, {
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
    });

    const data = await response.json();
    console.log(`[OAuth] Backend response:`, data);

    if (response.ok && data.access_token) {
      // 1. Save JWT auth credentials
      await saveAuthData({
        user: data.user,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      // 2. Remember linked Google account for 1-tap reconnect
      if (provider === 'google') {
        await saveGoogleAccount({
          email: data.user.email,
          name: data.user.name,
        });
      }

      // 3. Callback or Navigation
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
      console.warn(`[OAuth] Authentication error:`, errorMsg);
      if (onError) onError(errorMsg);
      else showNotification('Authentication Failed', errorMsg);
      return null;
    }
  } catch (err) {
    console.error(`[OAuth] Server connection error:`, err);
    const errorMsg = 'Could not connect to the authentication server. Please check your network connection.';
    if (onError) onError(errorMsg);
    else showNotification('Network Error', errorMsg);
    return null;
  }
}

/**
 * Launch WebBrowser Google OAuth if a Google Client ID is configured.
 * Falls back gracefully to the Google Account Connect flow if client ID is missing.
 */
export async function launchGoogleOAuthWebSession({ navigation, isSignUp = false, onFallback }) {
  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    // If no Google Client ID configured, invoke fallback account connection
    if (onFallback) onFallback();
    return;
  }

  try {
    const redirectUrl = Linking.createURL('oauth');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(googleClientId)}&response_type=token&scope=${encodeURIComponent('openid profile email')}&redirect_uri=${encodeURIComponent(redirectUrl)}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

    if (result.type === 'success' && result.url) {
      // Parse token from hash fragment or query string
      const url = result.url;
      const hashParams = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
      const token = hashParams.get('access_token');
      const idToken = hashParams.get('id_token');

      if (token) {
        // Fetch user info from Google
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (userInfoRes.ok) {
          const profile = await userInfoRes.json();
          await performOAuthLogin({
            provider: 'google',
            email: profile.email,
            name: profile.name,
            idToken,
            accessToken: token,
            navigation,
            isSignUp,
          });
          return;
        }
      }
    }
  } catch (err) {
    console.warn('[OAuth] WebBrowser Google flow error, falling back to connect modal:', err);
    if (onFallback) onFallback();
  }
}
