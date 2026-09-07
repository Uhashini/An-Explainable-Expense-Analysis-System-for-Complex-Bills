import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import CategorySpendingSection from './CategorySpendingSection';
import ItemBreakdownSection from './ItemBreakdownSection';
import BudgetUtilizationSection from './BudgetUtilizationSection';
import SpendingTrendSection from './SpendingTrendSection';
import PriceDeviationSection from './PriceDeviationSection';
import CategoryOverspendingSection from './CategoryOverspendingSection';
import PurchaseFrequencySection from './PurchaseFrequencySection';
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
  const categorySpending = saveMoneyData?.category_spending;
  const itemBreakdown = saveMoneyData?.item_breakdown;
  const budgetUtilization = saveMoneyData?.budget_utilization;
  const spendingTrend = saveMoneyData?.spending_trend;
  const priceDeviation = saveMoneyData?.price_deviation;
  const categoryAnomalies = saveMoneyData?.category_anomalies;
  const purchaseFrequency = saveMoneyData?.purchase_frequency;

  const totalSpend =
    categorySpending?.total_spending ??
    categorySpending?.total_spend ??
    budgetUtilization?.current_receipt_total ??
    0;

  const highestCat =
    categorySpending?.highest_category?.category ||
    categorySpending?.highest_category?.category_name ||
    'N/A';

  const budgetStatus = budgetUtilization?.status || 'SAFE';

  return (
    <View style={styles.maxWidthWrapper}>
      {/* Overview Ribbon Card */}
      <View style={styles.purposeCard}>
        <View style={styles.badgeRow}>
          <Text style={styles.purposeBadge}>SAVE MONEY INTELLIGENCE</Text>
          <View style={[styles.subBadge, { backgroundColor: '#E8F5E9' }]}>
            <Text style={[styles.subBadgeText, { color: '#2E7D32' }]}>
              {receiptId ? `Receipt #${receiptId}` : 'Current Grocery Haul'}
            </Text>
          </View>
        </View>

        <Text style={styles.purposeTitle}>
          Expense Intelligence & Budget Optimization
        </Text>
        <Text style={styles.purposeDesc}>
          Comprehensive 7-point financial audit including category distribution, cost ranking, goal tracking, ML overspend detection, and price inflation benchmarks.
        </Text>

        {/* Quick KPI Stat Ribbon */}
        <View style={[styles.metricsGrid, { marginTop: 16 }]}>
          <View style={styles.metricCard}>
            <View style={styles.metricCardTop}>
              <View style={[styles.metricIconBg, { backgroundColor: '#E3F2FD' }]}>
                <Feather name="shopping-bag" size={18} color="#1976D2" />
              </View>
              <Text style={styles.rdiBadge}>SM-01</Text>
            </View>
            <Text style={styles.metricValue}>₹{totalSpend.toLocaleString()}</Text>
            <Text style={styles.metricLabel}>Total Spend</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricCardTop}>
              <View style={[styles.metricIconBg, { backgroundColor: '#FFF3E0' }]}>
                <Feather name="pie-chart" size={18} color="#F57C00" />
              </View>
              <Text style={[styles.rdiBadge, { backgroundColor: '#FFF3E0', color: '#F57C00' }]}>Top Cat</Text>
            </View>
            <Text style={[styles.metricValue, { fontSize: 16 }]} numberOfLines={1}>
              {highestCat}
            </Text>
            <Text style={styles.metricLabel}>Highest Spend Area</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricCardTop}>
              <View
                style={[
                  styles.metricIconBg,
                  {
                    backgroundColor:
                      budgetStatus === 'SAFE'
                        ? '#E8F5E9'
                        : budgetStatus === 'WARNING'
                        ? '#FFF8E1'
                        : '#FFEBEE',
                  },
                ]}
              >
                <Feather
                  name="shield"
                  size={18}
                  color={
                    budgetStatus === 'SAFE'
                      ? '#2E7D32'
                      : budgetStatus === 'WARNING'
                      ? '#F57C00'
                      : '#D32F2F'
                  }
                />
              </View>
              <Text
                style={[
                  styles.rdiBadge,
                  {
                    backgroundColor:
                      budgetStatus === 'SAFE'
                        ? '#E8F5E9'
                        : budgetStatus === 'WARNING'
                        ? '#FFF8E1'
                        : '#FFEBEE',
                    color:
                      budgetStatus === 'SAFE'
                        ? '#2E7D32'
                        : budgetStatus === 'WARNING'
                        ? '#F57C00'
                        : '#D32F2F',
                  },
                ]}
              >
                {budgetStatus}
              </Text>
            </View>
            <Text style={styles.metricValue}>
              {budgetUtilization?.utilization_percentage ?? budgetUtilization?.utilization ?? 0}%
            </Text>
            <Text style={styles.metricLabel}>Budget Used</Text>
          </View>
        </View>
      </View>

      {/* Structured Sections Flow */}
      <View style={[styles.contentContainer, { marginTop: 16 }]}>
        {/* SM-01: Category-wise Spending Distribution */}
        <CategorySpendingSection
          categorySpendingData={categorySpending}
          isLoading={isLoadingSaveMoney}
        />

        {/* SM-02: Item-wise Spending Breakdown */}
        <ItemBreakdownSection
          itemBreakdownData={itemBreakdown}
          isLoading={isLoadingSaveMoney}
        />

        {/* SM-03: Budget Utilization & Goal Setting */}
        <BudgetUtilizationSection
          budgetUtilizationData={budgetUtilization}
          isLoading={isLoadingSaveMoney}
          monthlyBudget={monthlyBudget}
          setMonthlyBudget={setMonthlyBudget}
          previousSpend={previousSpend}
          setPreviousSpend={setPreviousSpend}
          onRecalculate={onRecalculateBudget}
        />

        {/* SM-04: Weekly / Monthly Spending Trend */}
        <SpendingTrendSection
          spendingTrendData={spendingTrend}
          isLoading={isLoadingSaveMoney}
        />

        {/* SM-05: Price Deviation Analysis */}
        <PriceDeviationSection
          priceDeviationData={priceDeviation}
          isLoading={isLoadingSaveMoney}
        />

        {/* SM-06: Category Overspending (Isolation Forest + SHAP) */}
        <CategoryOverspendingSection
          categoryAnomaliesData={categoryAnomalies}
          isLoading={isLoadingSaveMoney}
        />

        {/* SM-07: Purchase Frequency & Staples */}
        <PurchaseFrequencySection
          purchaseFrequencyData={purchaseFrequency}
          isLoading={isLoadingSaveMoney}
        />
      </View>
    </View>
  );
}
