import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { API_BASE_URL } from './apiConfig';
import { saveAuthData, saveGoogleAccount } from './authStorage';

// ─────────────────────────────────────────────────────────────────────────────
// 1. WEB POPUP CALLBACK RECEIVER (Immediate Module-Level Execution)
// ─────────────────────────────────────────────────────────────────────────────
// When Google OAuth redirects the popup back to http://localhost:8081/#access_token=...:
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    const isPopupChild = !!(window.opener && window.opener !== window);
    const rawHashOrSearch = window.location.hash || window.location.search || '';

    if (
      rawHashOrSearch.includes('access_token') ||
      rawHashOrSearch.includes('id_token') ||
      rawHashOrSearch.includes('error=')
    ) {
      const clean = rawHashOrSearch.replace(/^[#?]/, '');
      const params = new URLSearchParams(clean);
      const accessToken = params.get('access_token');
      const idToken = params.get('id_token');
      const authError = params.get('error');

      // 1. Post tokens directly to the opener parent window
      if (isPopupChild) {
        try {
          window.opener.postMessage(
            {
              type: 'PANTRICS_GOOGLE_AUTH_CALLBACK',
              accessToken,
              idToken,
              authError,
              url: window.location.href,
            },
            '*'
          );
        } catch (e) {}
      }

      // 2. Store in localStorage for cross-window polling / storage event fallback
      try {
        window.localStorage.setItem(
          'PANTRICS_GOOGLE_AUTH_RESULT',
          JSON.stringify({
            accessToken,
            idToken,
            authError,
            time: Date.now(),
          })
        );
      } catch (e) {}

      // 3. Immediately close this popup window so user is returned to parent window
      if (isPopupChild) {
        try {
          window.close();
        } catch (e) {}
      }
    }
  } catch (err) {
    // Suppress popup receiver detection errors
  }
}

// Complete any pending in-app browser auth session for native WebBrowser
try {
  WebBrowser.maybeCompleteAuthSession();
} catch (e) {
  // Ignore in environments where not supported
}

/**
 * Safely extracts and normalizes a Google Client ID string from any candidate value.
 * Strictly prevents "[object Object]", "undefined", "null", and TypeError on non-strings.
 */
