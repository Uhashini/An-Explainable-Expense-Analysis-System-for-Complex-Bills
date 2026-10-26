import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '../theme';

export default function SocialButton({ provider, actionText, onPress, loading = false }) {
  const isGoogle = provider === 'google';
  const defaultLabel = `Continue with ${isGoogle ? 'Google' : 'Apple'}`;

  return (
    <TouchableOpacity
      style={[styles.button, loading && styles.buttonDisabled]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      <View style={[styles.iconBox, isGoogle && styles.googleIconBox]}>
        {loading ? (
          <ActivityIndicator size="small" color={isGoogle ? '#4285F4' : '#000'} />
        ) : (
          <Text style={[styles.icon, isGoogle ? styles.googleIcon : styles.appleIcon]}>
            {isGoogle ? 'G' : ''}
          </Text>
        )}
      </View>
      <Text style={styles.label}>
        {actionText || defaultLabel}
      </Text>
      <View style={styles.spacer} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 16,
    marginBottom: 10,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconBox: {
    backgroundColor: '#F8F9FA',
  },
  icon: {
    fontSize: 16,
    fontWeight: '800',
  },
  googleIcon: {
    color: '#4285F4',
    fontFamily: FONTS.bold,
  },
  appleIcon: {
    color: '#000000',
    fontSize: 18,
    marginTop: -2,
  },
  label: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#3C4043',
  },
  spacer: {
    width: 28,
  },
});
