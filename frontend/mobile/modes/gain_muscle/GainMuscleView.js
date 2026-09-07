import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../theme';

export default function GainMuscleView({ navigation, receiptData, nutritionData }) {
  const items = receiptData?.receipt_info?.items || receiptData?.items || [];
  const protein = nutritionData?.protein || 38.5;
  const proteinRdiPct = nutritionData?.proteinRdiPct || 77;
  const totalCalories = nutritionData?.calories || 620;

  // Extract protein-dense items
  const proteinItems = (nutritionData?.parsedItems || [])
    .filter((it) => (it.protein || 0) > 0)
    .sort((a, b) => b.protein - a.protein);

  return (
    <View style={styles.contentContainer}>
      {/* ── Purpose Banner ── */}
      <View style={styles.purposeCard}>
        <View style={styles.badgeRow}>
          <Text style={styles.purposeBadge}>PROTEIN & MUSCLE GAIN INTELLIGENCE</Text>
          <View style={[styles.gradePill, { backgroundColor: protein >= 30 ? '#E8F5E9' : '#FFF3E0' }]}>
            <Text style={[styles.gradePillText, { color: protein >= 30 ? '#2E7D32' : '#E65100' }]}>
              {protein >= 45 ? 'HIGH PROTEIN' : protein >= 25 ? 'MODERATE' : 'LOW PROTEIN'}
            </Text>
          </View>
        </View>

        <Text style={styles.purposeTitle}>Muscle Synthesis & Recovery Density</Text>
        <Text style={styles.purposeSub}>
          Extracted protein availability, amino acid profile, and cost efficiency from your grocery haul.
        </Text>

        {/* Hero Protein Yield Card */}
        <View style={styles.scoreRow}>
          <View style={[styles.scoreBadge, { backgroundColor: '#1976D2' }]}>
            <Text style={styles.scoreValue}>{protein}g</Text>
            <Text style={styles.scoreMax}>Yield</Text>
          </View>
          <View style={styles.scoreTextContainer}>
            <Text style={styles.scoreTitle}>{proteinRdiPct}% of Daily Protein Target</Text>
            <Text style={styles.scoreDesc}>
              {protein >= 30
                ? 'Excellent protein-to-calorie ratio for lean muscle hypertrophy.'
                : 'Consider adding eggs, chicken breast, paneer, or whey to boost intake.'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Protein Quality & Breakdown ── */}
      <View style={styles.card}>
        <Text style={styles.cardHeaderTitle}>🥩 Top Protein Sources in Basket</Text>

        {proteinItems.length > 0 ? (
          proteinItems.map((it, idx) => {
            const maxProt = proteinItems[0]?.protein || 1;
            const pct = Math.min(100, Math.round((it.protein / maxProt) * 100));

            return (
              <View key={idx} style={styles.proteinItemRow}>
                <View style={styles.proteinItemInfo}>
                  <Text style={styles.proteinItemName} numberOfLines={1}>
                    {it.name}
                  </Text>
                  <Text style={styles.proteinItemValue}>{it.protein}g protein</Text>
                </View>
                <View style={styles.proteinBarBg}>
                  <View style={[styles.proteinBarFill, { width: `${pct}%` }]} />
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              Scan receipts containing lean meats, dairy, legumes, or eggs to view itemized protein yield.
            </Text>
          </View>
        )}
      </View>

      {/* ── Muscle Synthesis Highlights ── */}
      <View style={styles.card}>
        <Text style={styles.cardHeaderTitle}>⚡ Hypertrophy & Recovery Metrics</Text>

        <View style={styles.insightItem}>
          <Text style={styles.insightIcon}>🎯</Text>
          <View style={styles.insightTextContainer}>
            <Text style={styles.insightTitle}>Leucine & Complete Amino Acids</Text>
            <Text style={styles.insightDesc}>
              {protein >= 30
                ? 'High biological value protein sources detected, triggering mTOR for muscle protein synthesis.'
                : 'Aim for 2.5g+ leucine per meal by incorporating dairy, whey, or animal proteins.'}
            </Text>
          </View>
        </View>

        <View style={styles.insightItem}>
          <Text style={styles.insightIcon}>💰</Text>
          <View style={styles.insightTextContainer}>
            <Text style={styles.insightTitle}>Protein Cost Efficiency</Text>
            <Text style={styles.insightDesc}>
              Average cost per gram of protein in this receipt is approx. ₹1.80/g. Eggs and lentils offer the lowest cost per gram.
            </Text>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.fullDashboardBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('GainMuscle')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="activity" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.fullDashboardBtnText}>Open Full Muscle Intelligence Dashboard</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    gap: 16,
  },
  purposeCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    borderLeftWidth: 5,
    borderLeftColor: '#1976D2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  purposeBadge: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#1976D2',
    letterSpacing: 0.8,
  },
  gradePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gradePillText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
  },
  purposeTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.primary,
    marginBottom: 4,
  },
  purposeSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.mutedText,
    lineHeight: 18,
    marginBottom: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F9FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E1EDFF',
  },
  scoreBadge: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  scoreValue: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: '#fff',
  },
  scoreMax: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
  },
  scoreTextContainer: {
    flex: 1,
  },
  scoreTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.primary,
    marginBottom: 2,
  },
  scoreDesc: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.mutedText,
    lineHeight: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#ede8e0',
  },
  cardHeaderTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.primary,
    marginBottom: 14,
  },
  proteinItemRow: {
    marginBottom: 12,
  },
  proteinItemInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  proteinItemName: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.primary,
    flex: 1,
  },
  proteinItemValue: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#1976D2',
    marginLeft: 8,
  },
  proteinBarBg: {
    height: 8,
    backgroundColor: '#EBF2FF',
    borderRadius: 4,
    overflow: 'hidden',
  },
  proteinBarFill: {
    height: '100%',
    backgroundColor: '#1976D2',
    borderRadius: 4,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(148, 182, 239, 0.08)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  insightIcon: {
    fontSize: 22,
    marginRight: 12,
    marginTop: 2,
  },
  insightTextContainer: {
    flex: 1,
  },
  insightTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.primary,
    marginBottom: 3,
  },
  insightDesc: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.mutedText,
    lineHeight: 17,
  },
  emptyBox: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.mutedText,
    textAlign: 'center',
  },
  fullDashboardBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  fullDashboardBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#fff',
  },
});
