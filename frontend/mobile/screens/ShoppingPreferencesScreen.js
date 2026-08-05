import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ScreenLayout from '../components/ScreenLayout';
import { COLORS, FONTS } from '../theme';

const PREFS = [
  ['Budget', '₹8,500 / month'],
  ['Preferred Stores', 'Reliance Fresh, D-Mart'],
  ['Household Size', '3'],
  ['Shopping Frequency', 'Weekly'],
  ['City', 'Bengaluru'],
];

export default function ShoppingPreferencesScreen({ navigation }) {
  return (
    <ScreenLayout title="Shopping Preferences" navigation={navigation} showBack>
      <View style={styles.content}>
        {PREFS.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
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
  row: {
    marginBottom: 18,
  },
  label: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
    letterSpacing: 1,
    marginBottom: 6,
  },
  value: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.primary,
    lineHeight: 22,
  },
});
