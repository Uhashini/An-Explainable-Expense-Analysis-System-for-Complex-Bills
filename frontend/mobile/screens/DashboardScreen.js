import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Animated } from 'react-native';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  LayoutAnimation, Platform, UIManager, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenLayout from '../components/ScreenLayout';
import MonthlyBudgetCard from '../components/MonthlyBudgetCard';
import { getUser } from '../utils/authStorage';
import { authFetch, API_BASE_URL } from '../utils/apiConfig';
import { COLORS, FONTS } from '../theme';

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

function GoalCard({ tag, label, progress, detail, color, onPress }) {
  const pct = Math.round(progress * 100);
  const Container = onPress ? TouchableOpacity : View;
  return (
    <Container style={styles.goalCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.goalHeader}>
        <View style={[styles.goalTagBox, { backgroundColor: color }]}>
          <Text style={[styles.goalTag, { color: color === COLORS.accent ? COLORS.primary : '#fff' }]}>
            {tag}
          </Text>
        </View>
        <Text style={styles.goalLabel}>{label}</Text>
        <Text style={styles.goalPct}>{pct}%</Text>
        {onPress && <Text style={{ fontFamily: FONTS.bold, fontSize: 13, color: color, marginLeft: 4 }}>→</Text>}
      </View>
      <View style={styles.goalTrack}>
        <View style={[styles.goalFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.goalDetail}>{detail}</Text>
    </Container>
  );
}

// ─── Spending Forecast Card ───────────────────────────────────────────────────
function SpendingForecastCard({ data, loading, error }) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  };

  // ── Shared card shell ────────────────────────────────────────────────────
  const CardShell = ({ children }) => (
    <View style={styles.forecastCard}>
      <View style={styles.forecastHeader}>
        <View style={styles.forecastIconBox}>
          <Text style={styles.forecastIconText}>📈</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.forecastTitle}>Spending Forecast</Text>
          <Text style={styles.forecastSubtitle}>
            {data ? `${data.goal} · ${data.month} ${data.year}` : 'SAVE MONEY · THIS MONTH'}
          </Text>
        </View>
        {data && (
          <TouchableOpacity onPress={toggleExpand} activeOpacity={0.7}>
            <Text style={styles.forecastChevron}>{expanded ? '∧' : '›'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <CardShell>
        <View style={styles.forecastStateBox}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.forecastStateText}>Calculating your forecast…</Text>
        </View>
      </CardShell>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <CardShell>
        <View style={styles.forecastStateBox}>
          <Text style={styles.forecastStateIcon}>⚠️</Text>
          <Text style={styles.forecastStateText}>
            Could not load forecast. Make sure the backend is running.
          </Text>
        </View>
      </CardShell>
    );
  }

  // ── No data / no receipts yet ────────────────────────────────────────────
  if (!data || !data.hasSufficientData) {
    return (
      <CardShell>
        <View style={styles.forecastStateBox}>
          <Text style={styles.forecastStateIcon}>🧾</Text>
          <Text style={styles.forecastStateText}>
            {data?.suggestion || 'Upload your first receipt to start tracking your spending forecast.'}
          </Text>
        </View>
      </CardShell>
    );
  }

  // ── Live data ────────────────────────────────────────────────────────────
  const overBudget  = data.projectedSpend > data.budget;
  const diff        = Math.abs(data.projectedSpend - data.budget);
  const budgetPct   = Math.min((data.budgetUsedPct || 0) * 100, 100);
  const fmt         = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const overBudgetCats = (data.categories || []).filter(c => c.projected > c.budget);

  return (
    <CardShell>
      {/* Projected Spend Row */}
      <View style={styles.forecastAmountRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.forecastAmountLabel}>Projected monthly spend</Text>
          <Text style={styles.forecastAmount}>₹{fmt(data.projectedSpend)}</Text>
          <Text style={[styles.forecastAmountSub]}>
            ₹{fmt(data.currentSpend)} spent · {data.daysElapsed}/{data.daysInMonth} days
          </Text>
        </View>
        {data.budget > 0 && (
          <View style={[styles.forecastBadge, overBudget ? styles.forecastBadgeOver : styles.forecastBadgeUnder]}>
            <Text style={[styles.forecastBadgeText, { color: overBudget ? COLORS.primary : '#2E7D32' }]}>
              ₹{fmt(diff)} {overBudget ? 'over' : 'under'}
            </Text>
            <Text style={[styles.forecastBadgeSub, { color: overBudget ? COLORS.primary : '#2E7D32' }]}>
              Budget forecast
            </Text>
          </View>
        )}
      </View>

      {/* Budget Progress — only show if we have a budget baseline */}
      {data.budget > 0 && (
        <>
          <View style={styles.forecastProgressRow}>
            <Text style={styles.forecastProgressLabel}>Budget used (projected)</Text>
            <Text style={[styles.forecastProgressPct, { color: overBudget ? COLORS.primary : '#2E7D32' }]}>
              {Math.round(budgetPct)}%
            </Text>
          </View>
          <View style={styles.forecastTrack}>
            <View
              style={[
                styles.forecastFill,
                { width: `${budgetPct}%`, backgroundColor: overBudget ? COLORS.primary : '#4CAF50' },
              ]}
            />
          </View>
        </>
      )}

      {/* Pantrix Suggestion */}
      <View style={styles.forecastTip}>
        <Text style={styles.forecastTipIcon}>💡</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.forecastTipTitle}>Pantrix suggests</Text>
          <Text style={styles.forecastTipText}>{data.suggestion}</Text>
        </View>
      </View>

      {/* Expandable Category Breakdown */}
      {expanded && data.categories && data.categories.length > 0 && (
        <View style={styles.forecastCategories}>
          <Text style={styles.forecastCatTitle}>SPENDING BY CATEGORY</Text>
          {data.categories.map((cat) => {
            const catPct = cat.budget > 0
              ? Math.min((cat.projected / cat.budget) * 100, 100)
              : 100;
            const catOver = cat.projected > cat.budget && cat.budget > 0;
            return (
              <View key={cat.name} style={styles.forecastCatRow}>
                <View style={styles.forecastCatInfo}>
                  <View style={[styles.forecastCatDot, { backgroundColor: cat.color }]} />
                  <Text style={styles.forecastCatName}>{cat.name}</Text>
                  <Text style={[styles.forecastCatAmt, catOver && { color: COLORS.primary }]}>
                    ₹{fmt(cat.projected)}
                  </Text>
                </View>
                <View style={styles.forecastCatTrack}>
                  <View
                    style={[
                      styles.forecastCatFill,
                      { width: `${catPct}%`, backgroundColor: cat.color },
                    ]}
                  />
                </View>
                {cat.budget > 0 && (
                  <Text style={styles.forecastCatBudget}>
                    Budget: ₹{fmt(cat.budget)}
                  </Text>
                )}
              </View>
            );
          })}

          {/* Savings hint — only if over budget in some categories */}
          {overBudgetCats.length > 0 && (
            <View style={styles.forecastSavingsRow}>
              <Text style={styles.forecastSavingsText}>
                💰 Switching to cheaper alternatives in{' '}
                <Text style={{ fontFamily: FONTS.bold }}>{overBudgetCats.length} categor{overBudgetCats.length === 1 ? 'y' : 'ies'}</Text>
                {' '}could help you save ₹{fmt(diff)} this month.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* View full forecast toggle */}
      <TouchableOpacity style={styles.forecastViewBtn} onPress={toggleExpand} activeOpacity={0.7}>
        <Text style={styles.forecastViewBtnText}>
          {expanded ? 'Hide details ↑' : 'View full forecast →'}
        </Text>
      </TouchableOpacity>
    </CardShell>
  );
}

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Live forecast hooks ──────────────────────────────────────────────────────
function useForecast(userId, refreshTrigger) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    authFetch(`${API_BASE_URL}/analytics/forecast/${userId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId, refreshTrigger]);

  return { data, loading, error };
}

function useNutritionForecast(userId, refreshTrigger) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    authFetch(`${API_BASE_URL}/analytics/nutrition-forecast/${userId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId, refreshTrigger]);

  return { data, loading, error };
}

