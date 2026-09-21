import { Platform } from 'react-native';
import { getToken, getRefreshToken, saveAuthData, clearUser } from './authStorage';

// ─── Backend API Configuration ──────────────────────────────────────────────
//
// Automatically picks the right URL based on environment:
//   - Expo Web (browser)          → 10.12.117.176
//   - Android Emulator            → 10.0.2.2
//   - Physical device (same WiFi) → your machine's LAN IP
//
const HOST_IP = '10.12.117.176'; // Your LAN IP — run `ipconfig` to verify

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? Platform.select({
  web: `http://127.0.0.1:8000/api/v1`, // Use 127.0.0.1 instead of localhost to prevent IPv6 hanging on Windows
  android: 'http://10.0.2.2:8000/api/v1',
  ios: `http://${HOST_IP}:8000/api/v1`,
  default: `http://${HOST_IP}:8000/api/v1`,
});

/**
 * Get headers including Authorization Bearer token if present
 */
export async function getAuthHeaders(extraHeaders = {}) {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Perform an authenticated HTTP fetch with automatic Bearer token injection
 * and transparent JWT token refresh retry on 401 Unauthorized responses.
 */
export async function authFetch(url, options = {}) {
  let token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const endpointUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  let response = await fetch(endpointUrl, {
    ...options,
    headers,
  });

  // If token expired (401), attempt refresh and retry once
  if (response.status === 401 && token) {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.access_token) {
            await saveAuthData({ access_token: refreshData.access_token });
            headers['Authorization'] = `Bearer ${refreshData.access_token}`;
            response = await fetch(endpointUrl, {
              ...options,
              headers,
            });
          }
        } else {
          // Refresh token also invalid/expired -> clear state
          await clearUser();
        }
      } catch (err) {
        console.warn('Silent token refresh failed:', err);
      }
    }
  }

  return response;
}
