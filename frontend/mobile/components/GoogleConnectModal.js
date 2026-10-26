import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
} from 'react-native';
import { getGoogleAccount } from '../utils/authStorage';
import { performOAuthLogin } from '../utils/oauthHelper';

export default function GoogleConnectModal({
  visible,
  onClose,
  navigation,
  initialEmail = '',
  initialName = '',
  isSignUp = false,
  onSuccess,
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [savedAccount, setSavedAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load saved Google account if previously connected
  useEffect(() => {
    if (visible) {
      setError('');
      setLoading(false);
      setEmail(initialEmail || '');
      setName(initialName || '');

      getGoogleAccount().then((acc) => {
        if (acc && acc.email) {
          setSavedAccount(acc);
          if (!initialEmail) {
            setEmail(acc.email);
          }
          if (!initialName && acc.name) {
            setName(acc.name);
          }
        }
      });
    }
  }, [visible, initialEmail, initialName]);

  const handleNavAfterLogin = (data) => {
    onClose();
    if (onSuccess) {
      onSuccess(data);
    } else if (navigation) {
      if ((data.is_new_user || isSignUp) && navigation.replace) {
        navigation.replace('PersonalInfo', { name: data.user?.name, userId: data.user?.id });
      } else if (navigation.replace) {
        navigation.replace('Main');
      } else {
        navigation.navigate('Main');
      }
    }
  };

  const handleQuickConnect = async (accEmail, accName) => {
    setError('');
    setLoading(true);

    const result = await performOAuthLogin({
      provider: 'google',
      email: accEmail,
      name: accName,
      navigation,
      isSignUp,
      onSuccess: (data) => {
        setLoading(false);
        handleNavAfterLogin(data);
      },
      onError: (msg) => {
        setLoading(false);
        setError(msg);
      },
    });

    if (!result) {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setError('');
    let targetEmail = email.trim().toLowerCase();

    if (!targetEmail) {
      setError('Please enter your Google / Gmail address.');
      return;
    }

    // Auto-append @gmail.com if domain omitted
    if (!targetEmail.includes('@')) {
      targetEmail = `${targetEmail}@gmail.com`;
      setEmail(targetEmail);
    }

    if (!/^\S+@\S+\.\S+$/.test(targetEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    const targetName = name.trim() || targetEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    const result = await performOAuthLogin({
      provider: 'google',
      email: targetEmail,
      name: targetName,
      navigation,
      isSignUp,
      onSuccess: (data) => {
        setLoading(false);
        handleNavAfterLogin(data);
      },
      onError: (msg) => {
        setLoading(false);
        setError(msg);
      },
    });

    if (!result) {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardAvoid}
          >
            <TouchableWithoutFeedback>
              <View style={styles.card}>
                
                {/* Header with Google Logo & Branding */}
                <View style={styles.header}>
                  <View style={styles.googleIconCircle}>
                    <Text style={styles.googleIconText}>G</Text>
                  </View>
                  <Text style={styles.title}>Sign in with Google</Text>
                  <Text style={styles.subtitle}>
                    Connect your Google / Gmail account to continue to Pantrix
                  </Text>
                </View>

                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                {/* 1-Tap Saved Account (if exists) */}
                {savedAccount && savedAccount.email ? (
                  <View style={styles.savedSection}>
                    <Text style={styles.sectionLabel}>RECENT GOOGLE ACCOUNT</Text>
                    <TouchableOpacity
                      style={styles.savedCard}
                      onPress={() => handleQuickConnect(savedAccount.email, savedAccount.name)}
                      disabled={loading}
                      activeOpacity={0.7}
                    >
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {(savedAccount.name || savedAccount.email).charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.savedInfo}>
                        <Text style={styles.savedName}>{savedAccount.name || 'Google User'}</Text>
                        <Text style={styles.savedEmail}>{savedAccount.email}</Text>
                      </View>
                      <View style={styles.connectBadge}>
                        <Text style={styles.connectBadgeText}>Continue</Text>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.orDivider}>
                      <View style={styles.orLine} />
                      <Text style={styles.orText}>OR CONNECT ANOTHER GMAIL</Text>
                      <View style={styles.orLine} />
                    </View>
                  </View>
                ) : null}

                {/* Account Form */}
                <View style={styles.form}>
                  <Text style={styles.inputLabel}>GMAIL ADDRESS</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. yourname@gmail.com"
                    placeholderTextColor="#9AA0A6"
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      if (error) setError('');
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    editable={!loading}
                  />

                  <Text style={styles.inputLabel}>YOUR NAME (OPTIONAL)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. John Doe"
                    placeholderTextColor="#9AA0A6"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    editable={!loading}
                  />
                </View>

                {/* Action Buttons */}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.buttonDisabled]}
                    onPress={handleConnect}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={[styles.primaryButtonText, { marginLeft: 8 }]}>
                          Connecting with Google...
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        Connect Google Account
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={onClose}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.disclaimer}>
                  By continuing, Pantrix will link your Gmail profile to securely sync your receipts and personalized nutrition goals.
                </Text>

              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  keyboardAvoid: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
      },
      default: {
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  googleIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E8EAED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  googleIconText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#4285F4',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#5F6368',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  errorBox: {
    backgroundColor: '#FCE8E6',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#D93025',
  },
  errorText: {
    fontSize: 12,
    color: '#C5221F',
    fontWeight: '500',
  },
  savedSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#70757A',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F1F3F4',
    borderWidth: 1,
    borderColor: '#E8EAED',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  savedInfo: {
    flex: 1,
  },
  savedName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#202124',
  },
  savedEmail: {
    fontSize: 12,
    color: '#5F6368',
  },
  connectBadge: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  connectBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8EAED',
  },
  orText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#70757A',
    marginHorizontal: 8,
    letterSpacing: 0.5,
  },
  form: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3C4043',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#202124',
    marginBottom: 12,
  },
  actions: {
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#4285F4',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#5F6368',
    fontSize: 13,
    fontWeight: '500',
  },
  disclaimer: {
    fontSize: 10,
    color: '#70757A',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 14,
  },
});
