import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../theme';
import styles from './saveMoneyStyles';

export default function BudgetUtilizationSection({
  budgetUtilizationData,
  isLoading,
  monthlyBudget,
  setMonthlyBudget,
  previousSpend,
  setPreviousSpend,
  onRecalculate,
}) {
  const [showBudgetEditor, setShowBudgetEditor] = useState(false);
  const [tempBudget, setTempBudget] = useState(String(monthlyBudget || '3000'));
  const [tempPrev, setTempPrev] = useState(String(previousSpend || '1800'));

  const budget = budgetUtilizationData;
  const monthlyLimit = budget?.monthly_budget ?? parseFloat(monthlyBudget) ?? 3000;
  const totalSpent = budget?.total_spent ?? (parseFloat(previousSpend) || 1800);
  const remaining = budget?.remaining_budget ?? budget?.remaining ?? (monthlyLimit - totalSpent);
  const rawPct = budget?.utilization_percentage ?? budget?.utilization ?? (monthlyLimit > 0 ? Math.round((totalSpent / monthlyLimit) * 100) : 0);
  const pct = Math.min(Math.max(rawPct, 0), 100);

  const radius = 60;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  const status = budget?.status || (rawPct > 100 ? 'EXCEEDED' : rawPct >= 90 ? 'CRITICAL' : rawPct >= 75 ? 'WARNING' : 'SAFE');

  const statusColor =
    status === 'EXCEEDED'
      ? '#D32F2F'
      : status === 'CRITICAL'
      ? '#E65100'
      : status === 'WARNING'
      ? '#F57C00'
      : '#2E7D32';

  const handleApply = () => {
    setMonthlyBudget(tempBudget);
    setPreviousSpend(tempPrev);
    setShowBudgetEditor(false);
    if (onRecalculate) {
      onRecalculate(tempBudget, tempPrev);
    }
  };

  return (
    <View style={styles.insightItemExtravagant}>
      {/* Header */}
      <View style={styles.insightHeaderExtravagant}>
        <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
          <Feather name="target" size={20} color="#2E7D32" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.insightTitleExtravagant}>Budget Utilization & Goals</Text>
            <TouchableOpacity
              onPress={() => setShowBudgetEditor(!showBudgetEditor)}
              style={styles.smEditBudgetBtn}
            >
              <Feather name="edit-2" size={12} color={COLORS.primary} />
              <Text style={styles.smEditBudgetBtnText}>Edit Goal</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionSubtitle}>
            SM-03: Real-time tracking against your target budget and spending threshold warnings.
          </Text>
        </View>
      </View>

      {/* Inline Budget Editor */}
      {showBudgetEditor && (
        <View style={styles.smBudgetEditorBox}>
          <Text style={styles.smBudgetEditorLabel}>Target Monthly Budget (₹):</Text>
          <TextInput
            style={styles.smBudgetInput}
            value={tempBudget}
            onChangeText={setTempBudget}
            keyboardType="numeric"
            placeholder="e.g. 5000"
          />

          <Text style={[styles.smBudgetEditorLabel, { marginTop: 8 }]}>
            Previous Spend This Month (₹):
          </Text>
          <TextInput
            style={styles.smBudgetInput}
            value={tempPrev}
            onChangeText={setTempPrev}
            keyboardType="numeric"
            placeholder="e.g. 1800"
          />

          <TouchableOpacity style={styles.smBudgetApplyBtn} onPress={handleApply}>
            <Text style={styles.smBudgetApplyBtnText}>Apply & Recalculate</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <View style={styles.smLoadingBox}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.smLoadingText}>Calculating budget utilization...</Text>
        </View>
      ) : (
        <>
          {/* Gauge & Key Stats */}
          <View style={styles.smBudgetRow}>
            {/* SVG Circular Progress Gauge */}
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={140} height={140} viewBox="0 0 140 140">
                <Defs>
                  <LinearGradient id="budgetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor={statusColor} />
                    <Stop offset="100%" stopColor={statusColor} />
                  </LinearGradient>
                </Defs>
                {/* Background Ring */}
                <Circle cx="70" cy="70" r={radius} stroke="#F0F0F0" strokeWidth={strokeWidth} fill="none" />
                {/* Progress Ring */}
                <Circle
                  cx="70"
                  cy="70"
                  r={radius}
                  stroke="url(#budgetGrad)"
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform="rotate(-90 70 70)"
                />
              </Svg>
              <View style={styles.smGaugeInside}>
                <Text style={[styles.smGaugePct, { color: statusColor }]}>{rawPct}%</Text>
                <Text style={styles.smGaugeSubLabel}>used</Text>
              </View>
            </View>

            {/* Stat Cards */}
            <View style={styles.smBudgetStats}>
              <View style={styles.smBudgetStatItem}>
                <Text style={styles.smStatLabel}>Monthly Limit</Text>
                <Text style={styles.smStatValue}>₹{monthlyLimit.toLocaleString()}</Text>
              </View>
              <View style={styles.smBudgetStatItem}>
                <Text style={styles.smStatLabel}>Total Spent (incl. Haul)</Text>
                <Text style={[styles.smStatValue, { color: statusColor }]}>
                  ₹{totalSpent.toLocaleString()}
                </Text>
              </View>
              <View style={styles.smBudgetStatItem}>
                <Text style={styles.smStatLabel}>Remaining Balance</Text>
                <Text style={[styles.smStatValue, { color: remaining < 0 ? '#D32F2F' : '#2E7D32' }]}>
                  ₹{remaining.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          {/* Status Alert Banner */}
          <View
            style={[
              styles.smStatusBanner,
              {
                backgroundColor:
                  status === 'EXCEEDED'
                    ? '#FFEBEE'
                    : status === 'CRITICAL'
                    ? '#FFF3E0'
                    : status === 'WARNING'
                    ? '#FFF8E1'
                    : '#E8F5E9',
                borderColor: statusColor,
              },
            ]}
          >
            <Text style={[styles.smStatusBannerText, { color: statusColor }]}>
              {status === 'EXCEEDED' && '🚨 Budget Exceeded! Spending has exceeded your monthly target limit.'}
              {status === 'CRITICAL' && '⚠️ Critical Alert! Over 90% of your monthly budget is used.'}
              {status === 'WARNING' && '⚡ Warning: Over 75% of your monthly budget has been consumed.'}
              {status === 'SAFE' && '✅ Great job! Your spending is well within your monthly budget goal.'}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}
