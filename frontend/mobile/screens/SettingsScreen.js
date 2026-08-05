import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import ScreenLayout from '../components/ScreenLayout';
import { COLORS, FONTS } from '../theme';

const OPTIONS = [
  'Notifications',
  'Privacy',
  'Language',
  'Help & Support',
  'Logout',
];

export default function SettingsScreen({ navigation }) {
  return (
    <ScreenLayout title="Settings" navigation={navigation} showBack>
      <View style={styles.content}>
        {OPTIONS.map((item) => (
          <TouchableOpacity key={item} style={styles.option} activeOpacity={0.8}>
            <Text style={styles.optionText}>{item}</Text>
            <Text style={styles.optionArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 20,
    backgroundColor: COLORS.background,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.secondary,
  },
  optionText: {
    fontFamily: FONTS.regular,
    color: COLORS.primary,
    fontSize: 15,
  },
  optionArrow: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.primary,
  },
});