function sanitizeClientId(candidate) {
  if (!candidate) return '';
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    if (
      !trimmed ||
      trimmed === '[object Object]' ||
      trimmed === 'undefined' ||
      trimmed === 'null' ||
      trimmed.includes('your-google-client-id')
    ) {
      return '';
    }
    // Strip wrapping quotes if present (e.g. "xxx" or 'xxx')
    return trimmed.replace(/^["']|["'];?$/g, '').trim();
  }
  if (typeof candidate === 'object' && candidate !== null) {
    if (typeof candidate.web === 'string') return sanitizeClientId(candidate.web);
    if (typeof candidate.clientId === 'string') return sanitizeClientId(candidate.clientId);
    if (typeof candidate.client_id === 'string') return sanitizeClientId(candidate.client_id);
  }
  return '';
}

/**
 * Safe diagnostic logger: reports ONLY boolean presence and length metadata.
 * NEVER logs or exposes the complete Client ID or secrets.
 */
function logSafeDiagnostic(resolvedId, resolvedSource) {
  try {
    const directEnv = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    const isEnvSet = typeof directEnv === 'string' && directEnv.trim().length > 0;
    const isResolved = typeof resolvedId === 'string' && resolvedId.trim().length > 0;
    const extraVal = Constants?.expoConfig?.extra?.googleClientId;
    const isExtraSet = typeof extraVal === 'string' && extraVal.trim().length > 0;

    console.log('[Pantrics GoogleAuth Diagnostic]', {
      platform: Platform.OS,
      hasDirectEnvString: isEnvSet,
      envStringLength: isEnvSet ? directEnv.trim().length : 0,
      hasConfigExtraString: isExtraSet,
      configExtraLength: isExtraSet ? extraVal.trim().length : 0,
      isResolvedNonEmptyString: isResolved,
      resolvedLength: isResolved ? resolvedId.length : 0,
      resolvedSource: isResolved ? resolvedSource : 'none',
    });
  } catch (diagErr) {
    // Diagnostic error must never block authentication
  }
}

const DEFAULT_GOOGLE_CLIENT_ID = '1041758891518-egk6ur8n7nq13plvjh8hej95f97lblhf.apps.googleusercontent.com';

/**
 * Retrieve the Google OAuth Client ID across all supported configuration paths:
 * 1. Metro compile-time inlined direct expression: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
 * 2. Expo app.json / app.config.js extra configuration: Constants.expoConfig?.extra?.googleClientId
 * 3. Manifest fallbacks: Constants.manifest?.extra?.googleClientId
 * 4. Web runtime fallbacks: window.EXPO_PUBLIC_GOOGLE_CLIENT_ID / localStorage / sessionStorage
 * 5. Default built-in Client ID
 */
export function getGoogleClientId() {
  let resolvedId = '';
  let resolvedSource = 'none';

  // 1. Direct literal expression for Metro compile-time inlining
  const envVal = sanitizeClientId(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID);
  if (envVal) {
    resolvedId = envVal;
    resolvedSource = 'process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID';
  }

  // 2. Expo app.json extra configuration (Constants.expoConfig.extra.googleClientId)
  if (!resolvedId) {
    const configExtra = sanitizeClientId(Constants?.expoConfig?.extra?.googleClientId);
    if (configExtra) {
      resolvedId = configExtra;
      resolvedSource = 'Constants.expoConfig.extra.googleClientId';
    }
  }

  // 3. Manifest fallbacks (legacy / bare workflow)
  if (!resolvedId) {
    const manifestExtra = sanitizeClientId(
      Constants?.manifest?.extra?.googleClientId ||
      Constants?.manifest2?.extra?.expoClient?.extra?.googleClientId
    );
    if (manifestExtra) {
      resolvedId = manifestExtra;
      resolvedSource = 'Constants.manifest.extra.googleClientId';
    }
  }

  // 4. On Web: check window global or localStorage fallback
  if (!resolvedId && Platform.OS === 'web' && typeof window !== 'undefined') {
    const webCandidate = sanitizeClientId(
      window.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
      window.localStorage?.getItem('EXPO_PUBLIC_GOOGLE_CLIENT_ID') ||
      window.sessionStorage?.getItem('EXPO_PUBLIC_GOOGLE_CLIENT_ID')
    );
    if (webCandidate) {
      resolvedId = webCandidate;
      resolvedSource = 'window/localStorage';
    }
  }

  // 5. Default built-in fallback
  if (!resolvedId) {
    resolvedId = DEFAULT_GOOGLE_CLIENT_ID;
    resolvedSource = 'DEFAULT_GOOGLE_CLIENT_ID';
  }

  // Safe diagnostic: strictly reports presence and lengths, NEVER the client ID
  logSafeDiagnostic(resolvedId, resolvedSource);

  return resolvedId;
}

/**
 * Send Google tokens (id_token or access_token) to the backend for cryptographic
 * verification and session creation.
 */
async function sendGoogleTokenToBackend({ idToken, accessToken }) {
  const response = await fetch(`${API_BASE_URL}/auth/oauth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id_token: idToken || null,
      access_token: accessToken || null,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Google authentication failed on server.');
  }
  return data;
}

/**
 * Official Google OAuth authentication and account chooser flow (`prompt: 'select_account'`).
 * Immediately displays Google's authentic account chooser ("Choose an account to continue to Pantrix").
 * Works across Web (via centered popup with lifecycle tracking) and Mobile (via WebBrowser AuthSession).
 */
export async function promptGoogleSignIn({
  navigation,
  isSignUp = false,
  openModal,
  onStart,
  onSuccess,
  onError,
}) {
  let isDone = false;
  let safetyTimeout = null;

  const finishError = (errorMsg) => {
    if (isDone) return;
    isDone = true;
    if (safetyTimeout) clearTimeout(safetyTimeout);
    if (onError) onError(errorMsg);
  };

  if (Platform.OS !== 'web' && typeof openModal === 'function') {
    openModal();
    return;
  }

  const finishSuccess = (authData) => {
    if (isDone) return;
    isDone = true;
    if (safetyTimeout) clearTimeout(safetyTimeout);

    // 1. Call caller's onSuccess callback
    if (onSuccess) {
      try {
        onSuccess(authData);
      } catch (e) {
        console.warn('onSuccess callback error:', e);
      }
    }

    // 2. Always guarantee navigation to Dashboard or PersonalInfo if navigation is passed
    if (navigation) {
      const targetScreen = (authData.is_new_user || isSignUp) ? 'PersonalInfo' : 'Main';
      const params = targetScreen === 'PersonalInfo'
        ? { name: authData.user?.name, userId: authData.user?.id }
        : undefined;

      try {
        if (navigation.replace) {
          navigation.replace(targetScreen, params);
        } else if (navigation.navigate) {
          navigation.navigate(targetScreen, params);
        }
      } catch (navErr) {
        console.warn('Navigation error in promptGoogleSignIn:', navErr);
      }
    }
  };

  // Safety Timeout (45s): Ensures loading state never hangs indefinitely
  safetyTimeout = setTimeout(() => {
    finishError('Google Sign-In timed out. If the Google window did not appear, please allow popups for localhost:8081 and try again.');
  }, 45000);

  const clientId = getGoogleClientId();

  if (!clientId || clientId === '') {
    finishError('Google OAuth Client ID is not configured.\n\nPlease configure your Google Web Client ID by adding it to either:\n1. frontend/mobile/.env -> EXPO_PUBLIC_GOOGLE_CLIENT_ID=<your-id>\n2. frontend/mobile/app.json -> expo.extra.googleClientId\n\nThen save the file and restart Expo (npm run web -- -c).');
    return;
  }

  if (onStart) onStart();

  // ───────────────────────────────────────────────────────────────────────────
  // 1. WEB BROWSER FLOW: Official Google Account Chooser with Popup Tracking
  // ───────────────────────────────────────────────────────────────────────────
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Clear any previous auth results
    try {
      window.localStorage.removeItem('PANTRICS_GOOGLE_AUTH_RESULT');
    } catch (e) {}

    let handledTokens = false;

    const processTokens = async ({ accessToken, idToken, authError }) => {
      if (handledTokens || isDone) return;
      handledTokens = true;
      cleanup();

      if (authError) {
        if (authError === 'access_denied') {
          finishError('Google Sign-In was cancelled.');
        } else {
          finishError(`Google authorization failed: ${authError}`);
        }
        return;
      }

      if (!accessToken && !idToken) {
        finishError('No authorization credentials returned from Google.');
        return;
      }

      try {
        console.log('[Pantrics GoogleAuth] Tokens received from Google. Authenticating with backend...');
        const authData = await sendGoogleTokenToBackend({ idToken, accessToken });

        if (!authData || !authData.access_token) {
          throw new Error('Backend failed to return authentication session.');
        }

        await saveAuthData({
          user: authData.user,
          access_token: authData.access_token,
          refresh_token: authData.refresh_token,
        });
        await saveGoogleAccount(authData.user);
        console.log('[Pantrics GoogleAuth] Successfully authenticated! Navigating to dashboard...');
        finishSuccess(authData);
      } catch (backendErr) {
        console.error('[Pantrics GoogleAuth] Backend authentication error:', backendErr);
        finishError(backendErr.message || 'Authentication failed on server.');
      }
    };

    // Listener 1: window postMessage
    const messageHandler = (event) => {
      if (event.data?.type === 'PANTRICS_GOOGLE_AUTH_CALLBACK') {
        processTokens({
          accessToken: event.data.accessToken,
          idToken: event.data.idToken,
          authError: event.data.authError,
        });
      }
    };
    window.addEventListener('message', messageHandler);

    // Listener 2: localStorage storage event
    const storageHandler = (event) => {
      if (event.key === 'PANTRICS_GOOGLE_AUTH_RESULT' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          processTokens(parsed);
        } catch (e) {}
      }
    };
    window.addEventListener('storage', storageHandler);

    let popup = null;
    let pollTimer = null;

    function cleanup() {
      if (pollTimer) clearInterval(pollTimer);
      window.removeEventListener('message', messageHandler);
      window.removeEventListener('storage', storageHandler);
      try {
        if (popup && !popup.closed) popup.close();
      } catch (e) {}
    }

    try {
      const redirectUri = window.location.origin;
      const nonce = Math.random().toString(36).substring(2);
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token%20id_token&scope=${encodeURIComponent('openid email profile')}&prompt=select_account&nonce=${nonce}`;

      const width = 500;
      const height = 640;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      popup = window.open(
        authUrl,
        'GoogleSignIn',
        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
      );

      // Instantly detect popup blocker
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        cleanup();
        finishError('Google Sign-In popup was blocked by your browser. Please allow popups for localhost:8081 in your browser address bar and try again.');
        return;
      }

      // Track popup lifecycle and redirect callback
      pollTimer = setInterval(() => {
        if (handledTokens || isDone) {
          cleanup();
          return;
        }

        // Check localStorage for tokens
        try {
          const stored = window.localStorage.getItem('PANTRICS_GOOGLE_AUTH_RESULT');
          if (stored) {
            const parsed = JSON.parse(stored);
            window.localStorage.removeItem('PANTRICS_GOOGLE_AUTH_RESULT');
            processTokens(parsed);
            return;
          }
        } catch (e) {}

        // Check popup location directly if accessible
        try {
          if (popup.location && popup.location.href.includes(redirectUri)) {
            const hash = popup.location.hash || popup.location.search || '';
            if (hash.includes('access_token') || hash.includes('id_token') || hash.includes('error=')) {
              try { popup.close(); } catch (e) {}
              const params = new URLSearchParams(hash.replace(/^[#?]/, ''));
              processTokens({
                accessToken: params.get('access_token'),
                idToken: params.get('id_token'),
                authError: params.get('error'),
              });
              return;
            }
          }
        } catch (crossOriginErr) {
          // Expected while user is interacting with accounts.google.com
        }

        // Detect user closing the popup window
        if (popup.closed) {
          // Grace period: check if storage has result before declaring cancel
          setTimeout(() => {
            if (!handledTokens && !isDone) {
              try {
                const stored = window.localStorage.getItem('PANTRICS_GOOGLE_AUTH_RESULT');
                if (stored) {
                  const parsed = JSON.parse(stored);
                  window.localStorage.removeItem('PANTRICS_GOOGLE_AUTH_RESULT');
                  processTokens(parsed);
                  return;
                }
              } catch (e) {}
              cleanup();
              finishError('Google Sign-In was cancelled.');
            }
          }, 400);
          return;
        }
      }, 250);

      return;
    } catch (popupErr) {
      cleanup();
      finishError(popupErr.message || 'Could not open Google Sign-In.');
      return;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. MOBILE / EXPO NATIVE FLOW (iOS / Android)
  // ───────────────────────────────────────────────────────────────────────────
  try {
    const redirectUri = Linking.createURL('oauth');

    // Google strictly blocks custom scheme URIs (exp://) for Web client IDs with Error 400.
    // If running inside Expo Go, report a clear and actionable message instead of showing Google's error page.
    if (redirectUri.startsWith('exp:') || Constants.appOwnership === 'expo') {
      finishError('Google OAuth redirects are blocked in Expo Go because Google disallows custom exp:// schemes for Web client IDs. Please use the Google Connect Modal on mobile or test via Expo Web.');
      return;
    }

    const nonce = Math.random().toString(36).substring(2);
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token%20id_token&scope=${encodeURIComponent('openid email profile')}&prompt=select_account&nonce=${nonce}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'cancel' || result.type === 'dismiss') {
      finishError('Google Sign-In was cancelled.');
      return;
    }

    if (result.type === 'success' && result.url) {
      const url = result.url;
      const hashOrSearch = url.split('#')[1] || url.split('?')[1] || '';
      const params = new URLSearchParams(hashOrSearch);
      const accessToken = params.get('access_token');
      const idToken = params.get('id_token');

      if (!accessToken && !idToken) {
        finishError('No authorization credentials returned from Google.');
        return;
      }

      const authData = await sendGoogleTokenToBackend({ idToken, accessToken });
      await saveAuthData({
        user: authData.user,
        access_token: authData.access_token,
        refresh_token: authData.refresh_token,
      });
      await saveGoogleAccount(authData.user);
      finishSuccess(authData);
    } else {
      finishError('Google Sign-In was not completed.');
    }
  } catch (err) {
    console.error('[GoogleAuth] Native auth session error:', err);
    finishError(err.message || 'Could not connect to Google. Please try again.');
  }
}
