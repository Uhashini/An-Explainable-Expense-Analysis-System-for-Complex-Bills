import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_KEY = 'PANTRIX_USER';
const ACCESS_TOKEN_KEY = 'PANTRIX_ACCESS_TOKEN';
const REFRESH_TOKEN_KEY = 'PANTRIX_REFRESH_TOKEN';

/**
 * Save complete auth payload (user, access_token, refresh_token)
 */
export async function saveAuthData({ access_token, refresh_token, user }) {
  try {
    const pairs = [];
    if (user) pairs.push([USER_KEY, JSON.stringify(user)]);
    if (access_token) pairs.push([ACCESS_TOKEN_KEY, access_token]);
    if (refresh_token) pairs.push([REFRESH_TOKEN_KEY, refresh_token]);
    
    if (pairs.length > 0) {
      await AsyncStorage.multiSet(pairs);
    }
    return true;
  } catch (error) {
    console.error('Failed to save auth data', error);
    return false;
  }
}

/**
 * Backward-compatible helper for saving user info and optional tokens
 */
export async function saveUser(user, accessToken = null, refreshToken = null) {
  try {
    const pairs = [[USER_KEY, JSON.stringify(user)]];
    if (accessToken) pairs.push([ACCESS_TOKEN_KEY, accessToken]);
    if (refreshToken) pairs.push([REFRESH_TOKEN_KEY, refreshToken]);
    await AsyncStorage.multiSet(pairs);
    return true;
  } catch (error) {
    console.error('Failed to save user', error);
    return false;
  }
}

/**
 * Get current stored user profile info
 */
export async function getUser() {
  try {
    const json = await AsyncStorage.getItem(USER_KEY);
    return json ? JSON.parse(json) : null;
  } catch (error) {
    console.error('Failed to load user', error);
    return null;
  }
}

/**
 * Get the active JWT access token
 */
export async function getToken() {
  try {
    return await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to load access token', error);
    return null;
  }
}

export const getAccessToken = getToken;

/**
 * Get the stored JWT refresh token
 */
export async function getRefreshToken() {
  try {
    return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to load refresh token', error);
    return null;
  }
}

/**
 * Clear all authentication and user data from device storage
 */
export async function clearUser() {
  try {
    await AsyncStorage.multiRemove([USER_KEY, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
    return true;
  } catch (error) {
    console.error('Failed to clear auth state', error);
    return false;
  }
}

export const clearAuth = clearUser;