function useSpendingData(userId, refreshTrigger) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);

    fetch(`${API_BASE_URL}/analytics/spending/${userId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json && json.status === 'success') {
          setData(json);
        }
      })
      .catch((e) => console.log('Error fetching spending for dashboard:', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId, refreshTrigger]);

  return { data, loading };
}

// ─── Nutrition Forecast Card ──────────────────────────────────────────────────
function NutritionForecastCard({ data, loading, error }) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  };

  const CardShell = ({ children }) => (
    <View style={styles.nutritionCard}>
      <View style={styles.nutritionHeader}>
        <View style={styles.nutritionIconBox}>
          <Text style={styles.nutritionIconText}>🥗</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.nutritionTitle}>Nutrition Forecast</Text>
          <Text style={styles.nutritionSubtitle}>
            {data ? `EAT HEALTHY · ${data.month} ${data.year}` : 'EAT HEALTHY · THIS MONTH'}
          </Text>
        </View>
        {data && data.hasSufficientData && (
          <TouchableOpacity onPress={toggleExpand} activeOpacity={0.7}>
            <Text style={styles.nutritionChevron}>{expanded ? '∧' : '›'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );

  if (loading) {
    return (
      <CardShell>
        <View style={styles.nutritionStateBox}>
          <ActivityIndicator size="small" color={COLORS.secondary} />
          <Text style={styles.nutritionStateText}>Analysing your nutrition…</Text>
        </View>
      </CardShell>
    );
  }

  if (error) {
    return (
      <CardShell>
        <View style={styles.nutritionStateBox}>
          <Text style={styles.nutritionStateIcon}>⚠️</Text>
          <Text style={styles.nutritionStateText}>Could not load nutrition data. Make sure the backend is running.</Text>
        </View>
      </CardShell>
    );
  }

  if (!data || !data.hasSufficientData) {
    return (
      <CardShell>
        <View style={styles.nutritionStateBox}>
          <Text style={styles.nutritionStateIcon}>🥦</Text>
          <Text style={styles.nutritionStateText}>
            {data?.suggestion || 'Upload a receipt to start tracking your nutrition forecast.'}
          </Text>
        </View>
      </CardShell>
    );
  }

  const score      = data.healthyBasketScore || 0;
  const scoreColor = score >= 75 ? '#4CAF50' : score >= 50 ? '#E6A817' : COLORS.primary;
  const fmt        = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 1 });
  const COLLAPSED_NUTRIENTS = ['calories_kcal', 'protein_g', 'fiber_g'];
  const overBudgetCats = (data.categories || []).filter(c => !c.healthy);

  return (
    <CardShell>
      {/* Score row */}
      <View style={styles.nutritionScoreRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.nutritionScoreLabel}>Healthy basket score</Text>
          <View style={styles.nutritionScoreBarWrap}>
            <View style={styles.nutritionScoreTrack}>
              <View style={[styles.nutritionScoreFill, { width: `${score}%`, backgroundColor: scoreColor }]} />
            </View>
            <Text style={[styles.nutritionScorePct, { color: scoreColor }]}>{score}/100</Text>
          </View>
        </View>
        {data.gaps && data.gaps.length > 0 && (
          <View style={styles.nutritionGapBadge}>
            <Text style={styles.nutritionGapBadgeText}>⬇ {data.gaps.slice(0, 2).join(', ')}</Text>
            <Text style={styles.nutritionGapBadgeSub}>Below target</Text>
          </View>
        )}
      </View>

      {/* Key nutrients — collapsed view */}
      <View style={styles.nutritionNutrientList}>
        {COLLAPSED_NUTRIENTS.map((key) => {
          const n = data.nutrients[key];
          if (!n) return null;
          const pct   = Math.min(n.pct || 0, 100);
          const isLow = n.pct < 60;
          return (
            <View key={key} style={styles.nutritionNutrientRow}>
              <View style={styles.nutritionNutrientInfo}>
                <View style={[styles.nutritionNutrientDot, { backgroundColor: n.color }]} />
                <Text style={styles.nutritionNutrientName}>{n.label}</Text>
                <Text style={[styles.nutritionNutrientVal, isLow && { color: COLORS.primary }]}>
                  {fmt(n.perDay)} {n.unit}/day
                </Text>
              </View>
              <View style={styles.nutritionNutrientTrack}>
                <View style={[styles.nutritionNutrientFill, { width: `${pct}%`, backgroundColor: n.color }]} />
              </View>
              <Text style={styles.nutritionNutrientRda}>{Math.round(n.pct)}% of RDA</Text>
            </View>
          );
        })}
      </View>

      {/* Pantrix tip */}
      <View style={styles.nutritionTip}>
        <Text style={styles.nutritionTipIcon}>💡</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.nutritionTipTitle}>Pantrix suggests</Text>
          <Text style={styles.nutritionTipText}>{data.suggestion}</Text>
        </View>
      </View>

      {/* Expanded — full breakdown */}
      {expanded && (
        <View style={styles.nutritionExpanded}>
          <Text style={styles.nutritionExpandedTitle}>ALL NUTRIENTS (PER DAY AVG)</Text>
          {Object.entries(data.nutrients).map(([key, n]) => {
            const pct   = Math.min(n.pct || 0, 100);
            const isLow = n.pct < 60;
            const isHigh = n.pct > 130;
            return (
              <View key={key} style={styles.nutritionNutrientRow}>
                <View style={styles.nutritionNutrientInfo}>
                  <View style={[styles.nutritionNutrientDot, { backgroundColor: n.color }]} />
                  <Text style={styles.nutritionNutrientName}>{n.label}</Text>
                  <Text style={[
                    styles.nutritionNutrientVal,
                    isLow && { color: COLORS.primary },
                    isHigh && { color: '#E65100' },
                  ]}>
                    {fmt(n.perDay)} {n.unit}/day
                  </Text>
                </View>
                <View style={styles.nutritionNutrientTrack}>
                  <View style={[styles.nutritionNutrientFill, { width: `${pct}%`, backgroundColor: n.color }]} />
                </View>
                <Text style={styles.nutritionNutrientRda}>
                  {Math.round(n.pct)}% of RDA · target {fmt(n.rda)} {n.unit}
                </Text>
              </View>
            );
          })}

          {/* Healthy items */}
          {data.topHealthyItems && data.topHealthyItems.length > 0 && (
            <View style={styles.nutritionItemsSection}>
              <Text style={styles.nutritionItemsSectionTitle}>✅ TOP HEALTHY ITEMS</Text>
              <View style={styles.nutritionItemPills}>
                {data.topHealthyItems.map((item) => (
                  <View key={item} style={styles.nutritionHealthyPill}>
                    <Text style={styles.nutritionHealthyPillText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Processed items */}
          {data.topUnhealthyItems && data.topUnhealthyItems.length > 0 && (
            <View style={styles.nutritionItemsSection}>
              <Text style={styles.nutritionItemsSectionTitle}>⚠️ PROCESSED ITEMS</Text>
              <View style={styles.nutritionItemPills}>
                {data.topUnhealthyItems.map((item) => (
                  <View key={item} style={styles.nutritionUnhealthyPill}>
                    <Text style={styles.nutritionUnhealthyPillText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Category breakdown */}
          {data.categories && data.categories.length > 0 && (
            <View style={styles.nutritionCatSection}>
              <Text style={styles.nutritionItemsSectionTitle}>FOOD CATEGORIES</Text>
              {data.categories.map((cat) => (
                <View key={cat.name} style={styles.nutritionCatRow}>
                  <View style={[styles.nutritionCatDot, { backgroundColor: cat.color }]} />
                  <Text style={styles.nutritionCatName}>{cat.name}</Text>
                  <Text style={styles.nutritionCatCount}>{cat.items} item{cat.items !== 1 ? 's' : ''}</Text>
                  {!cat.healthy && (
                    <View style={styles.nutritionCatBadge}>
                      <Text style={styles.nutritionCatBadgeText}>Processed</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Toggle link */}
      <TouchableOpacity style={styles.nutritionViewBtn} onPress={toggleExpand} activeOpacity={0.7}>
        <Text style={styles.nutritionViewBtnText}>
          {expanded ? 'Hide details ↑' : 'View full nutrition forecast →'}
        </Text>
      </TouchableOpacity>
    </CardShell>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const [name, setName]     = useState('');
  const [userId, setUserId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let mounted = true;
    getUser().then((user) => {
      if (mounted && user?.name) setName(user.name);
      if (mounted && (user?.id || user?.user_id)) setUserId(user.id || user.user_id);
    });
    return () => { mounted = false; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      setRefreshTrigger((prev) => prev + 1);
    }, [])
  );

  const { data: forecastData, loading: forecastLoading, error: forecastError } = useForecast(userId, refreshTrigger);
  const { data: nutritionData, loading: nutritionLoading, error: nutritionError } = useNutritionForecast(userId, refreshTrigger);
  const { data: spendingData, loading: spendingLoading } = useSpendingData(userId, refreshTrigger);

  // ─── Real Quick Stats Calculation for All Users ────────────────────────────
  const quickStats = useMemo(() => {
    const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    const isInitialLoading = (forecastLoading || nutritionLoading || spendingLoading) && !forecastData && !nutritionData && !spendingData;

    // 1. Total Spend (Real spend calculation from actual receipts)
    let spendVal = '₹0';
    let spendSub = 'No receipts logged';
    let spendAlert = false;

    if (isInitialLoading) {
      spendVal = '...';
      spendSub = 'Calculating spend…';
    } else {
      const realSpend = spendingData?.has_data
        ? (spendingData.this_month_spend > 0 ? spendingData.this_month_spend : spendingData.total_spend)
        : (forecastData?.currentSpend ?? 0);
      const totalCount = spendingData?.total_receipts ?? forecastData?.totalReceipts ?? 0;

      if (totalCount > 0 || realSpend > 0) {
        spendVal = `₹${fmt(realSpend)}`;
        const budget = forecastData?.budget || 0;
        const proj = forecastData?.projectedSpend || 0;
        if (budget > 0 && realSpend > 0) {
          const pct = Math.round((realSpend / budget) * 100);
          spendSub = `${pct}% of ₹${fmt(budget)} target`;
          spendAlert = proj > budget;
        } else if (forecastData?.projectedSpend > 0) {
          spendSub = `Pacing ₹${fmt(forecastData.projectedSpend)}`;
        } else {
          spendSub = `${totalCount} receipt${totalCount !== 1 ? 's' : ''} logged`;
        }
      } else {
        spendVal = '₹0';
        spendSub = 'No receipts logged';
      }
    }

    // 2. Calories Purchased (Real nutrient aggregation from actual food items)
    let kcalVal = '0';
    let kcalSub = 'No receipts logged';

    if (isInitialLoading) {
      kcalVal = '...';
      kcalSub = 'Analyzing calories…';
    } else if (nutritionData && nutritionData.hasSufficientData) {
      const calObj = nutritionData.nutrients?.calories_kcal;
      const totalKcal = Math.round(calObj?.total || 0);
      const perDay = Math.round(calObj?.perDay || 0);
      if (totalKcal > 0) {
        kcalVal = fmt(totalKcal);
        kcalSub = perDay > 0 ? `${fmt(perDay)} kcal/day avg` : 'from groceries';
      } else {
        kcalVal = '0';
        kcalSub = '0 kcal logged';
      }
    } else {
      kcalVal = '0';
      kcalSub = 'No receipts logged';
    }

    // 3. Protein Purchased (Real nutrient aggregation from actual food items)
    let protVal = '0 g';
    let protSub = 'No receipts logged';

    if (isInitialLoading) {
      protVal = '...';
      protSub = 'Analyzing protein…';
    } else if (nutritionData && nutritionData.hasSufficientData) {
      const protObj = nutritionData.nutrients?.protein_g;
      const totalProt = Math.round(protObj?.total || 0);
      const perDay = Math.round(protObj?.perDay || 0);
      if (totalProt > 0) {
        protVal = `${fmt(totalProt)} g`;
        protSub = perDay > 0 ? `${fmt(perDay)} g/day avg` : 'total protein';
      } else {
        protVal = '0 g';
        protSub = '0 g logged';
      }
    } else {
      protVal = '0 g';
      protSub = 'No receipts logged';
    }

    // 4. Healthy Basket Score (Real item healthy ratio calculated from receipts)
    let scoreVal = '--/100';
    let scoreSub = 'Scan receipt to rate';
    let scoreAccent = COLORS.accent;
    let scoreAlert = false;

    if (isInitialLoading) {
      scoreVal = '...';
      scoreSub = 'Calculating score…';
    } else if (nutritionData && nutritionData.hasSufficientData && nutritionData.totalItems > 0) {
      const score = Math.round(nutritionData.healthyBasketScore || 0);
      scoreVal = `${score}/100`;
      if (score >= 75) {
        scoreSub = 'Healthy basket';
        scoreAccent = '#4CAF50';
      } else if (score >= 50) {
        scoreSub = 'Moderate balance';
        scoreAccent = COLORS.accent;
      } else {
        scoreSub = 'Needs attention';
        scoreAccent = COLORS.primary;
        scoreAlert = true;
      }
    } else {
      scoreVal = '--/100';
      scoreSub = 'Scan receipt to rate';
    }

    return [
      {
        tag: 'SPEND',
        label: 'Total Spend',
        value: spendVal,
        sub: spendSub,
        subAlert: spendAlert,
        accent: COLORS.primary,
      },
      {
        tag: 'KCAL',
        label: 'Calories Purchased',
        value: kcalVal,
        sub: kcalSub,
        subAlert: false,
        accent: COLORS.secondary,
      },
      {
        tag: 'PROT',
        label: 'Protein Purchased',
        value: protVal,
        sub: protSub,
        subAlert: false,
        accent: COLORS.secondary,
      },
      {
        tag: 'SCORE',
        label: 'Healthy Basket',
        value: scoreVal,
        sub: scoreSub,
        subAlert: scoreAlert,
        accent: scoreAccent,
      },
    ];
  }, [spendingData, spendingLoading, forecastData, forecastLoading, nutritionData, nutritionLoading]);

  // ─── Real Dynamic Goals ────────────────────────────────────────────────────
  const eatHealthyGoal = useMemo(() => {
    if (nutritionData && nutritionData.hasSufficientData && nutritionData.totalItems > 0) {
      const score = Math.round(nutritionData.healthyBasketScore || 0);
      const healthyItems = nutritionData.healthyItems || 0;
      const totalItems = nutritionData.totalItems || 0;
      return {
        tag: 'DIET',
        label: 'Eat Healthy',
        progress: score / 100,
        detail: `${healthyItems} of ${totalItems} item${totalItems !== 1 ? 's' : ''} purchased rated wholesome.`,
        color: COLORS.secondary,
      };
    }
    return {
      tag: 'DIET',
      label: 'Eat Healthy',
      progress: 0,
      detail: 'Upload receipts to track healthy food purchases.',
      color: COLORS.secondary,
    };
  }, [nutritionData]);

  const gainMuscleGoal = useMemo(() => {
    if (nutritionData && nutritionData.hasSufficientData) {
      const prot = Math.round(nutritionData.nutrients?.protein_g?.perDay || 0);
      const targetProt = 120;
      const prog = Math.min(Math.max(prot / targetProt, 0), 1);
      return {
        tag: 'FIT',
        label: 'Gain Muscle',
        progress: prog,
        detail: prot > 0 ? `Avg ~${prot}g/day protein from groceries (target: ${targetProt}g).` : 'Track grocery protein intake.',
        color: COLORS.primary,
      };
    }
    return {
      tag: 'FIT',
      label: 'Gain Muscle',
      progress: 0,
      detail: 'Upload receipts to track muscle-building protein.',
      color: COLORS.primary,
    };
  }, [nutritionData]);

  const latestInsightText = useMemo(() => {
    if (spendingData?.ai_tip) return spendingData.ai_tip;
    if (forecastData?.suggestion) return forecastData.suggestion;
    if (nutritionData?.suggestion) return nutritionData.suggestion;
    return 'Scan your grocery receipts to receive customized, real-time AI spending and nutrition insights.';
  }, [spendingData, forecastData, nutritionData]);

  return (
    <ScreenLayout title="Dashboard">
      <View style={{ flex: 1 }}>
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

          {/* Quick Stats 2×2 Grid — 100% Real User Data */}
          <Text style={styles.sectionTitle}>QUICK STATS</Text>
          <View style={styles.statsGrid}>
            {quickStats.map((s) => (
              <StatCard key={s.label} {...s} />
            ))}
          </View>

          {/* Monthly Budget Goal (Moved from Financial Insights) */}
          <Text style={styles.sectionTitle}>MONTHLY BUDGET GOAL</Text>
          <MonthlyBudgetCard userId={userId} />

          {/* Goal Progress */}
          <Text style={styles.sectionTitle}>GOAL PROGRESS</Text>
          <View style={styles.goalsContainer}>
            {/* Spending Forecast — live data */}
            <SpendingForecastCard
              data={forecastData}
              loading={forecastLoading}
              error={forecastError}
            />

            {/* Remaining goals — Eat Healthy */}
            <GoalCard {...eatHealthyGoal} />

            {/* Nutrition Forecast — placed after Eat Healthy per spec */}
            <NutritionForecastCard
              data={nutritionData}
              loading={nutritionLoading}
              error={nutritionError}
            />

            {/* Gain Muscle goal */}
            <GoalCard
              {...gainMuscleGoal}
              onPress={() => navigation.navigate('GainMuscle')}
            />
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
              {latestInsightText}
            </Text>
            <TouchableOpacity style={styles.insightBtn} onPress={() => navigation.navigate('GemmaChat')}>
              <Text style={styles.insightBtnText}>Ask Gemma for Food Swaps →</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
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
  goalsContainer: { gap: 14, marginBottom: 24 },
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

  // Gemma 3 12B Assistant Card
  gemmaCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 22,
    borderWidth: 1.5,
    borderColor: '#94B6EF',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  gemmaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  gemmaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gemmaIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  gemmaIcon: {
    color: '#fff',
    fontSize: 18,
    fontFamily: FONTS.bold,
  },
  gemmaTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.primary,
  },
  gemmaTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  gemmaModelTag: {
    backgroundColor: '#E6E279',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginRight: 6,
  },
  gemmaModelText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  gemmaLiveText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#34A853',
  },
  gemmaArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(153, 8, 8, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gemmaArrow: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.primary,
  },
  gemmaDescription: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
    marginBottom: 12,
  },
  gemmaPromptRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  gemmaPromptPill: {
    backgroundColor: '#F4F2EF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ede8e0',
  },
  gemmaPromptText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.primary,
  },

  // Floating Action Button (FAB)
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
  fabIcon: {
    color: '#E6E279',
    fontSize: 16,
    fontFamily: FONTS.bold,
    marginRight: 6,
  },
  fabText: {
    color: '#fff',
    fontFamily: FONTS.bold,
    fontSize: 13,
    letterSpacing: 0.3,
  },

  // ─── Spending Forecast Card ───────────────────────────────────────────────
  forecastCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  forecastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  forecastIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(230, 226, 121, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  forecastIconText: {
    fontSize: 20,
  },
  forecastTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  forecastSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: 'rgba(153,8,8,0.5)',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  forecastChevron: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.primary,
    paddingHorizontal: 4,
  },
  forecastAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  forecastAmountLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153,8,8,0.55)',
    marginBottom: 2,
  },
  forecastAmount: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  forecastBadge: {
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  forecastBadgeOver: {
    backgroundColor: 'rgba(153, 8, 8, 0.08)',
  },
  forecastBadgeUnder: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  forecastBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  forecastBadgeSub: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    marginTop: 2,
  },
  forecastProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  forecastProgressLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153,8,8,0.6)',
  },
  forecastProgressPct: {
    fontFamily: FONTS.bold,
    fontSize: 13,
  },
  forecastTrack: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(148, 182, 239, 0.2)',
    borderRadius: 4,
    marginBottom: 14,
    overflow: 'hidden',
  },
  forecastFill: {
    height: '100%',
    borderRadius: 4,
  },
  forecastTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(230, 226, 121, 0.2)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(230, 226, 121, 0.5)',
  },
  forecastTipIcon: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 1,
  },
  forecastTipTitle: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
    marginBottom: 3,
  },
  forecastTipText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153,8,8,0.7)',
    lineHeight: 17,
  },
  forecastViewBtn: {
    alignSelf: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
  },
  forecastViewBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
    letterSpacing: 0.2,
  },
  // Category breakdown
  forecastCategories: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 182, 239, 0.25)',
    paddingTop: 14,
    marginBottom: 14,
  },
  forecastCatTitle: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: 'rgba(153,8,8,0.5)',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  forecastCatRow: {
    marginBottom: 12,
  },
  forecastCatInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  forecastCatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  forecastCatName: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153,8,8,0.75)',
  },
  forecastCatAmt: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#333',
  },
  forecastCatTrack: {
    width: '100%',
    height: 5,
    backgroundColor: 'rgba(148,182,239,0.18)',
    borderRadius: 3,
    marginBottom: 3,
    overflow: 'hidden',
  },
  forecastCatFill: {
    height: '100%',
    borderRadius: 3,
  },
  forecastCatBudget: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: 'rgba(153,8,8,0.4)',
  },
  forecastSavingsRow: {
    backgroundColor: 'rgba(76,175,80,0.08)',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.2)',
  },
  forecastSavingsText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#2E7D32',
    lineHeight: 17,
  },
  // State styles (loading / error / empty)
  forecastStateBox: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  forecastStateIcon: {
    fontSize: 28,
  },
  forecastStateText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153,8,8,0.6)',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  forecastAmountSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: 'rgba(153,8,8,0.45)',
    marginTop: 2,
  },

  // ─── Nutrition Forecast Card ────────────────────────────────────────────────
  nutritionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  nutritionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  nutritionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(148, 182, 239, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  nutritionIconText: { fontSize: 20 },
  nutritionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  nutritionSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: 'rgba(153,8,8,0.5)',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  nutritionChevron: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.secondary,
    paddingHorizontal: 4,
  },
  // State styles
  nutritionStateBox: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  nutritionStateIcon: { fontSize: 28 },
  nutritionStateText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153,8,8,0.6)',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  // Score
  nutritionScoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  nutritionScoreLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153,8,8,0.55)',
    marginBottom: 6,
  },
  nutritionScoreBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nutritionScoreTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(148,182,239,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  nutritionScoreFill: {
    height: '100%',
    borderRadius: 4,
  },
  nutritionScorePct: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    minWidth: 44,
    textAlign: 'right',
  },
  // Gap badge
  nutritionGapBadge: {
    backgroundColor: 'rgba(153, 8, 8, 0.07)',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    minWidth: 90,
    marginLeft: 10,
  },
  nutritionGapBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
  },
  nutritionGapBadgeSub: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: COLORS.primary,
    marginTop: 2,
  },
  // Nutrient rows
  nutritionNutrientList: { marginBottom: 12 },
  nutritionNutrientRow: { marginBottom: 10 },
  nutritionNutrientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  nutritionNutrientDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  nutritionNutrientName: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153,8,8,0.75)',
  },
  nutritionNutrientVal: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#333',
  },
  nutritionNutrientTrack: {
    width: '100%',
    height: 5,
    backgroundColor: 'rgba(148,182,239,0.18)',
    borderRadius: 3,
    marginBottom: 2,
    overflow: 'hidden',
  },
  nutritionNutrientFill: {
    height: '100%',
    borderRadius: 3,
  },
  nutritionNutrientRda: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: 'rgba(153,8,8,0.4)',
  },
  // Tip
  nutritionTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(148, 182, 239, 0.12)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 182, 239, 0.35)',
  },
  nutritionTipIcon: { fontSize: 16, marginRight: 8, marginTop: 1 },
  nutritionTipTitle: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
    marginBottom: 3,
  },
  nutritionTipText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153,8,8,0.7)',
    lineHeight: 17,
  },
  // View toggle
  nutritionViewBtn: {
    alignSelf: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.secondary,
  },
  nutritionViewBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.secondary,
    letterSpacing: 0.2,
  },
  // Expanded section
  nutritionExpanded: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 182, 239, 0.25)',
    paddingTop: 14,
    marginBottom: 14,
  },
  nutritionExpandedTitle: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: 'rgba(153,8,8,0.5)',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  nutritionItemsSection: { marginTop: 14 },
  nutritionItemsSectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: 'rgba(153,8,8,0.5)',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  nutritionItemPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  nutritionHealthyPill: {
    backgroundColor: 'rgba(76,175,80,0.1)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.3)',
  },
  nutritionHealthyPillText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#2E7D32',
  },
  nutritionUnhealthyPill: {
    backgroundColor: 'rgba(153,8,8,0.07)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(153,8,8,0.2)',
  },
  nutritionUnhealthyPillText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.primary,
  },
  nutritionCatSection: { marginTop: 14 },
  nutritionCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  nutritionCatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  nutritionCatName: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153,8,8,0.75)',
  },
  nutritionCatCount: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: 'rgba(153,8,8,0.4)',
    marginRight: 8,
  },
  nutritionCatBadge: {
    backgroundColor: 'rgba(153,8,8,0.08)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  nutritionCatBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
});
