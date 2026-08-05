import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../theme';

export default function SocialButton({ provider, onPress }) {
  const isGoogle = provider === 'google';

  return (
    <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.iconBox}>
        <Text style={styles.icon}>{isGoogle ? 'G' : ''}</Text>
      </View>
      <Text style={styles.label}>
        Continue with {isGoogle ? 'Google' : 'Apple'}
      </Text>
      <View style={styles.spacer} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 50,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  iconBox: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4285F4',   // Google blue for G; Apple uses  which is a proper apple symbol
  },
  label: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#3a2020',
    letterSpacing: 0.5,
  },
  spacer: {
    width: 22,
  },
});
