import React from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import BackgroundLayout from './BackgroundLayout';
import ProgressBar from './ProgressBar';
import { COLORS, FONTS } from '../theme';

export default function OnboardingLayout({ step, title, subtitle, icon, children }) {
  return (
    <BackgroundLayout>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ProgressBar step={step} total={5} />
          <View style={styles.hero}><View style={styles.icon}><Text style={styles.iconText}>{icon}</Text></View><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </BackgroundLayout>
  );
}

export const onboardingStyles = StyleSheet.create({
  field: { fontFamily: FONTS.bold, fontSize: 10, color: COLORS.primary, letterSpacing: 1.3, marginBottom: 7 },
  input: { backgroundColor: COLORS.primaryFaint, borderWidth: 1, borderColor: COLORS.inputBorder, borderRadius: 12, color: COLORS.inputText, fontFamily: FONTS.regular, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  primary: { flex: 1, paddingVertical: 15, borderRadius: 28, backgroundColor: COLORS.primary, alignItems: 'center', elevation: 3 },
  secondary: { flex: 1, paddingVertical: 14, borderRadius: 28, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center' },
  primaryText: { color: '#fff', fontFamily: FONTS.bold, fontSize: 13, letterSpacing: 1 },
  secondaryText: { color: COLORS.primary, fontFamily: FONTS.bold, fontSize: 13, letterSpacing: 1 },
  disabled: { opacity: 0.4 }, error: { color: '#c0392b', fontFamily: FONTS.regular, fontSize: 12, marginTop: -10, marginBottom: 12 },
});
const styles = StyleSheet.create({ flex: { flex: 1, width: '100%' }, content: { flexGrow: 1, paddingBottom: 24 }, hero: { alignItems: 'center', marginBottom: 22 }, icon: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, iconText: { fontSize: 27 }, title: { fontFamily: FONTS.bold, fontSize: 23, color: COLORS.primary, textAlign: 'center', marginBottom: 6 }, subtitle: { fontFamily: FONTS.regular, color: COLORS.mutedText, fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 } });
