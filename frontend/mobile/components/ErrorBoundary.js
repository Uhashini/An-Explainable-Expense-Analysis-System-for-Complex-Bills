import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('[ErrorBoundary] Caught runtime exception:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      try { this.props.onReset(); } catch (e) {}
    }
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || this.state.error?.toString() || 'An unexpected error occurred.';
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Feather name="alert-triangle" size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              {this.props.fallbackMessage || 'We encountered an issue loading this section. Please try again.'}
            </Text>
            {errorMsg ? (
              <ScrollView style={styles.errorBox} contentContainerStyle={{ padding: 8 }}>
                <Text style={styles.errorText} numberOfLines={4}>
                  {errorMsg}
                </Text>
              </ScrollView>
            ) : null}
            <TouchableOpacity style={styles.retryBtn} onPress={this.resetError} activeOpacity={0.8}>
              <Feather name="refresh-cw" size={15} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.retryBtnText}>Reload App</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF6F1',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#EDE6DE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FBEBEB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: '#2C1010',
    marginBottom: 6,
    textAlign: 'center',
  },
  message: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.mutedText,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  errorBox: {
    maxHeight: 100,
    width: '100%',
    backgroundColor: '#FFF0F0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F5C6CB',
    marginBottom: 16,
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#721C24',
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    width: '100%',
  },
  retryBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#fff',
  },
});
