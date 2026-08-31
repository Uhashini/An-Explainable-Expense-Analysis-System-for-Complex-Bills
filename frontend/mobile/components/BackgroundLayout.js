import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STRIPE_SIZE = 24;
const STRIPE_COUNT = 75;

export default function BackgroundLayout({ children }) {
  return (
    <View style={styles.root}>
      {/* Gingham Background: white base */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#ffffff' }]} />

      {/* Vertical Stripes */}
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', overflow: 'hidden' }]}>
        {Array.from({ length: STRIPE_COUNT }).map((_, i) => (
          <React.Fragment key={`v-${i}`}>
            <View style={{ width: STRIPE_SIZE, height: '100%', backgroundColor: 'rgba(100, 170, 220, 0.35)' }} />
            <View style={{ width: STRIPE_SIZE, height: '100%', backgroundColor: 'transparent' }} />
          </React.Fragment>
        ))}
      </View>

      {/* Horizontal Stripes - creates crosshatch gingham effect */}
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'column', overflow: 'hidden' }]}>
        {Array.from({ length: STRIPE_COUNT }).map((_, i) => (
          <React.Fragment key={`h-${i}`}>
            <View style={{ width: '100%', height: STRIPE_SIZE, backgroundColor: 'rgba(100, 170, 220, 0.35)' }} />
            <View style={{ width: '100%', height: STRIPE_SIZE, backgroundColor: 'transparent' }} />
          </React.Fragment>
        ))}
      </View>

      {/* Card */}
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.contentContainer}>
          <View style={styles.card}>
            {children}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    ...(Platform.OS === 'web' ? { minHeight: '100vh', minWidth: '100vw' } : {}),
  },
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fcfbf7',
    width: '100%',
    maxWidth: 420,
    minHeight: 580,
    maxHeight: 860,
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#b24c4c',
    paddingHorizontal: 28,
    paddingVertical: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
});
