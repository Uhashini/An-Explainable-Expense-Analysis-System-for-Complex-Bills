import { Platform } from 'react-native';

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
