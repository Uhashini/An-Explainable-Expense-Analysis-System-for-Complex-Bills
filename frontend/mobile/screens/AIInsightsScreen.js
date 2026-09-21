import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import ScreenLayout from '../components/ScreenLayout';
import { COLORS, FONTS } from '../theme';
import { API_BASE_URL } from '../utils/apiConfig';
import { getUser } from '../utils/authStorage';

// ─── Mode Views (Separated into dedicated mode folders) ─────────────────────
import SaveMoneyView, { calculateSaveMoneyMetrics } from '../modes/save_money';
import EatHealthyView, { calculateMetricsFromReceipt, getDefaultNutritionData } from '../modes/eat_healthy';
import GainMuscleView from '../modes/gain_muscle';

const MODES = ['Save Money', 'Eat Healthy', 'Gain Muscle'];

const extractItemsFromSource = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.receipt_info?.items)) return data.receipt_info.items;
  if (Array.isArray(data.data?.receipt_info?.items)) return data.data.receipt_info.items;
  if (Array.isArray(data.data?.items)) return data.data.items;
  if (Array.isArray(data.receipt?.items)) return data.receipt.items;
  return [];
};

export default function AIInsightsScreen({ route, navigation }) {
  const { receiptId, receiptData, initialMode } = route.params || {};

  const [activeMode, setActiveMode] = useState(initialMode || 'Save Money');
  const [healthySubOption, setHealthySubOption] = useState('Basic Nutrition Analysis');
  const [comparisonViewMode, setComparisonViewMode] = useState('Cards'); // 'Cards' | 'Chart'
  const [nutritionData, setNutritionData] = useState(() => {
    const initItems = extractItemsFromSource(receiptData);
    if (initItems.length > 0) {
      return calculateMetricsFromReceipt(receiptData);
    }
    return getDefaultNutritionData();
  });
  const [savedReceiptsList, setSavedReceiptsList] = useState([]);

  // Save Money state
  const [monthlyBudget, setMonthlyBudget] = useState('3000');
  const [previousSpend, setPreviousSpend] = useState('1800');
  const [saveMoneyData, setSaveMoneyData] = useState(() => {
    const initItems = extractItemsFromSource(receiptData);
    return calculateSaveMoneyMetrics(initItems, 3000, 1800);
  });
  const [isLoadingSaveMoney, setIsLoadingSaveMoney] = useState(false);

  const fetchSaveMoneyAnalysis = async (customItems = null, budgetVal = monthlyBudget, prevVal = previousSpend) => {
    const items = customItems || extractItemsFromSource(receiptData) || route.params?.items || [];
    if (!items || items.length === 0) return;

    // Immediately update local calculations for instantaneous feedback
    const instantMetrics = calculateSaveMoneyMetrics(items, budgetVal, prevVal);
    setSaveMoneyData((prev) => ({
      ...instantMetrics,
      ...(prev || {}),
      category_spending: instantMetrics.category_spending,
      item_breakdown: instantMetrics.item_breakdown,
      budget_utilization: instantMetrics.budget_utilization,
    }));

    setIsLoadingSaveMoney(true);
    try {
      const user = await getUser();
      const userId = user?.id || 1;

      const formattedItems = items.map((item) => {
        const qty = parseFloat(String(item.quantity || item.qty || '1').replace(/[^0-9.]/g, '')) || 1;
        let unitPrice = null;
        let totalPrice = null;

        if (item.rate !== undefined && item.rate !== null) {
          unitPrice = parseFloat(String(item.rate).replace(/[^0-9.]/g, '')) || null;
        } else if (item.unit_price !== undefined && item.unit_price !== null) {
          unitPrice = parseFloat(String(item.unit_price).replace(/[^0-9.]/g, '')) || null;
        }

        if (item.total_price !== undefined && item.total_price !== null) {
          totalPrice = parseFloat(String(item.total_price).replace(/[^0-9.]/g, '')) || null;
        } else if (item.price !== undefined && item.price !== null) {
          totalPrice = parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || null;
        }

        if (totalPrice !== null && unitPrice === null) {
          unitPrice = qty > 0 ? totalPrice / qty : totalPrice;
        } else if (unitPrice !== null && totalPrice === null) {
          totalPrice = unitPrice * qty;
        } else if (unitPrice === null && totalPrice === null) {
          unitPrice = 0;
          totalPrice = 0;
        }

        return {
          name: item.name || item.matched_name || item.display_name || 'Item',
          category: item.category || 'Uncategorized',
          unit_price: unitPrice,
          price: unitPrice,
          total_price: totalPrice,
          quantity: qty,
          matched_food_id: item.matched_food_id || item.food_id || null,
        };
      });

      const response = await fetch(`${API_BASE_URL}/receipts/analyze-save-money`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: formattedItems,
          monthly_budget: parseFloat(budgetVal) || 0,
          previous_spend: parseFloat(prevVal) || 0,
          user_id: userId,
        }),
      });

      const data = await response.json();
      if (response.ok && data.status === 'success' && data.data) {
        setSaveMoneyData(data.data);
      }
    } catch (err) {
      console.error('Error fetching save money analysis from backend:', err);
    } finally {
      setIsLoadingSaveMoney(false);
    }
  };

  const fetchReceiptNutrition = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/receipts/${id}`);
      const json = await response.json();
      if (response.ok && json.status === 'success') {
        const receiptObj = json.data?.receipt_info || json.data || json.receipt || json;
        const metrics = calculateMetricsFromReceipt(receiptObj);
        setNutritionData(metrics);
        const extracted = extractItemsFromSource(receiptObj);
        if (extracted.length > 0) {
          fetchSaveMoneyAnalysis(extracted);
        }
      } else {
        setNutritionData(getDefaultNutritionData());
      }
    } catch (e) {
      console.warn('Backend receipt fetch error, using calculated metrics:', e);
      setNutritionData(getDefaultNutritionData());
    }
  };

  const fetchUserSavedReceipts = async () => {
    try {
      const user = await getUser();
      const userId = user?.id || 1;
      const response = await fetch(`${API_BASE_URL}/receipts/user/${userId}`);
      const json = await response.json();
      if (response.ok && json.status === 'success' && Array.isArray(json.receipts)) {
        setSavedReceiptsList(json.receipts);
        if (!receiptId && !receiptData && json.receipts.length > 0) {
          fetchReceiptNutrition(json.receipts[0].receipt_id);
        }
      }
    } catch (err) {
      console.log('Error fetching user receipts list:', err);
    }
  };

  useEffect(() => {
    fetchUserSavedReceipts();
    if (receiptId) {
      fetchReceiptNutrition(receiptId);
    } else if (receiptData) {
      const metrics = calculateMetricsFromReceipt(receiptData);
      setNutritionData(metrics);
      const items = extractItemsFromSource(receiptData);
      if (items.length > 0) {
        fetchSaveMoneyAnalysis(items);
      }
    } else {
      setNutritionData(getDefaultNutritionData());
    }
  }, [receiptId, receiptData]);

  const renderContent = () => {
    const modeKey = (activeMode || '').toLowerCase();

    if (modeKey.includes('save') || modeKey.includes('money')) {
      return (
        <SaveMoneyView
          receiptId={receiptId}
          saveMoneyData={saveMoneyData}
          isLoadingSaveMoney={isLoadingSaveMoney}
          monthlyBudget={monthlyBudget}
          setMonthlyBudget={setMonthlyBudget}
          previousSpend={previousSpend}
          setPreviousSpend={setPreviousSpend}
          onRecalculateBudget={(b, p) => fetchSaveMoneyAnalysis(null, b, p)}
        />
      );
    }

    if (modeKey.includes('eat') || modeKey.includes('health')) {
      return (
        <EatHealthyView
          nutritionData={nutritionData}
          healthySubOption={healthySubOption}
          setHealthySubOption={setHealthySubOption}
          comparisonViewMode={comparisonViewMode}
          setComparisonViewMode={setComparisonViewMode}
          savedReceiptsList={savedReceiptsList}
        />
      );
    }

    if (modeKey.includes('gain') || modeKey.includes('muscle')) {
      return (
        <GainMuscleView
          navigation={navigation}
          receiptData={receiptData}
          nutritionData={nutritionData}
        />
      );
    }

    return (
      <SaveMoneyView
        receiptId={receiptId}
        saveMoneyData={saveMoneyData}
        isLoadingSaveMoney={isLoadingSaveMoney}
        monthlyBudget={monthlyBudget}
        setMonthlyBudget={setMonthlyBudget}
        previousSpend={previousSpend}
        setPreviousSpend={setPreviousSpend}
        onRecalculateBudget={(b, p) => fetchSaveMoneyAnalysis(null, b, p)}
      />
    );
  };

  return (
    <ScreenLayout title="AI Spending Analytics" showBack={true} navigation={navigation}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Mode Selector Tab Row */}
        <View style={styles.timeFilterRow}>
          {MODES.map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setActiveMode(mode)}
              style={[styles.timeChip, activeMode === mode && styles.timeChipActive]}
            >
              <Text style={[styles.timeChipText, activeMode === mode && styles.timeChipTextActive]}>
                {mode}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {renderContent()}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  timeFilterRow: {
    flexDirection: 'row',
    backgroundColor: '#FAF8F5',
    borderRadius: 30,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ede8e0',
  },
  timeChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 24,
  },
  timeChipActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  timeChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#8A857D',
  },
  timeChipTextActive: {
    color: '#fff',
    fontFamily: FONTS.bold,
  },
  insightHighlightBox: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  insightIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  insightHighlightIcon: {
    fontSize: 20,
  },
  insightHighlightText: {
    flex: 1,
  },
  insightHighlightTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    marginBottom: 2,
  },
  insightHighlightSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#4A3B32',
    lineHeight: 17,
  },
  sectionHeaderTitle: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
    letterSpacing: 1.5,
    marginTop: 8,
    marginBottom: 10,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: Platform.OS === 'web' ? '31.8%' : '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderTopWidth: 4,
    borderWidth: 1,
    borderColor: 'rgba(153, 8, 8, 0.05)',
  },
  metricCardTop: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIcon: {
    fontSize: 18,
  },
  rdiBadge: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#F57C00',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  metricValue: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.primary,
  },
  metricUnit: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.mutedText,
  },
  metricLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.mutedText,
    marginTop: 2,
    marginBottom: 10,
  },
  miniProgressBg: {
    width: '100%',
    height: 5,
    borderRadius: 3,
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  energyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  energyCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  energyVal: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    marginBottom: 2,
  },
  energyLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
  },
  energySub: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.mutedText,
    marginTop: 2,
  },
  itemTable: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EDE7F6',
  },
  itemTableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  itemHeadText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#fff',
  },
  itemTableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemBodyText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.primary,
  },
  itemSubText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.mutedText,
  },
  itemColName: { flex: 2.2 },
  itemColCat: { flex: 1.8 },
  itemColCal: { flex: 1.2, textAlign: 'center' },
  itemColProt: { flex: 1.2, textAlign: 'center' },
  itemColTag: { flex: 1.6, alignItems: 'flex-end' },
  itemTypeBadge: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  recommendationRow: {
    flexDirection: 'row',
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    alignItems: 'flex-start',
  },
  recIcon: {
    fontSize: 22,
    marginRight: 12,
    marginTop: 2,
  },
  recTextCol: {
    flex: 1,
  },
  recTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#E65100',
    marginBottom: 3,
  },
  recDesc: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#4A3B32',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(153, 8, 8, 0.05)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgePillText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#2E7D32',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  cardHeaderTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.primary,
    marginBottom: 14,
  },
  cardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.primary,
  },
  cardSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.mutedText,
    marginBottom: 14,
    marginTop: 2,
  },
  progressContainer: {
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E8E8E8',
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBar: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPctInside: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#fff',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.mutedText,
  },
  macroBarContainer: {
    height: 16,
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 14,
  },
  macroSegment: {
    height: '100%',
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macroDotCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  macroText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.mutedText,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
    alignItems: 'center',
    marginBottom: 6,
  },
  gainMuscleNavBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  gainMuscleNavBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#fff',
    letterSpacing: 0.5,
  },
  trendBadgePill: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  trendBadgePillText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#1976D2',
    letterSpacing: 0.5,
  },
  viewModeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F0F4FA',
    borderRadius: 8,
    padding: 2,
  },
  viewModeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  viewModeBtnActive: {
    backgroundColor: COLORS.primary,
  },
  viewModeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  viewModeTextActive: {
    color: '#fff',
    fontFamily: FONTS.bold,
  },

  growthSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  growthSummaryIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  growthSummaryTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#2E7D32',
    marginBottom: 2,
  },

  creativeCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  creativeReceiptCard: {
    width: Platform.OS === 'web' ? '18.8%' : '48%',
    backgroundColor: '#FAF8F5',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFEBE4',
  },
  creativeReceiptCardLatest: {
    backgroundColor: '#F1F8F3',
    borderColor: '#A5D6A7',
    borderWidth: 1.5,
  },
  rcTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rcHeaderBadge: {
    backgroundColor: 'rgba(153, 8, 8, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rcIconText: {
    fontFamily: FONTS.bold,
    fontSize: 8,
    color: COLORS.primary,
  },
  rcGradePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rcGradeText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
  },
  rcStoreName: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
    marginBottom: 2,
  },
  rcSubText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.mutedText,
    marginBottom: 8,
  },
  rcMeterBg: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
    overflow: 'hidden',
  },
  rcMeterFill: {
    height: '100%',
    borderRadius: 3,
  },

  chartBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 12,
  },
  chartBarCol: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBarVal: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    marginBottom: 4,
  },
  chartBarBg: {
    width: 22,
    height: 85,
    backgroundColor: '#F0F4FA',
    borderRadius: 11,
    justify: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 11,
  },
  chartBarLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    marginTop: 8,
  },
  chartBarSubLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.mutedText,
    marginTop: 2,
  },
  title: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.primary },
  subtitle: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.mutedText, marginBottom: 16 },
  insightItem: { flexDirection: 'row', marginBottom: 16 },
  insightIcon: { fontSize: 24, marginRight: 12 },
  insightTextContainer: { flex: 1 },
  insightTitle: { fontFamily: FONTS.bold, fontSize: 14, color: '#3a2020', marginBottom: 4 },
  insightDesc: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.mutedText, lineHeight: 18 },

  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f5f6fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  insightTitleExtravagant: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.primary,
  },
  insightDescExtravagant: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.mutedText,
    lineHeight: 18,
  },

  // Save Money Styles
  smLoadingBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  smLoadingText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.primary,
  },
  smCardBadge: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    backgroundColor: 'rgba(148, 182, 239, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  smStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeSuccess: {
    backgroundColor: '#E8F5E9',
  },
  statusBadgeWarning: {
    backgroundColor: '#FFF3E0',
  },
  statusBadgeDanger: {
    backgroundColor: '#FFEBEE',
  },
  smStatusBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
  },
  smMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(148, 182, 239, 0.08)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  smMetricBox: {
    alignItems: 'center',
    flex: 1,
  },
  smMetricLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: 'rgba(153,8,8,0.6)',
    marginBottom: 2,
  },
  smMetricValue: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },
  smProgressWrapper: {
    marginBottom: 10,
  },
  smProgressBarBg: {
    height: 8,
    backgroundColor: 'rgba(148, 182, 239, 0.25)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  smProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  smProgressLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: 'rgba(153,8,8,0.7)',
    textAlign: 'right',
  },
  smConfigToggle: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  smConfigToggleText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  smEditorBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: 'rgba(148, 182, 239, 0.08)',
    borderRadius: 8,
    gap: 8,
  },
  smEditorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smEditorLabel: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.primary,
  },
  smEditorInput: {
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(153,8,8,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 80,
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
    textAlign: 'right',
  },
  smRecalcButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  smRecalcButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#fff',
  },
  smHighlightBanner: {
    backgroundColor: 'rgba(25, 118, 210, 0.08)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  smHighlightLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: 'rgba(153,8,8,0.6)',
    marginBottom: 2,
  },
  smHighlightValue: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },
  smCategoryList: {
    gap: 10,
  },
  smCategoryRow: {
    gap: 4,
  },
  smCategoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smCategoryName: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.primary,
  },
  smCategoryAmount: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
  },
  smCategoryPct: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: 'rgba(153,8,8,0.5)',
  },
  smCatBarBg: {
    height: 6,
    backgroundColor: 'rgba(148, 182, 239, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  smCatBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  smRankedList: {
    gap: 8,
  },
  smRankedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(148, 182, 239, 0.06)',
    borderRadius: 8,
  },
  smRankBadge: {
    width: 26,
    height: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  smRankBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#fff',
  },
  smRankedName: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.primary,
  },
  smRankedPrice: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  trendBadgePill: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  trendBadgePillText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#1976D2',
    letterSpacing: 0.5,
  },
  viewModeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F0F4FA',
    borderRadius: 8,
    padding: 2,
  },
  viewModeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  viewModeBtnActive: {
    backgroundColor: COLORS.primary,
  },
  viewModeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  viewModeTextActive: {
    color: '#fff',
    fontFamily: FONTS.bold,
  },

  growthSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  growthSummaryIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  growthSummaryTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#2E7D32',
    marginBottom: 2,
  },
  growthSummarySub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#1B5E20',
  },

  creativeCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  creativeReceiptCard: {
    width: Platform.OS === 'web' ? '18.8%' : '48%',
    backgroundColor: '#FAF8F5',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EFEBE4',
  },
  creativeReceiptCardLatest: {
    backgroundColor: '#F1F8F3',
    borderColor: '#A5D6A7',
    borderWidth: 1.5,
  },
  rcTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rcHeaderBadge: {
    backgroundColor: 'rgba(153, 8, 8, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rcIconText: {
    fontFamily: FONTS.bold,
    fontSize: 8,
    color: COLORS.primary,
  },
  rcGradePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rcGradeText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
  },
  rcStoreName: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
    marginBottom: 2,
  },
  rcSubText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.mutedText,
    marginBottom: 8,
  },
  rcMeterBg: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
    overflow: 'hidden',
  },
  rcMeterFill: {
    height: '100%',
    borderRadius: 3,
  },

  chartBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 12,
  },
  chartBarCol: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBarVal: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    marginBottom: 4,
  },
  chartBarBg: {
    width: 22,
    height: 85,
    backgroundColor: '#F0F4FA',
    borderRadius: 11,
    justify: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 11,
  },
  chartBarLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    marginTop: 8,
  },
  chartBarSubLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.mutedText,
    marginTop: 2,
  },
  title: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.primary },
  subtitle: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.mutedText, marginBottom: 16 },
  insightItem: { flexDirection: 'row', marginBottom: 16 },
  insightIcon: { fontSize: 24, marginRight: 12 },
  insightTextContainer: { flex: 1 },
  insightTitle: { fontFamily: FONTS.bold, fontSize: 14, color: '#3a2020', marginBottom: 4 },
  insightDesc: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.mutedText, lineHeight: 18 },

  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f5f6fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  insightTitleExtravagant: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.primary,
  },
  insightDescExtravagant: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.mutedText,
    lineHeight: 18,
  },

  // Save Money Styles
  smLoadingBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  smLoadingText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.primary,
  },
  smCardBadge: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    backgroundColor: 'rgba(148, 182, 239, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  smStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeSuccess: {
    backgroundColor: '#E8F5E9',
  },
  statusBadgeWarning: {
    backgroundColor: '#FFF3E0',
  },
  statusBadgeDanger: {
    backgroundColor: '#FFEBEE',
  },
  smStatusBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
  },
  smMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(148, 182, 239, 0.08)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  smMetricBox: {
    alignItems: 'center',
    flex: 1,
  },
  smMetricLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: 'rgba(153,8,8,0.6)',
    marginBottom: 2,
  },
  smMetricValue: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },
  smProgressWrapper: {
    marginBottom: 10,
  },
  smProgressBarBg: {
    height: 8,
    backgroundColor: 'rgba(148, 182, 239, 0.25)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  smProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  smProgressLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: 'rgba(153,8,8,0.7)',
    textAlign: 'right',
  },
  smConfigToggle: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  smConfigToggleText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  smEditorBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: 'rgba(148, 182, 239, 0.08)',
    borderRadius: 8,
    gap: 8,
  },
  smEditorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smEditorLabel: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.primary,
  },
  smEditorInput: {
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(153,8,8,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 80,
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
    textAlign: 'right',
  },
  smRecalcButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  smRecalcButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#fff',
  },
  smHighlightBanner: {
    backgroundColor: 'rgba(25, 118, 210, 0.08)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  smHighlightLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: 'rgba(153,8,8,0.6)',
    marginBottom: 2,
  },
  smHighlightValue: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },
  smCategoryList: {
    gap: 10,
  },
  smCategoryRow: {
    gap: 4,
  },
  smCategoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smCategoryName: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.primary,
  },
  smCategoryAmount: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
  },
  smCategoryPct: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: 'rgba(153,8,8,0.5)',
  },
  smCatBarBg: {
    height: 6,
    backgroundColor: 'rgba(148, 182, 239, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  smCatBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  smRankedList: {
    gap: 8,
  },
  smRankedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(148, 182, 239, 0.06)',
    borderRadius: 8,
  },
  smRankBadge: {
    width: 26,
    height: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  smRankBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#fff',
  },
  smRankedName: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.primary,
  },
  smRankedPrice: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
  },
>>>>>>> 2e8ab8594af6e726aa168a46a9e34c231121c90d
});
