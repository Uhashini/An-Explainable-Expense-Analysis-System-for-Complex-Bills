import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import ScreenLayout from '../components/ScreenLayout';
import { COLORS, FONTS } from '../theme';

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MONTHLY_DATA = [
  { month: 'Jan', spend: 5200 },
  { month: 'Feb', spend: 4800 },
  { month: 'Mar', spend: 5900 },
  { month: 'Apr', spend: 5400 },
  { month: 'May', spend: 6100 },
  { month: 'Jun', spend: 6240 },
];

const CATEGORIES = [
  { label: 'Dairy',      tag: 'DAI', pct: 15, color: COLORS.secondary },
  { label: 'Protein',    tag: 'PRO', pct: 20, color: COLORS.primary },
  { label: 'Fruits',     tag: 'FRT', pct: 15, color: COLORS.accent },
  { label: 'Snacks',     tag: 'SNK', pct: 35, color: COLORS.primary },
  { label: 'Vegetables', tag: 'VEG', pct: 10, color: COLORS.secondary },
  { label: 'Others',     tag: 'OTH', pct: 5,  color: 'rgba(153,8,8,0.3)' },
];

const TIME_FILTERS = ['Week', 'Month', 'Year'];

const MAX_SPEND = Math.max(...MONTHLY_DATA.map((d) => d.spend));

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function SpendingBarChart() {
  return (
    <View style={chartStyles.container}>
      {MONTHLY_DATA.map((d) => {
        const heightPct = (d.spend / MAX_SPEND) * 100;
        return (
          <View key={d.month} style={chartStyles.barWrapper}>
            <Text style={chartStyles.barValue}>₹{(d.spend / 1000).toFixed(1)}k</Text>
            <View style={chartStyles.barTrack}>
              <View style={[chartStyles.barFill, { height: `${heightPct}%` }]} />
            </View>
            <Text style={chartStyles.barLabel}>{d.month}</Text>
          </View>
        );
      })}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 140,
    gap: 8,
    paddingTop: 24,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValue: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: COLORS.mutedText,
    marginBottom: 4,
  },
  barTrack: {
    width: '100%',
    height: 90,
    justifyContent: 'flex-end',
    borderRadius: 6,
    backgroundColor: 'rgba(139,26,26,0.07)',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  barLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.mutedText,
    marginTop: 6,
  },
});

// ─── Category Row ─────────────────────────────────────────────────────────────
function CategoryRow({ tag, label, pct, color }) {
  return (
    <View style={catStyles.row}>
      <View style={[catStyles.tagBox, { backgroundColor: color }]}>
        <Text style={[catStyles.tagText, { color: color === COLORS.accent ? COLORS.primary : '#fff' }]}>
          {tag}
        </Text>
      </View>
      <Text style={catStyles.label}>{label}</Text>
      <View style={catStyles.barTrack}>
        <View style={[catStyles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={catStyles.pct}>{pct}%</Text>
    </View>
  );
}

const catStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  tagBox: {
    width: 34,
    height: 22,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  tagText: {
    fontFamily: FONTS.bold,
    fontSize: 8,
    letterSpacing: 0.8,
  },
  label: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#3a2020',
    width: 80,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0e8e8',
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  pct: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
    width: 32,
    textAlign: 'right',
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SpendingAnalyticsScreen({ navigation }) {
  const [timeFilter, setTimeFilter] = useState('Month');

  const budgetUsed = 0.78;

  return (
    <ScreenLayout title="Spending Analytics">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Time Filter */}
        <View style={styles.timeFilterRow}>
          {TIME_FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.timeChip, timeFilter === f && styles.timeChipActive]}
              onPress={() => setTimeFilter(f)}
            >
              <Text style={[styles.timeChipText, timeFilter === f && styles.timeChipTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Monthly Total */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Monthly Spending</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalValue}>₹6,240</Text>
            <View style={styles.changeBadge}>
              <Text style={styles.changeText}>▲ +12.5%</Text>
            </View>
          </View>
          <Text style={styles.totalSub}>Compared to last month</Text>

          {/* Bar Chart */}
          <SpendingBarChart />
        </View>

        {/* Category Breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>CATEGORY BREAKDOWN</Text>
          {CATEGORIES.map((c) => (
            <CategoryRow key={c.label} {...c} />
          ))}
        </View>

        {/* Average Basket Value */}
        <View style={styles.rowCards}>
          <View style={[styles.metricCard, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.metricIcon}>🛒</Text>
            <Text style={styles.metricLabel}>Avg Basket Value</Text>
            <Text style={styles.metricValue}>₹740</Text>
            <Text style={styles.metricSub}>per trip</Text>
          </View>
          <View style={[styles.metricCard, { flex: 1 }]}>
            <Text style={styles.metricIcon}>📊</Text>
            <Text style={styles.metricLabel}>Total Trips</Text>
            <Text style={styles.metricValue}>8</Text>
            <Text style={styles.metricSub}>this month</Text>
          </View>
        </View>

        {/* Budget Utilization */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>BUDGET UTILIZATION</Text>
          <View style={styles.budgetHeaderRow}>
            <Text style={styles.budgetPct}>{Math.round(budgetUsed * 100)}%</Text>
            <Text style={styles.budgetRemain}>Remaining: ₹1,860</Text>
          </View>
          <View style={styles.budgetTrack}>
            <View style={[styles.budgetFill, { width: `${budgetUsed * 100}%` }]} />
          </View>
          <Text style={styles.budgetSub}>₹6,240 of ₹8,100 budget used</Text>
        </View>

        {/* AI Insight */}
        <View style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <Text style={styles.insightIcon}>💡</Text>
            <Text style={styles.insightTitle}>AI Insight</Text>
          </View>
          <Text style={styles.insightText}>
            Your snack spending increased by 18% this month. Reducing snack purchases by just ₹250 could help you stay within budget.
          </Text>
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.ctaButton} activeOpacity={0.85}>
          <Text style={styles.ctaText}>View Smart Recommendations →</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 18,
    paddingBottom: 32,
  },

  // Time Filter
  timeFilterRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  timeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  timeChipActive: {
    backgroundColor: COLORS.primary,
  },
  timeChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.mutedText,
  },
  timeChipTextActive: {
    color: '#fff',
  },

  // Monthly Total
  totalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  totalLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.mutedText,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  totalValue: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    color: '#2c1010',
  },
  changeBadge: {
    backgroundColor: 'rgba(231, 76, 60, 0.12)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  changeText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#c0392b',
  },
  totalSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.mutedText,
    marginTop: 2,
    marginBottom: 12,
  },

  // Generic Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    letterSpacing: 1.5,
    marginBottom: 16,
  },

  // Row Metrics
  rowCards: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  metricCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  metricIcon: { fontSize: 22, marginBottom: 6 },
  metricLabel: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.mutedText,
    marginBottom: 4,
  },
  metricValue: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: '#2c1010',
  },
  metricSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.mutedText,
  },

  // Budget
  budgetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  budgetPct: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: COLORS.primary,
  },
  budgetRemain: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#2e7d32',
  },
  budgetTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#f0e8e8',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  budgetFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 5,
  },
  budgetSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.mutedText,
  },

  // Insight
  insightCard: {
    backgroundColor: '#fff8f0',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#f0d8b0',
    marginBottom: 16,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightIcon: { fontSize: 18, marginRight: 8 },
  insightTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#7a4800',
    letterSpacing: 0.5,
  },
  insightText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#5a3800',
    lineHeight: 20,
  },

  // CTA
  ctaButton: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#fff',
    letterSpacing: 1,
  },
});
