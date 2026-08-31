import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView,
} from 'react-native';
import BackgroundLayout from '../components/BackgroundLayout';
import ProgressBar from '../components/ProgressBar';
import { COLORS, FONTS } from '../theme';

const GOALS = [
  {
    id: 'save-money',
    tag: '$',
    title: 'Save Money',
    description: 'Track grocery spending, discover cheaper alternatives, and stay within your monthly budget.',
  },
  {
    id: 'eat-healthier',
    tag: 'EH',
    title: 'Eat Healthier',
    description: 'Analyze nutritional value, reduce unhealthy purchases, and build better eating habits.',
  },
  {
    id: 'gain-muscle',
    tag: 'GM',
    title: 'Gain Muscle',
    description: 'Monitor protein intake, discover high-protein foods, and support muscle growth.',
  },
  {
    id: 'lose-weight',
    tag: 'LW',
    title: 'Lose Weight',
    description: 'Track calories, reduce excess sugar and fat intake, and maintain a calorie deficit.',
  },
  {
    id: 'balanced-lifestyle',
    tag: 'BL',
    title: 'Balanced Lifestyle',
    description: 'Maintain a healthy balance between nutrition, spending, and overall wellness.',
  },
];

export default function GoalsScreen({ navigation }) {
  const [selected, setSelected] = useState(new Set());

  const toggleGoal = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedGoals = GOALS.filter((g) => selected.has(g.id));

  return (
    <BackgroundLayout>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress */}
        <View style={styles.progressWrapper}>
          <ProgressBar step={2} total={5} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>PANTRIX</Text>
          <Text style={styles.title}>What Are Your Goals?</Text>
          <Text style={styles.subtitle}>Choose one or more goals. You can change them anytime.</Text>
        </View>

        <View style={styles.sectionDivider} />

        {/* Goal Cards */}
        <View style={styles.cardsContainer}>
          {GOALS.map((goal) => {
            const isSelected = selected.has(goal.id);
            return (
              <TouchableOpacity
                key={goal.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => toggleGoal(goal.id)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.cardTagBox, isSelected && styles.cardTagBoxSelected]}>
                    <Text style={[styles.cardTag, isSelected && styles.cardTagSelected]}>
                      {goal.tag}
                    </Text>
                  </View>
                  <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                    {goal.title}
                  </Text>
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkboxMark}>✓</Text>}
                  </View>
                </View>
                <Text style={[styles.cardDescription, isSelected && styles.cardDescriptionSelected]}>
                  {goal.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Chips */}
        {selectedGoals.length > 0 && (
          <View style={styles.chipsSection}>
            <Text style={styles.chipsLabel}>SELECTED GOALS</Text>
            <View style={styles.chipsRow}>
              {selectedGoals.map((goal) => (
                <TouchableOpacity
                  key={goal.id}
                  style={styles.chip}
                  onPress={() => toggleGoal(goal.id)}
                >
                  <Text style={styles.chipText}>{goal.title}</Text>
                  <Text style={styles.chipRemove}>  ✕</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Continue Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, selected.size === 0 && styles.disabledButton]}
            onPress={() => navigation.navigate('Main')}
            activeOpacity={0.85}
            disabled={selected.size === 0}
          >
            <Text style={styles.primaryButtonText}>CONTINUE  →</Text>
          </TouchableOpacity>
        </View>

        {/* Footer note */}
        <Text style={styles.footerNote}>
          You can update your goals anytime from Profile → Goals.
        </Text>
      </ScrollView>
    </BackgroundLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 28,
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
    marginVertical: 16,
  },
  cardsContainer: {
    width: '100%',
    gap: 10,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.divider,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(139, 26, 26, 0.04)',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTagBox: {
    width: 34,
    height: 28,
    borderRadius: 6,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTagBoxSelected: {
    backgroundColor: COLORS.primary,
  },
  cardTag: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#fff',
    letterSpacing: 0.5,
  },
  cardTagSelected: {
    color: COLORS.accent,
  },
  cardTitle: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#3a2020',
    letterSpacing: 0.3,
  },
  cardTitleSelected: {
    color: COLORS.primary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: COLORS.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxMark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  cardDescription: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.mutedText,
    lineHeight: 18,
  },
  cardDescriptionSelected: {
    color: COLORS.primaryLight,
  },
  chipsSection: {
    width: '100%',
    marginTop: 16,
  },
  chipsLabel: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.primary,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#fff',
    letterSpacing: 0.3,
  },
  chipRemove: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
  },
  buttonContainer: {
    width: '100%',
    marginTop: 22,
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
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#fff',
    fontFamily: FONTS.bold,
    fontSize: 14,
    letterSpacing: 2,
  },
  footerNote: {
    marginTop: 16,
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.mutedText,
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: 17,
    opacity: 0.8,
  },
});
