import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import ScreenLayout from '../components/ScreenLayout';
import { COLORS, FONTS } from '../theme';

const FIELDS = [
  ['Full Name', 'Vyshnavi'],
  ['Age', '29'],
  ['Gender', 'Female'],
  ['Height', '165 cm'],
  ['Weight', '62 kg'],
];

export default function PersonalInformationScreen({ navigation }) {
  return (
    <ScreenLayout title="Personal Information" navigation={navigation} showBack>
      <View style={styles.content}>
        {FIELDS.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}

        <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Edit Information</Text>
        </TouchableOpacity>
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
    color: COLORS.primary,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 6,
  },
  value: {
    fontFamily: FONTS.regular,
    color: COLORS.primary,
    fontSize: 16,
    lineHeight: 22,
  },
  button: {
    marginTop: 30,
    backgroundColor: COLORS.primary,
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.surface,
  },
});
