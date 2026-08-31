import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import BackgroundLayout from '../components/BackgroundLayout';
import OrDivider from '../components/OrDivider';
import SocialButton from '../components/SocialButton';
import { getUser, saveUser } from '../utils/authStorage';
import { API_BASE_URL } from '../utils/apiConfig';
import { COLORS, FONTS } from '../theme';

export default function SignInScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Sign In Required', 'Please enter both email and password to continue.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password
        })
      });
      const data = await response.json();
      if (response.ok) {
        await saveUser(data.user);
        if (navigation.replace) {
          navigation.replace('Main');
        }
      } else {
        Alert.alert('Login Failed', data.detail || 'Invalid email or password.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not connect to the server.');
    }
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
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue your healthy shopping journey.</Text>
          </View>

          <View style={styles.divider} />

          {/* Form */}
          <View style={styles.formContainer}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
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
                placeholder="Enter your password"
                placeholderTextColor={COLORS.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Primary Button */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleLogin}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>LOG IN</Text>
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
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.footerLink}>Sign Up</Text>
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
    fontSize: 32,
    color: COLORS.primary,
    letterSpacing: 5,
    marginBottom: 8,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.primary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    color: COLORS.primaryLight,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  divider: {
    width: '75%',
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 12,
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
    marginBottom: 5,
  },
  input: {
    width: '100%',
    backgroundColor: COLORS.primaryFaint,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.inputBorder,
    color: COLORS.inputText,
    fontFamily: FONTS.regular,
    fontSize: 14,
    paddingVertical: 9,
    marginBottom: 16,
  },
  passwordRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.inputBorder,
    backgroundColor: COLORS.primaryFaint,
    marginBottom: 6,
  },
  eyeButton: {
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  eyeText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.primary,
    opacity: 0.8,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 2,
    marginTop: 4,
  },
  forgotPasswordText: {
    fontFamily: FONTS.regular,
    color: COLORS.primary,
    fontSize: 11,
    opacity: 0.85,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
    marginTop: 8,
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
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
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
