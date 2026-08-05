import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ScreenLayout from '../components/ScreenLayout';
import { COLORS, FONTS } from '../theme';

const DETAILS = [
  ['Activity Level', 'Moderately Active'],
  ['Diet Preference', 'Non-Vegetarian'],
  ['Allergies', 'None'],
  ['Medical Conditions', 'None'],
];

export default function HealthProfileScreen({ navigation }) {
  return (
    <ScreenLayout title="Health Profile" navigation={navigation} showBack>
      <View style={styles.content}>
        <Text style={styles.description}>
          Your health profile helps tailor recommendations for food, goals, and spending.
        </Text>

        {DETAILS.map(([label, value]) => (
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
  description: {
    fontFamily: FONTS.regular,
    color: COLORS.mutedText,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
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
