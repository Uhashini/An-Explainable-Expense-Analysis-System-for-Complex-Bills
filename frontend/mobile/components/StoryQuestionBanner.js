import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FONTS } from '../theme';

/**
 * StoryQuestionBanner
 * 
 * Sits at the top of each Story Card to answer the user's natural question.
 */
export default function StoryQuestionBanner({
  question,
  category = 'HEALTH INSIGHT',
  categoryIcon = '🥗',
  themeColor = '#2E7D32',
}) {
  return (
    <View style={styles.bannerContainer}>
      <View style={styles.topRow}>
        <View style={[styles.categoryBadge, { backgroundColor: `${themeColor}12` }]}>
          <Text style={[styles.categoryText, { color: themeColor }]}>
            {categoryIcon} {category.toUpperCase()}
          </Text>
        </View>
        <View style={styles.aiPill}>
          <Text style={styles.aiPillText}>AI ANSWER</Text>
        </View>
      </View>

      <View style={styles.questionRow}>
        <Text style={styles.quoteIcon}>💬</Text>
        <Text style={styles.questionText}>"{question}"</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EFEBE1',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  aiPill: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#EAE6DC',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  aiPillText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#8A857D',
    letterSpacing: 0.5,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  quoteIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  questionText: {
    flex: 1,
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#1A1816',
    lineHeight: 20,
  },
});

