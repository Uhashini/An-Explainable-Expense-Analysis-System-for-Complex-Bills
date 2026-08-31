import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import ScreenLayout from '../components/ScreenLayout';
import { getUser } from '../utils/authStorage';
import { COLORS, FONTS } from '../theme';

// ─── Mock data ───────────────────────────────────────────────────────────────
const QUICK_STATS = [
  {
    tag:      'SPEND',
    label:    'Total Spend',
    value:    '₹6,240',
    sub:      '+12.5% vs last month',
    subAlert: true,
    accent:   COLORS.primary,
  },
  {
    tag:      'KCAL',
    label:    'Calories Purchased',
    value:    '18,450',
    sub:      'kcal this month',
    subAlert: false,
    accent:   COLORS.secondary,
  },
  {
    tag:      'PROT',
    label:    'Protein Purchased',
    value:    '932 g',
    sub:      'total protein',
    subAlert: false,
    accent:   COLORS.secondary,
  },
  {
    tag:      'SCORE',
    label:    'Healthy Basket',
    value:    '72/100',
    sub:      'Good progress',
    subAlert: false,
    accent:   COLORS.accent,
  },
];

const GOALS = [
  {
    tag:      'MONEY',
    label:    'Save Money',
    progress: 0.72,
    detail:   'Monthly Budget: ₹6,000 / ₹8,500',
    color:    COLORS.accent,
  },
  {
    tag:      'DIET',
    label:    'Eat Healthy',
    progress: 0.80,
    detail:   'Healthy food purchases increased by 18%.',
    color:    COLORS.secondary,
  },
  {
    tag:      'FIT',
    label:    'Gain Muscle',
    progress: 0.65,
    detail:   'Protein intake is improving steadily.',
    color:    COLORS.primary,
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────
function StatCard({ tag, label, value, sub, subAlert, accent }) {
  return (
    <View style={[styles.statCard, { borderTopColor: accent, borderTopWidth: 3 }]}>
      <View style={[styles.statTagBox, { backgroundColor: accent }]}>
        <Text style={[styles.statTag, { color: accent === COLORS.accent ? COLORS.primary : '#fff' }]}>
          {tag}
        </Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statSub, subAlert && styles.statSubAlert]}>{sub}</Text>
    </View>
  );
}

function GoalCard({ tag, label, progress, detail, color }) {
  const pct = Math.round(progress * 100);
  return (
    <View style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <View style={[styles.goalTagBox, { backgroundColor: color }]}>
          <Text style={[styles.goalTag, { color: color === COLORS.accent ? COLORS.primary : '#fff' }]}>
            {tag}
          </Text>
        </View>
        <Text style={styles.goalLabel}>{label}</Text>
        <Text style={styles.goalPct}>{pct}%</Text>
      </View>
      <View style={styles.goalTrack}>
        <View style={[styles.goalFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.goalDetail}>{detail}</Text>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const [name, setName] = useState('');

  useEffect(() => {
    let mounted = true;
    getUser().then((user) => {
      if (mounted && user?.name) setName(user.name);
    });
    return () => { mounted = false; };
  }, []);

  return (
    <ScreenLayout title="Dashboard">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.greeting}>
          <View style={styles.greetingLeft}>
            <Text style={styles.greetingHello}>
              Hello{name ? `, ${name}` : ''}.
            </Text>
            <Text style={styles.greetingSub}>
              Here's what's happening with your grocery habits today.
            </Text>
          </View>
          <View style={styles.greetingBadge}>
            <Text style={styles.greetingBadgeText}>Live</Text>
          </View>
        </View>

        {/* Quick Stats 2×2 Grid */}
        <Text style={styles.sectionTitle}>QUICK STATS</Text>
        <View style={styles.statsGrid}>
          {QUICK_STATS.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </View>

        {/* Goal Progress */}
        <Text style={styles.sectionTitle}>GOAL PROGRESS</Text>
        <View style={styles.goalsContainer}>
          {GOALS.map((g) => (
            <GoalCard key={g.label} {...g} />
          ))}
        </View>

        {/* AI Insight */}
        <View style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <View style={styles.insightTagBox}>
              <Text style={styles.insightTag}>AI</Text>
            </View>
            <Text style={styles.insightTitle}>Latest Insight</Text>
          </View>
          <Text style={styles.insightText}>
            You're spending ₹350/month more on snacks than similar shoppers.
            Consider buying family packs or healthier alternatives to cut costs.
          </Text>
          <TouchableOpacity style={styles.insightBtn}>
            <Text style={styles.insightBtnText}>View Recommendations</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </ScreenLayout>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scrollContent: {
    padding: 18,
    paddingBottom: 32,
  },

  // Greeting
  greeting: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  greetingLeft: { flex: 1 },
  greetingHello: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.primary,
    marginBottom: 4,
  },
  greetingSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: 'rgba(153,8,8,0.55)',
    lineHeight: 19,
  },
  greetingBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 12,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  greetingBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },

  // Section title
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    letterSpacing: 2,
    marginBottom: 12,
    marginTop: 2,
  },

  // Quick Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '47.5%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  statTagBox: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  statTag: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  statValue: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: 'rgba(153,8,8,0.5)',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  statSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: 'rgba(153,8,8,0.5)',
    letterSpacing: 0.2,
  },
  statSubAlert: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
  },

  // Goals
  goalsContainer: { gap: 12, marginBottom: 24 },
  goalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  goalTagBox: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 10,
  },
  goalTag: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  goalLabel: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.primary,
  },
  goalPct: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.primary,
  },
  goalTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(148, 182, 239, 0.2)',
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  goalFill: {
    height: '100%',
    borderRadius: 3,
  },
  goalDetail: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153,8,8,0.5)',
    lineHeight: 17,
  },

  // AI Insight
  insightCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(230, 226, 121, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
    borderTopWidth: 3,
    borderTopColor: COLORS.accent,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  insightTagBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  insightTag: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  insightTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  insightText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: 'rgba(153,8,8,0.7)',
    lineHeight: 20,
    marginBottom: 12,
  },
  insightBtn: {
    alignSelf: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
  },
  insightBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
});
