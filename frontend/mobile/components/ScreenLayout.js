import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../theme';

/**
 * Shared layout for all inner app screens.
 * @param {string}  title       - header title
 * @param {node}    children
 * @param {object}  navigation  - react-navigation object (for back button)
 * @param {boolean} showBack    - show ← back button
 * @param {node}    rightAction - optional right header node
 */
export default function ScreenLayout({ title, children, navigation, showBack = false, rightAction }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={styles.safe.backgroundColor} />

      {/* Header */}
      <View style={styles.header}>
        {showBack ? (
          <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSide} />
        )}

        <Text style={styles.headerTitle}>{title}</Text>

        <View style={styles.headerSide}>
          {rightAction || null}
        </View>
      </View>

      <View style={styles.content}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f7f3ee',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ede8e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  backBtn: {
    width: 36,
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    color: COLORS.primary,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.primary,
    letterSpacing: 1.5,
  },
  headerSide: {
    width: 36,
  },
  content: {
    flex: 1,
  },
});
