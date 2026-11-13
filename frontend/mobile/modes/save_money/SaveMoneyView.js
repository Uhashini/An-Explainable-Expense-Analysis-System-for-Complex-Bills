import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import CategorySpendingSection from './CategorySpendingSection';
import ItemBreakdownSection from './ItemBreakdownSection';
import BudgetUtilizationSection from './BudgetUtilizationSection';
import SpendingTrendSection from './SpendingTrendSection';
import PriceDeviationSection from './PriceDeviationSection';
import CategoryOverspendingSection from './CategoryOverspendingSection';
import PurchaseFrequencySection from './PurchaseFrequencySection';

import AnalyticsStoryDeck from '../../components/AnalyticsStoryDeck';
import { COLORS, FONTS } from '../../theme';
import styles from './saveMoneyStyles';

export default function SaveMoneyView({
  receiptId,
  saveMoneyData,
  isLoadingSaveMoney,
  monthlyBudget,
  setMonthlyBudget,
  previousSpend,
  setPreviousSpend,
  onRecalculateBudget,
}) {
  const [viewMode, setViewMode] = useState('deck'); // 'deck' | 'list'

  const categorySpending = saveMoneyData?.category_spending;
  const itemBreakdown = saveMoneyData?.item_breakdown;
  const budgetUtilization = saveMoneyData?.budget_utilization;
  const spendingTrend = saveMoneyData?.spending_trend;
  const priceDeviation = saveMoneyData?.price_deviation;
  const categoryAnomalies = saveMoneyData?.category_anomalies;
  const purchaseFrequency = saveMoneyData?.purchase_frequency;

  // ─── The EXACT 7 Analytics Sections Placed Directly Into The Story Deck ───
  const storyCards = [
    // Slide 1: SM-01 Category-wise Spending Distribution
    <CategorySpendingSection
      key="sm-01"
      categorySpendingData={categorySpending}
      isLoading={isLoadingSaveMoney}
    />,

    // Slide 2: SM-02 Item-wise Spending Breakdown
    <ItemBreakdownSection
      key="sm-02"
      itemBreakdownData={itemBreakdown}
      isLoading={isLoadingSaveMoney}
    />,

    // Slide 3: SM-03 Budget Utilization & Goal Setting
    <BudgetUtilizationSection
      key="sm-03"
      budgetUtilizationData={budgetUtilization}
      isLoading={isLoadingSaveMoney}
      monthlyBudget={monthlyBudget}
      setMonthlyBudget={setMonthlyBudget}
      previousSpend={previousSpend}
      setPreviousSpend={setPreviousSpend}
      onRecalculate={onRecalculateBudget}
    />,

    // Slide 4: SM-04 Weekly / Monthly Spending Trend
    <SpendingTrendSection
      key="sm-04"
      spendingTrendData={spendingTrend}
      isLoading={isLoadingSaveMoney}
    />,

    // Slide 5: SM-05 Price Deviation Analysis
    <PriceDeviationSection
      key="sm-05"
      priceDeviationData={priceDeviation}
      isLoading={isLoadingSaveMoney}
    />,

    // Slide 6: SM-06 Category Overspending (ML Isolation Forest + SHAP)
    <CategoryOverspendingSection
      key="sm-06"
      categoryAnomaliesData={categoryAnomalies}
      isLoading={isLoadingSaveMoney}
    />,

    // Slide 7: SM-07 Purchase Frequency & Staples
    <PurchaseFrequencySection
      key="sm-07"
      purchaseFrequencyData={purchaseFrequency}
      isLoading={isLoadingSaveMoney}
    />,
  ];

  return (
    <View style={styles.maxWidthWrapper}>
      {/* ── View Mode Switcher ── */}
      <View style={viewStyles.toggleRow}>
        <TouchableOpacity
          onPress={() => setViewMode('deck')}
          style={[viewStyles.toggleBtn, viewMode === 'deck' && viewStyles.toggleBtnActive]}
          activeOpacity={0.8}
        >
          <Feather name="layers" size={13} color={viewMode === 'deck' ? '#FFFFFF' : '#7A7265'} />
          <Text style={[viewStyles.toggleText, viewMode === 'deck' && viewStyles.toggleTextActive]}>
            Story Deck
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setViewMode('list')}
          style={[viewStyles.toggleBtn, viewMode === 'list' && viewStyles.toggleBtnActive]}
          activeOpacity={0.8}
        >
          <Feather name="list" size={13} color={viewMode === 'list' ? '#FFFFFF' : '#7A7265'} />
          <Text style={[viewStyles.toggleText, viewMode === 'list' && viewStyles.toggleTextActive]}>
            Full Audit Feed
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Content View ── */}
      {viewMode === 'deck' ? (
        <AnalyticsStoryDeck
          cards={storyCards}
          initialIndex={0}
        />
      ) : (
        /* ── Full Audit Feed Mode ── */
        <View style={[styles.contentContainer, { marginTop: 12 }]}>
          <CategorySpendingSection
            categorySpendingData={categorySpending}
            isLoading={isLoadingSaveMoney}
          />
          <ItemBreakdownSection
            itemBreakdownData={itemBreakdown}
            isLoading={isLoadingSaveMoney}
          />
          <BudgetUtilizationSection
            budgetUtilizationData={budgetUtilization}
            isLoading={isLoadingSaveMoney}
            monthlyBudget={monthlyBudget}
            setMonthlyBudget={setMonthlyBudget}
            previousSpend={previousSpend}
            setPreviousSpend={setPreviousSpend}
            onRecalculate={onRecalculateBudget}
          />
          <SpendingTrendSection
            spendingTrendData={spendingTrend}
            isLoading={isLoadingSaveMoney}
          />
          <PriceDeviationSection
            priceDeviationData={priceDeviation}
            isLoading={isLoadingSaveMoney}
          />
          <CategoryOverspendingSection
            categoryAnomaliesData={categoryAnomalies}
            isLoading={isLoadingSaveMoney}
          />
          <PurchaseFrequencySection
            purchaseFrequencyData={purchaseFrequency}
            isLoading={isLoadingSaveMoney}
          />
        </View>
      )}
    </View>
  );
}

const viewStyles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAE6DC',
    borderRadius: 20,
    padding: 3,
    marginTop: 4,
    marginBottom: 8,
    alignSelf: 'center',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#8B0000',
  },
  toggleText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#7A7265',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
});
