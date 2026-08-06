import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import BackgroundLayout from '../components/BackgroundLayout';
import OrDivider from '../components/OrDivider';
import SocialButton from '../components/SocialButton';
import { saveUser } from '../utils/authStorage';
import { COLORS, FONTS } from '../theme';

const checkReq = (password) => ({
  length: password.length >= 8,
  uppercase: /[A-Z]/.test(password),
  number: /[0-9]/.test(password),
});

function Requirement({ met, label }) {
  return (
    <View style={reqStyles.row}>
      <Text style={[reqStyles.check, met && reqStyles.checkMet]}>{met ? '+' : '-'}</Text>
      <Text style={[reqStyles.text, met && reqStyles.textMet]}>{label}</Text>
    </View>
  );
}

const reqStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  check: { fontSize: 11, color: COLORS.inputBorder, marginRight: 6, fontFamily: FONTS.bold },
  checkMet: { color: '#2e7d32' },
  text: { fontSize: 11, color: COLORS.mutedText, fontFamily: FONTS.regular },
  textMet: { color: '#2e7d32' },
});

export default function SignUpScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const req = checkReq(password);
  const allReqsMet = req.length && req.uppercase && req.number;

  const handleCreateAccount = async () => {
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      Alert.alert('Missing details', 'Please fill out all registration fields.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please confirm that both passwords are identical.');
      return;
    }

    if (!allReqsMet) {
      Alert.alert('Weak password', 'Your password must be at least 8 characters long and include an uppercase letter and a number.');
      return;
    }

    const saved = await saveUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    });

    if (!saved) {
      Alert.alert('Unable to save account', 'Please try again or restart the app.');
      return;
    }

    navigation.replace('PersonalInfo');
  };

  return (
    <BackgroundLayout>
      <KeyboardAvoidingView
        style={{ flex: 1, width: '100%' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>PANTRIX</Text>
            <Text style={styles.title}>Create Your Account</Text>
            <Text style={styles.subtitle}>Let's build healthier shopping habits together.</Text>
          </View>

          <View style={styles.divider} />

          {/* Form */}
          <View style={styles.formContainer}>

            <Text style={styles.label}>FULL NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor={COLORS.placeholder}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <TextInput
              style={styles.input}
              placeholder="john@example.com"
              placeholderTextColor={COLORS.placeholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Create a strong password"
                placeholderTextColor={COLORS.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            {/* Password Requirements â€” shown inline, compact */}
            {password.length > 0 && (
              <View style={styles.requirements}>
                <Requirement met={req.length}    label="Min 8 chars" />
                <Requirement met={req.uppercase} label="One uppercase" />
                <Requirement met={req.number}    label="One number" />
              </View>
            )}

            <Text style={[styles.label, { marginTop: 8 }]}>CONFIRM PASSWORD</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Confirm your password"
                placeholderTextColor={COLORS.placeholder}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowConfirm(!showConfirm)}>
                <Text style={styles.eyeText}>{showConfirm ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && confirmPassword !== password && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}
          </View>

          {/* Button */}
          <TouchableOpacity
            style={[styles.primaryButton, (!allReqsMet || !name || !email) && styles.disabledButton]}
            onPress={handleCreateAccount}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>CREATE ACCOUNT</Text>
          </TouchableOpacity>

          {/* OR Divider */}
          <OrDivider />

          {/* Social Buttons */}
          <View style={styles.socialContainer}>
            <Text style={styles.continueWith}>Continue with</Text>
            <SocialButton provider="google" onPress={() => console.log('Google')} />
            <SocialButton provider="apple" onPress={() => console.log('Apple')} />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
              <Text style={styles.footerLink}>Log In</Text>
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </BackgroundLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  header: {
    alignItems: 'center',
    marginTop: 4,
  },
  logo: {
    fontFamily: 'TheSeasons',
    fontSize: 30,
    color: COLORS.primary,
    letterSpacing: 5,
    marginBottom: 6,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.primary,
    letterSpacing: 0.5,
    marginBottom: 3,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FONTS.regular,
    color: COLORS.primaryLight,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },
  divider: {
    width: '75%',
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 10,
  },
  formContainer: {
    width: '100%',
    alignItems: 'flex-start',
  },
  label: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: COLORS.primary,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  input: {
    width: '100%',
    backgroundColor: COLORS.primaryFaint,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.inputBorder,
    color: COLORS.inputText,
    fontFamily: FONTS.regular,
    fontSize: 13,
    paddingVertical: 7,
    marginBottom: 12,
  },
  passwordRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.inputBorder,
    backgroundColor: COLORS.primaryFaint,
    marginBottom: 4,
  },
  eyeButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  eyeText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.primary,
    opacity: 0.8,
  },
  requirements: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
    marginBottom: 4,
  },
  errorText: {
    fontFamily: FONTS.regular,
    color: '#c0392b',
    fontSize: 11,
    marginBottom: 6,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
    marginTop: 6,
  },
  disabledButton: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: '#fff',
    fontFamily: 'TheSeasons',
    fontSize: 13,
    letterSpacing: 2.5,
  },
  socialContainer: {
    width: '100%',
    alignItems: 'center',
  },
  continueWith: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.mutedText,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  footerText: {
    fontFamily: FONTS.regular,
    color: COLORS.mutedText,
    fontSize: 12,
  },
  footerLink: {
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    fontSize: 12,
  },
});

