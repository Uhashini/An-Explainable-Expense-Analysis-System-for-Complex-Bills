import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_KEY = 'PANTRIX_USER';

export async function saveUser(user) {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    return true;
  } catch (error) {
    console.error('Failed to save user', error);
    return false;
  }
}

export async function getUser() {
  try {
    const json = await AsyncStorage.getItem(USER_KEY);
    return json ? JSON.parse(json) : null;
  } catch (error) {
    console.error('Failed to load user', error);
    return null;
  }
}

export async function clearUser() {
  try {
    await AsyncStorage.removeItem(USER_KEY);
    return true;
  } catch (error) {
    console.error('Failed to clear user', error);
    return false;
  }
}
