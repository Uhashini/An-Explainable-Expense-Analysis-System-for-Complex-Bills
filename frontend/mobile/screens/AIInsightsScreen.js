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
});
