import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import BackgroundLayout from '../components/BackgroundLayout';
import ProgressBar from '../components/ProgressBar';
import CustomDropdown from '../components/CustomDropdown';
import { COLORS, FONTS } from '../theme';

const GENDER_OPTIONS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];
const ACTIVITY_OPTIONS = ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'];

export default function PersonalInfoScreen({ navigation }) {
  const [age, setAge]               = useState('');
  const [gender, setGender]         = useState('');
  const [height, setHeight]         = useState('');
  const [weight, setWeight]         = useState('');
  const [activity, setActivity]     = useState('');

  const canContinue = age && gender && height && weight && activity;

  return (
    <BackgroundLayout>
      <KeyboardAvoidingView
        style={{ flex: 1, width: '100%' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Progress */}
          <View style={styles.progressWrapper}>
            <ProgressBar step={1} total={5} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>PANTRIX</Text>
            <Text style={styles.title}>Tell Us About Yourself</Text>
            <Text style={styles.subtitle}>Help us personalize your health and spending insights.</Text>
          </View>

          <View style={styles.sectionDivider} />

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {/* Age */}
            <Text style={styles.label}>AGE</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your age"
              placeholderTextColor={COLORS.placeholder}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
            />

            {/* Gender */}
            <CustomDropdown
              label="GENDER"
              options={GENDER_OPTIONS}
              value={gender}
              onChange={setGender}
              placeholder="Select gender"
            />

            {/* Height */}
            <Text style={styles.label}>HEIGHT</Text>
            <TextInput
              style={styles.input}
              placeholder="Height in cm"
              placeholderTextColor={COLORS.placeholder}
              value={height}
              onChangeText={setHeight}
              keyboardType="decimal-pad"
            />

            {/* Weight */}
            <Text style={styles.label}>WEIGHT</Text>
            <TextInput
              style={styles.input}
              placeholder="Weight in kg"
              placeholderTextColor={COLORS.placeholder}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />

            {/* Activity Level */}
            <CustomDropdown
              label="ACTIVITY LEVEL"
              options={ACTIVITY_OPTIONS}
              value={activity}
              onChange={setActivity}
              placeholder="Select activity level"
            />
          </View>

          {/* Privacy Note */}
          <View style={styles.noteBox}>
            <Text style={styles.noteIcon}>🔒</Text>
            <Text style={styles.noteText}>
              Your information is used only to calculate personalized nutrition insights.
            </Text>
          </View>

          {/* Next Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.primaryButton, !canContinue && styles.disabledButton]}
              onPress={() => navigation.navigate('Goals')}
              activeOpacity={0.85}
              disabled={!canContinue}
            >
              <Text style={styles.primaryButtonText}>NEXT  →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </BackgroundLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 32,
  },
  progressWrapper: {
    width: '100%',
    marginTop: 16,
    marginBottom: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 4,
  },
  logo: {
    fontFamily: FONTS.bold,
    fontSize: 30,
    color: COLORS.primary,
    letterSpacing: 5,
    marginBottom: 10,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.primary,
    letterSpacing: 0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FONTS.regular,
    color: COLORS.primaryLight,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  sectionDivider: {
    width: '75%',
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 18,
  },
  formContainer: {
    width: '100%',
  },
  label: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.primary,
    letterSpacing: 1.5,
    marginBottom: 7,
  },
  input: {
    width: '100%',
    backgroundColor: COLORS.primaryFaint,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.inputBorder,
    color: COLORS.inputText,
    fontFamily: FONTS.regular,
    fontSize: 15,
    paddingVertical: 11,
    marginBottom: 22,
  },
  noteBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(139, 26, 26, 0.05)',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    marginBottom: 20,
  },
  noteIcon: {
    fontSize: 14,
    marginRight: 8,
    marginTop: 1,
  },
  noteText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.primaryLight,
    lineHeight: 18,
  },
  buttonContainer: {
    width: '100%',
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#fff',
    fontFamily: FONTS.bold,
    fontSize: 14,
    letterSpacing: 2,
  },
});
