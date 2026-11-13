import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { FONTS } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * StoryInsightCard
 * 
 * Individual slide inside the Instagram Stories-style AnalyticsStoryDeck.
 * Follows the reference design with:
 * - Rounded card surface (24px) in pure white / warm off-white
 * - Left-aligned metadata text (e.g. "Card 3 of 7: Price Deviation Radar")
 * - Subtle horizontal divider
 * - Right-aligned trend pill badge (e.g. "↗ Trend" in soft mint green)
 * - Bold hero headline (e.g. "₹140 Saved vs Market Average")
 * - Data visualization / chart content area
 * - Left 35% and Right 65% tap navigation zones
 */
export default function StoryInsightCard({
  cardNumber = 1,
  totalCards = 7,
  categoryTitle = 'Insight',
  trendText = '↗ Trend',
  trendType = 'positive', // 'positive' | 'warning' | 'neutral'
  heroMetric = '',
  heroSubtitle = '',
  children,
  onPressPrev,
  onPressNext,
  width,
}) {
  const cardWidth = width || Math.min(SCREEN_WIDTH - 44, 480);

  // Pill styling based on trend type
  const getTrendStyle = () => {
    switch (trendType) {
      case 'warning':
        return {
          bg: '#FFF3E0',
          text: '#E65100',
        };
      case 'neutral':
        return {
          bg: '#EBF1FC',
          text: '#2851A3',
        };
      case 'positive':
      default:
        return {
          bg: '#DDF3E4',
          text: '#1B7A3E',
        };
    }
  };

  const trendStyle = getTrendStyle();

  return (
    <View style={[styles.cardContainer, { width: cardWidth }]}>
      {/* ── Card Header ── */}
      <View style={styles.headerRow}>
        <Text style={styles.metadataText}>
          Card {cardNumber} of {totalCards}: {categoryTitle}
        </Text>
      </View>

      {/* Subtle Horizontal Divider */}
      <View style={styles.divider} />

      {/* ── Trend Pill (Right Aligned) ── */}
      <View style={styles.trendRow}>
        <View style={[styles.trendPill, { backgroundColor: trendStyle.bg }]}>
          <Text style={[styles.trendPillText, { color: trendStyle.text }]}>
            {trendText}
          </Text>
        </View>
      </View>

      {/* ── Hero Metric / Headline ── */}
      {heroMetric ? (
        <Text style={styles.heroHeadline} numberOfLines={2}>
          {heroMetric}
        </Text>
      ) : null}

      {heroSubtitle ? (
        <Text style={styles.heroSubtitle} numberOfLines={2}>
          {heroSubtitle}
        </Text>
      ) : null}

      {/* ── Main Data Visualization Area ── */}
      <View style={styles.contentArea}>
        {children}
      </View>

      {/* ── Instagram Stories-Style Tap Zones (Overlaid) ── */}
      <View style={styles.tapZonesOverlay} pointerEvents="box-none">
        {/* Left 35% Tap Zone (Previous) */}
        <TouchableOpacity
          activeOpacity={1}
          style={styles.tapZoneLeft}
          onPress={onPressPrev}
        />
        {/* Right 65% Tap Zone (Next) */}
        <TouchableOpacity
          activeOpacity={1}
          style={styles.tapZoneRight}
          onPress={onPressNext}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EAE6DC',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    minHeight: 460,
    shadowColor: '#1A0A0A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  metadataText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#7A7265',
    letterSpacing: 0.2,
  },
  divider: {
    height: 1,
    backgroundColor: '#EAE6DC',
    marginBottom: 12,
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  trendPillText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  heroHeadline: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    lineHeight: 30,
    color: '#1A1816',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#8A8275',
    lineHeight: 16,
    marginBottom: 12,
  },
  contentArea: {
    flex: 1,
    marginTop: 6,
    zIndex: 1,
  },
  tapZonesOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 0,
  },
  tapZoneLeft: {
    width: '35%',
    height: '100%',
  },
  tapZoneRight: {
    width: '65%',
    height: '100%',
  },
});

