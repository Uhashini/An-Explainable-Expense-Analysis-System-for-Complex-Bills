import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated,
} from 'react-native';
import ScreenLayout from '../components/ScreenLayout';
import { COLORS, FONTS } from '../theme';

// ─── Mock receipt data ──────────────────────────────────────────────────────
const ITEMS = [
  { name: 'Milk',           qty: '1',    price: '₹62',   calories: 120,  protein: '9g'   },
  { name: 'Eggs',           qty: '6',    price: '₹75',   calories: 420,  protein: '36g'  },
  { name: 'Chicken Breast', qty: '500g', price: '₹310',  calories: 550,  protein: '105g' },
  { name: 'Brown Rice',     qty: '1kg',  price: '₹130',  calories: 360,  protein: '7g'   },
  { name: 'Bananas',        qty: '6',    price: '₹60',   calories: 540,  protein: '6g'   },
  { name: 'Oats',           qty: '500g', price: '₹95',   calories: 385,  protein: '16g'  },
];

// ─── Analysis insights per mode ─────────────────────────────────────────────
const ANALYSIS_MODES = [
  {
    key: 'muscle',
    label: 'Gain Muscle',
    color: COLORS.primary,
    accentColor: '#E6E279',
    insights: [
      {
        title: 'Protein Score — 179g total',
        detail:
          'Excellent. Chicken Breast (105g) and Eggs (36g) cover ~85% of your protein goal. Aim for 160–200g/day for muscle growth.',
      },
      {
        title: 'High-Quality Sources',
        detail:
          'This basket has 3 complete protein sources: Eggs, Chicken Breast, and Milk. These provide all essential amino acids needed for muscle repair.',
      },
      {
        title: 'Carb Timing Opportunity',
        detail:
          'Brown Rice and Oats are ideal pre/post-workout carbs. Pair 60–80g with your protein sources for optimal muscle synthesis.',
      },
      {
        title: 'What to Add Next',
        detail:
          'Consider adding Greek Yogurt or Cottage Cheese to further increase protein density per rupee spent.',
      },
    ],
  },
  {
    key: 'healthy',
    label: 'Eat Healthy',
    color: COLORS.primary,
    accentColor: '#94B6EF',
    insights: [
      {
        title: 'Nutrient Density — Good',
        detail:
          'Bananas, Oats, and Brown Rice provide fibre, potassium, and slow-release energy. This is a well-rounded basket.',
      },
      {
        title: 'Calorie Distribution',
        detail:
          '2,375 kcal across 6 items. Chicken and Eggs contribute lean calories. Bananas add natural sugars — ideal as pre-workout fuel.',
      },
      {
        title: 'Missing Vegetables',
        detail:
          'No vegetables detected in this receipt. Add leafy greens or tomatoes to improve micronutrient coverage.',
      },
      {
        title: 'Healthy Score — 74/100',
        detail:
          'High-protein, moderate-fibre basket. Score is limited by absence of vegetables and fresh fruits beyond bananas.',
      },
    ],
  },
  {
    key: 'money',
    label: 'Save Money',
    color: COLORS.primary,
    accentColor: '#94B6EF',
    insights: [
      {
        title: 'Total Spend — ₹1,245.60',
        detail:
          'Chicken Breast accounts for 25% (₹310) of the total bill. Buying in bulk packs (1kg+) from Reliance Smart could save ₹50–₹80.',
      },
      {
        title: 'Best Value Item',
        detail:
          'Brown Rice at ₹130/kg delivers the highest calorie-per-rupee ratio in this basket. Increasing quantity reduces your per-meal cost.',
      },
      {
        title: 'Swap Suggestion',
        detail:
          'Oats (₹95 for 500g) can be replaced by 1kg packs at ₹155 — saving ₹35 for double the quantity.',
      },
      {
        title: 'Monthly Savings Estimate',
        detail:
          'Applying bulk-buy strategies across your top 3 expensive items could save ₹300–₹450/month.',
      },
    ],
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function InsightCard({ title, detail, accent }) {
  return (
    <View style={[styles.insightCard, { borderLeftColor: accent }]}>
      <Text style={styles.insightTitle}>{title}</Text>
      <Text style={styles.insightDetail}>{detail}</Text>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function ReceiptDetailsScreen({ route, navigation }) {
  const { imageUri, receiptData } = route.params || {};
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [activeMode, setActiveMode] = useState(0); // 0=muscle, 1=healthy, 2=money

  const currentMode = ANALYSIS_MODES[activeMode];

  const isMock = !receiptData;
  const info = receiptData?.data?.receipt_info || receiptData?.receipt_info || {};
  
  const extractedItems = isMock ? ITEMS : (info.items || []);
  const merchantName = isMock ? 'Reliance Fresh' : (info.merchant_name || 'Unknown Store');
  const totalAmount = isMock ? 1245.60 : (info.total_amount || 0.0);
  const dateStr = isMock ? '20 July 2025' : (info.date || 'Unknown Date');

  return (
    <ScreenLayout title="Receipt Details" navigation={navigation} showBack>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Receipt Banner ── */}
        <View style={styles.receiptBanner}>
          <View style={styles.bannerIconBox}>
            <Text style={styles.bannerIconText}>REC</Text>
          </View>
          <View style={styles.bannerInfo}>
            <Text style={styles.storeName}>{merchantName}</Text>
            <Text style={styles.storeDate}>{dateStr}</Text>
            <Text style={styles.receiptId}>Receipt ID: #RF203451</Text>
          </View>
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeLabel}>Total</Text>
            <Text style={styles.totalBadgeValue}>₹{totalAmount}</Text>
          </View>
        </View>

        {/* ── Items Table ── */}
        <Text style={styles.sectionTitle}>PURCHASED ITEMS</Text>
        <View style={styles.tableCard}>
          {/* Header */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.colItem,  styles.headerCell]}>Item</Text>
            <Text style={[styles.colQty,   styles.headerCell]}>Qty</Text>
            <Text style={[styles.colRate,  styles.headerCell]}>Rate</Text>
            <Text style={[styles.colPrice, styles.headerCell]}>Price</Text>
            <Text style={[styles.colCal,   styles.headerCell]}>kcal</Text>
            <Text style={[styles.colProt,  styles.headerCell]}>Protein</Text>
          </View>
          {extractedItems.map((item, i) => {
            const price = item.total_price != null ? `₹${item.total_price}` : (item.price != null ? (String(item.price).startsWith('₹') ? item.price : `₹${item.price}`) : '₹0');
            const rate = item.unit_price != null ? `₹${item.unit_price}` : (item.rate != null ? (String(item.rate).startsWith('₹') ? item.rate : `₹${item.rate}`) : '-');
            return (
              <View
                key={i} // Using index because OCR might return duplicate names
                style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}
              >
                <Text style={[styles.colItem,  styles.cellText]} numberOfLines={2}>{item.name}</Text>
                <Text style={[styles.colQty,   styles.cellText]}>{item.quantity || item.qty || 1}</Text>
                <Text style={[styles.colRate,  styles.cellText]}>{rate}</Text>
                <Text style={[styles.colPrice, styles.cellText]}>{price}</Text>
                <Text style={[styles.colCal,   styles.cellText]}>{item.calories || '-'}</Text>
                <Text style={[styles.colProt,  styles.cellText]}>{item.protein || '-'}</Text>
              </View>
            );
          })}
        </View>

        {/* ── Summary ── */}
        <Text style={styles.sectionTitle}>SUMMARY</Text>
        <View style={styles.summaryCard}>
          <InfoRow label="Total Items"    value={extractedItems.length.toString()} />
          <InfoRow label="Total Calories" value="-" />
          <InfoRow label="Total Protein"  value="-" />
          <View style={styles.summaryDivider} />
          <View style={[styles.infoRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Cost</Text>
            <Text style={styles.totalValue}>₹{totalAmount}</Text>
          </View>
        </View>

        {/* ── Action Buttons ── */}
        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>Save Receipt</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85}>
          <Text style={styles.secondaryButtonText}>Edit Details</Text>
        </TouchableOpacity>

        {/* ── Receipt Analysis CTA ── */}
        <TouchableOpacity
          style={styles.analysisButton}
          activeOpacity={0.85}
          onPress={() => setShowAnalysis(!showAnalysis)}
        >
          <View style={styles.analysisButtonInner}>
            <View style={styles.analysisBtnAccent} />
            <Text style={styles.analysisButtonText}>
              {showAnalysis ? 'Hide Analysis' : 'Receipt Analysis'}
            </Text>
          </View>
          <Text style={styles.analysisChevron}>{showAnalysis ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {/* ── Analysis Panel ── */}
        {showAnalysis && (
          <View style={styles.analysisPanel}>

            {/* Mode Segmented Control */}
            <View style={styles.modeSegment}>
              {ANALYSIS_MODES.map((mode, idx) => (
                <TouchableOpacity
                  key={mode.key}
                  style={[
                    styles.modeTab,
                    activeMode === idx && styles.modeTabActive,
                  ]}
                  onPress={() => setActiveMode(idx)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.modeTabText,
                      activeMode === idx && styles.modeTabTextActive,
                    ]}
                  >
                    {mode.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Active Mode Insights */}
            <View style={styles.insightsContainer}>
              {currentMode.insights.map((insight, i) => (
                <InsightCard
                  key={i}
                  title={insight.title}
                  detail={insight.detail}
                  accent={currentMode.accentColor}
                />
              ))}
            </View>

          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </ScreenLayout>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scrollContent: {
    padding: 18,
    paddingBottom: 36,
  },

  // Banner
  receiptBanner: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  bannerIconBox: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  bannerIconText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#fff',
    letterSpacing: 1.5,
  },
  bannerInfo: { flex: 1 },
  storeName: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.primary,
    marginBottom: 3,
  },
  storeDate: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153,8,8,0.55)',
    marginBottom: 2,
  },
  receiptId: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: 'rgba(153,8,8,0.4)',
  },
  totalBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  totalBadgeLabel: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  totalBadgeValue: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.primary,
  },

  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 4,
  },

  // Table
  tableCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  tableHeader:  { backgroundColor: COLORS.primary },
  tableRowAlt:  { backgroundColor: 'rgba(148, 182, 239, 0.08)' },
  headerCell: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#fff',
    letterSpacing: 0.5,
  },
  cellText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.primary,
  },
  colItem:  { flex: 2 },
  colQty:   { flex: 0.8, textAlign: 'center' },
  colRate:  { flex: 1, textAlign: 'center' },
  colPrice: { flex: 1, textAlign: 'center' },
  colCal:   { flex: 0.9, textAlign: 'center' },
  colProt:  { flex: 1, textAlign: 'right' },

  // Summary
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: 'rgba(153,8,8,0.55)',
  },
  infoValue: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.primary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(148, 182, 239, 0.3)',
    marginVertical: 8,
  },
  totalRow:   { paddingVertical: 10 },
  totalLabel: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.primary,
  },
  totalValue: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.primary,
  },

  // Buttons
  primaryButton: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#fff',
    letterSpacing: 1,
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: '#fff',
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },

  // Analysis CTA Button
  analysisButton: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  analysisButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  analysisBtnAccent: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginRight: 12,
  },
  analysisButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  analysisChevron: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },

  // Analysis Panel
  analysisPanel: {
    width: '100%',
    marginTop: 12,
  },

  // Mode Segmented Control
  modeSegment: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 182, 239, 0.4)',
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  modeTabText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: 'rgba(153,8,8,0.5)',
    textAlign: 'center',
  },
  modeTabTextActive: {
    color: '#fff',
  },

  // Insight Cards
  insightsContainer: {
    gap: 12,
  },
  insightCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  insightTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
    marginBottom: 6,
  },
  insightDetail: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: 'rgba(153,8,8,0.7)',
    lineHeight: 20,
  },
});
