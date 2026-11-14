import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FONTS } from '../theme';
import ThinkingCloudIcon from './ThinkingCloudIcon';

/**
 * StoryQuestionBanner
 * 
 * Sits at the top of each Story Card framing the slide around the user's core question.
 * Features an editorial SVG Thinking Cloud icon and clean metadata badge.
 */
export default function StoryQuestionBanner({
  question,
  category = 'HEALTH INSIGHT',
  categoryIcon,
  themeColor = '#990808',
}) {
  return (
    <View style={styles.bannerContainer}>
      <View style={styles.topRow}>
        <View style={styles.categoryBadge}>
          <View style={[styles.categoryDot, { backgroundColor: themeColor || '#990808' }]} />
          <Text style={styles.categoryText}>
            {category.toUpperCase()}
          </Text>
        </View>
        <View style={styles.aiPill}>
          <Text style={styles.aiPillText}>EXPLAINABLE INSIGHT</Text>
        </View>
      </View>

      <View style={styles.questionRow}>
        <View style={styles.iconBadge}>
          <ThinkingCloudIcon width={24} height={24} primaryColor="#990808" />
        </View>
        <Text style={styles.questionText}>
          {question}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EAE6DC',
    shadowColor: '#1A0A0A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F7F3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EFEAE1',
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  categoryText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#5A5248',
    letterSpacing: 0.6,
  },
  aiPill: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#EFEBE1',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  aiPillText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#8A8378',
    letterSpacing: 0.5,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FAF8F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFEAE1',
    flexShrink: 0,
  },
  questionText: {
    flex: 1,
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#1A1816',
    lineHeight: 20,
    letterSpacing: 0.1,
  },
});
