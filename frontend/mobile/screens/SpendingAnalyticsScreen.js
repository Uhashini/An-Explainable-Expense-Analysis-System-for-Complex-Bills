import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Line,
} from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenLayout from '../components/ScreenLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { COLORS, FONTS } from '../theme';
import { API_BASE_URL } from '../utils/apiConfig';
import { getUser } from '../utils/authStorage';

const STORAGE_BUDGET_KEY = 'PANTRIX_MONTHLY_BUDGET';
const DEFAULT_BUDGET = 6000;
const screenWidth = Dimensions.get('window').width;
const BUDGET_PRESETS = [3000, 5000, 6000, 8000, 10000];

function parseSafeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (trimmed.toLowerCase().includes('unknown')) return null;

  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d;

  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const custom = new Date(year, month, day);
    if (!isNaN(custom.getTime())) return custom;
  }
  return null;
}

function SpendingAnalyticsContent({ navigation }) {
  const [timeFilter, setTimeFilter] = useState('All Receipts'); // 'All Receipts' | 'This Month'
  const [monthlyBudget, setMonthlyBudget] = useState(DEFAULT_BUDGET);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(DEFAULT_BUDGET));
  const [spendingData, setSpendingData] = useState(null);
  const [rawReceipts, setRawReceipts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);

  // Load saved budget goal from local storage
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_BUDGET_KEY);
        if (saved) {
          const val = parseFloat(saved);
          if (!isNaN(val) && val > 0) {
            setMonthlyBudget(val);
            setBudgetInput(String(val));
          }
        }
      } catch (e) {
        console.warn('Error reading budget from storage:', e);
      }
    })();
  }, []);

  // Fetch receipts and real analytics from backend
  const fetchSpendingAnalytics = useCallback(async () => {
    try {
      const user = await getUser();
      const userId = user?.id || 1;

      // 1. Try dedicated spending analytics endpoint
      try {
        const res = await fetch(`${API_BASE_URL}/analytics/spending/${userId}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.status === 'success') {
            setSpendingData(data);
            setIsLoading(false);
            setIsRefreshing(false);
            return;
          }
        }
      } catch (err) {
        console.log('Spending endpoint fetch notice:', err);
      }

      // 2. Fallback: fetch raw receipts list
      const recRes = await fetch(`${API_BASE_URL}/receipts/user/${userId}`);
      if (recRes.ok) {
        const recData = await recRes.json();
        if (recData && Array.isArray(recData.receipts)) {
          setRawReceipts(recData.receipts);
        } else {
          setRawReceipts([]);
        }
      } else {
        setRawReceipts([]);
      }
    } catch (e) {
      console.warn('Could not fetch user receipts/analytics:', e);
      setRawReceipts([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Re-fetch automatically whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchSpendingAnalytics();
    }, [fetchSpendingAnalytics])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchSpendingAnalytics();
  };

  const handleSaveBudget = async () => {
    const parsed = parseFloat(budgetInput.replace(/[^0-9.]/g, ''));
    if (!isNaN(parsed) && parsed > 0) {
      setMonthlyBudget(parsed);
      setIsEditingBudget(false);
      try {
        await AsyncStorage.setItem(STORAGE_BUDGET_KEY, String(parsed));
      } catch (e) {
        console.warn('Failed saving budget:', e);
      }
    } else {
      setBudgetInput(String(monthlyBudget));
      setIsEditingBudget(false);
    }
  };

  // Determine if user has actual receipt data
  const hasData = useMemo(() => {
    if (spendingData && spendingData.has_data && spendingData.total_receipts > 0) {
      return true;
    }
    if (rawReceipts && rawReceipts.length > 0) {
      return true;
    }
    return false;
  }, [spendingData, rawReceipts]);

  // Rock-solid calculations
  const analytics = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = Math.max(1, now.getDate());
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const safeBudget =
      typeof monthlyBudget === 'number' && !isNaN(monthlyBudget) && monthlyBudget > 0
        ? monthlyBudget
        : DEFAULT_BUDGET;

    // If we have backend spending data with receipts
    if (spendingData && spendingData.has_data && spendingData.total_receipts > 0) {
      const isMonth = timeFilter === 'This Month';
      const currentSpend = isMonth ? spendingData.this_month_spend : spendingData.total_spend;
      const totalSpend = spendingData.total_spend;
      const trips = isMonth ? spendingData.this_month_receipts : spendingData.total_receipts;
      const remaining = safeBudget - currentSpend;
      const rawPct = safeBudget > 0 ? (currentSpend / safeBudget) * 100 : 0;
      const clampedPct = Math.min(Math.max(rawPct, 0), 100);

      const dailyBurn = isMonth ? spendingData.daily_burn : Math.round(totalSpend / Math.max(1, trips * 4));
      const projected = Math.round(dailyBurn * daysInMonth);

      let statColor = '#2E7D32';
      let statTxt = 'On Track';
      let statBg = 'rgba(46, 125, 50, 0.12)';
      if (rawPct > 100) {
        statColor = '#D32F2F';
        statTxt = 'Exceeded';
        statBg = 'rgba(211, 47, 47, 0.12)';
      } else if (rawPct >= 85) {
        statColor = '#E65100';
        statTxt = 'Near Limit';
        statBg = 'rgba(230, 81, 0, 0.12)';
      } else if (rawPct >= 65) {
        statColor = '#F57C00';
        statTxt = 'Moderate';
        statBg = 'rgba(245, 124, 0, 0.12)';
      }

      const rawTimeline = isMonth
        ? spendingData.timeline_this_month || []
        : spendingData.timeline_all || [];

      let timelinePoints = [...rawTimeline];
      if (timelinePoints.length === 1) {
        timelinePoints = [
          { id: 0, date: 'Start', merchant: 'Initial', amount: 0, cumulative: 0, is_this_month: true },
          timelinePoints[0],
        ];
      }

      const categories = isMonth
        ? spendingData.categories_this_month && spendingData.categories_this_month.length > 0
          ? spendingData.categories_this_month
          : spendingData.categories_all || []
        : spendingData.categories_all || [];

      const avgBasket = trips > 0 ? Math.round(currentSpend / trips) : spendingData.avg_basket || 0;

      return {
        monthlyBudget: safeBudget,
        currentSpend,
        totalSpend,
        remaining,
        utilizationPct: clampedPct,
        rawPct: Math.round(rawPct),
        statusColor: statColor,
        statusText: statTxt,
        statusBg: statBg,
        burnRate: dailyBurn,
        projectedMonthEnd: projected,
        timelinePoints,
        avgBasket,
        tripCount: trips,
        categories,
        aiTip: spendingData.ai_tip,
      };
    }

    // Client-side fallback if raw receipts exist
    if (rawReceipts && rawReceipts.length > 0) {
      let totalSpend = 0;
      let thisMonthSpend = 0;
      let thisMonthCount = 0;
      const parsedPoints = [];

      const sorted = [...rawReceipts].sort((a, b) => {
        const dA = parseSafeDate(a.date);
        const dB = parseSafeDate(b.date);
        return (dA ? dA.getTime() : 0) - (dB ? dB.getTime() : 0);
      });

      let rolling = 0;
      sorted.forEach((r, idx) => {
        const amt = Math.max(0, parseFloat(r.total_amount) || 0);
        rolling += amt;
        totalSpend += amt;

        let isThisMonth = false;
        let dateLabel = `Trip ${idx + 1}`;
        const parsedDate = parseSafeDate(r.date);
        if (parsedDate) {
          dateLabel = parsedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          if (parsedDate.getFullYear() === currentYear && parsedDate.getMonth() === currentMonth) {
            isThisMonth = true;
            thisMonthSpend += amt;
            thisMonthCount += 1;
          }
        }

        parsedPoints.push({
          id: r.receipt_id || idx + 1,
          date: dateLabel,
          merchant: String(r.merchant_name || 'Grocery Store'),
          amount: Math.round(amt),
          cumulative: Math.round(rolling),
          isThisMonth,
        });
      });

      let activePoints = parsedPoints;
      if (timeFilter === 'This Month') {
        const filtered = parsedPoints.filter((p) => p.isThisMonth);
        activePoints = filtered.length > 0 ? filtered : parsedPoints;
      }

      if (activePoints.length === 1) {
        activePoints = [
          { id: 0, date: 'Start', merchant: 'Initial', amount: 0, cumulative: 0, isThisMonth: true },
          activePoints[0],
        ];
      }

      const currentSpend = timeFilter === 'This Month' ? thisMonthSpend : totalSpend;
      const remaining = safeBudget - currentSpend;
      const rawPct = safeBudget > 0 ? (currentSpend / safeBudget) * 100 : 0;
      const clampedPct = Math.min(Math.max(rawPct, 0), 100);
      const dailyBurn = Math.round(currentSpend / currentDay);
      const projected = Math.round(dailyBurn * daysInMonth);

      let statColor = '#2E7D32';
      let statTxt = 'On Track';
      let statBg = 'rgba(46, 125, 50, 0.12)';
      if (rawPct > 100) {
        statColor = '#D32F2F';
        statTxt = 'Exceeded';
        statBg = 'rgba(211, 47, 47, 0.12)';
      } else if (rawPct >= 85) {
        statColor = '#E65100';
        statTxt = 'Near Limit';
        statBg = 'rgba(230, 81, 0, 0.12)';
      } else if (rawPct >= 65) {
        statColor = '#F57C00';
        statTxt = 'Moderate';
        statBg = 'rgba(245, 124, 0, 0.12)';
      }

      const trips = timeFilter === 'This Month' ? thisMonthCount : sorted.length;
      const avgBasket = trips > 0 ? Math.round(currentSpend / trips) : currentSpend;

      return {
        monthlyBudget: safeBudget,
        currentSpend,
        totalSpend,
        remaining,
        utilizationPct: clampedPct,
        rawPct: Math.round(rawPct),
        statusColor: statColor,
        statusText: statTxt,
        statusBg: statBg,
        burnRate: dailyBurn,
        projectedMonthEnd: projected,
        timelinePoints: activePoints,
        avgBasket,
        tripCount: trips,
        categories: [],
        aiTip: `You have tracked ${trips} receipt${trips > 1 ? 's' : ''}. Keep uploading to unlock full category intelligence!`,
      };
    }

    // Default 0-data object for new user (NO FAKE DATA)
    return {
      monthlyBudget: safeBudget,
      currentSpend: 0,
      totalSpend: 0,
      remaining: safeBudget,
      utilizationPct: 0,
      rawPct: 0,
      statusColor: '#2E7D32',
      statusText: 'No Data',
      statusBg: 'rgba(46, 125, 50, 0.12)',
      burnRate: 0,
      projectedMonthEnd: 0,
      timelinePoints: [],
      avgBasket: 0,
      tripCount: 0,
      categories: [],
      aiTip: null,
    };
  }, [spendingData, rawReceipts, monthlyBudget, timeFilter]);

  // SVG Chart Coordinates (Safe & Clamped)
  const chartHeight = 150;
  const chartWidth = Math.max(screenWidth - 68, 280);
  const paddingBottom = 20;
  const paddingTop = 16;
  const usableHeight = chartHeight - paddingBottom - paddingTop;

  const chartData = useMemo(() => {
    const pts = analytics.timelinePoints;
    if (!pts || pts.length < 2) {
      return { pathD: '', areaD: '', coords: [], budgetLineY: 0, firstDate: '', midDate: '', lastDate: '' };
    }

    const highest = Math.max(...pts.map((p) => Number(p.cumulative) || 0), 100);
    const maxVal = Math.max(highest, analytics.monthlyBudget * 1.08, 100);

    const n = pts.length;
    const stepX = chartWidth / Math.max(n - 1, 1);

    const coords = pts.map((pt, idx) => {
      const x = Math.min(Math.max(idx * stepX, 0), chartWidth);
      const ratio = Math.min(Math.max((Number(pt.cumulative) || 0) / maxVal, 0), 1);
      const y = Math.min(
        Math.max(chartHeight - paddingBottom - ratio * usableHeight, paddingTop),
        chartHeight - paddingBottom
      );
      return {
        ...pt,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
      };
    });

    const pathD = coords.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const bottomY = chartHeight - paddingBottom;
    const areaD = `${pathD} L ${coords[coords.length - 1].x} ${bottomY} L ${coords[0].x} ${bottomY} Z`;

    const bRatio = Math.min(Math.max(analytics.monthlyBudget / maxVal, 0), 1);
    const budgetLineY = Math.round(chartHeight - paddingBottom - bRatio * usableHeight);

    const firstDate = coords[0]?.date || '';
    const lastDate = coords[coords.length - 1]?.date || '';
    const midIdx = Math.floor(coords.length / 2);
    const midDate = coords.length > 2 ? coords[midIdx]?.date || '' : '';

    return { pathD, areaD, coords, budgetLineY, firstDate, midDate, lastDate };
  }, [analytics.timelinePoints, analytics.monthlyBudget, chartWidth, chartHeight, usableHeight, paddingBottom, paddingTop]);

  return (
    <ScreenLayout title="Financial Insights" navigation={navigation}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* ─── 1. Monthly Budget Hub (Always available to set goals) ─── */}
        <View style={styles.budgetCard}>
          <View style={styles.budgetCardTop}>
            <View style={styles.budgetTitleRow}>
              <View style={[styles.iconPill, { backgroundColor: '#FBEBEB' }]}>
                <Feather name="target" size={17} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.budgetHeaderTitle}>Monthly Budget Goal</Text>
                <Text style={styles.budgetHeaderSubtitle}>Active Grocery Spending Target</Text>
              </View>
            </View>

            <View style={styles.budgetHeaderRight}>
              {hasData && (
                <View style={[styles.statusBadge, { backgroundColor: analytics.statusBg }]}>
                  <View style={[styles.statusDot, { backgroundColor: analytics.statusColor }]} />
                  <Text style={[styles.statusBadgeText, { color: analytics.statusColor }]}>
                    {analytics.statusText}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.editBudgetPill}
                onPress={() => {
                  setBudgetInput(String(analytics.monthlyBudget));
                  setIsEditingBudget(!isEditingBudget);
                }}
                activeOpacity={0.7}
              >
                <Feather name={isEditingBudget ? 'x' : 'edit-2'} size={13} color={COLORS.primary} />
                <Text style={styles.editBudgetText}>{isEditingBudget ? 'Close' : 'Set Budget'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Inline Budget Quick Editor */}
          {isEditingBudget && (
            <View style={styles.budgetEditorBox}>
              <Text style={styles.editorBoxTitle}>Configure Monthly Grocery Target</Text>
              <View style={styles.editorInputRow}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput
                  style={styles.budgetTextInput}
                  value={budgetInput}
                  onChangeText={setBudgetInput}
                  keyboardType="numeric"
                  placeholder="e.g. 6000"
                  placeholderTextColor="#aaa"
                />
                <TouchableOpacity style={styles.saveBudgetBtn} onPress={handleSaveBudget} activeOpacity={0.8}>
                  <Text style={styles.saveBudgetBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.presetRow}>
                {BUDGET_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.presetChip,
                      parseFloat(budgetInput) === preset && styles.presetChipActive,
                    ]}
                    onPress={() => setBudgetInput(String(preset))}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        parseFloat(budgetInput) === preset && styles.presetChipTextActive,
                      ]}
                    >
                      ₹{(preset / 1000).toFixed(0)}k
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* If user has data, show live numbers */}
          {hasData ? (
            <>
              {/* Large Budget Numbers */}
              <View style={styles.numbersGrid}>
                <View>
                  <Text style={styles.numLabel}>Spent This Period</Text>
                  <Text style={styles.numLarge}>₹{analytics.currentSpend.toLocaleString('en-IN')}</Text>
                  <Text style={styles.numSub}>of ₹{analytics.monthlyBudget.toLocaleString('en-IN')} Target</Text>
                </View>
                <View style={styles.numRightBox}>
                  <Text style={styles.numLabel}>Remaining Budget</Text>
                  <Text style={[styles.numLarge, { color: analytics.remaining >= 0 ? '#2E7D32' : '#D32F2F' }]}>
                    {analytics.remaining >= 0
                      ? `₹${analytics.remaining.toLocaleString('en-IN')}`
                      : `-₹${Math.abs(analytics.remaining).toLocaleString('en-IN')}`}
                  </Text>
                  <Text style={styles.numSub}>
                    {analytics.remaining >= 0 ? 'Left to spend' : 'Over budget limit'}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${analytics.utilizationPct}%`, backgroundColor: analytics.statusColor },
                    ]}
                  />
                </View>
                <View style={styles.progressMetaRow}>
                  <Text style={styles.metaPct}>{analytics.rawPct}% Utilized</Text>
                  <Text style={styles.metaPace}>
                    {analytics.projectedMonthEnd > analytics.monthlyBudget
                      ? `Pacing ₹${analytics.projectedMonthEnd.toLocaleString('en-IN')} (Over)`
                      : `Pacing ₹${analytics.projectedMonthEnd.toLocaleString('en-IN')} (Safe)`}
                  </Text>
                </View>
              </View>

              {/* Daily Burn Rate & Avg Basket Banner */}
              <View style={styles.burnRateRow}>
                <View style={styles.burnItem}>
                  <Feather name="activity" size={14} color={COLORS.mutedText} style={{ marginRight: 6 }} />
                  <Text style={styles.burnText}>Burn Rate: <Text style={styles.burnBold}>₹{analytics.burnRate}/day</Text></Text>
                </View>
                <View style={styles.burnDivider} />
                <View style={styles.burnItem}>
                  <Feather name="shopping-bag" size={14} color={COLORS.mutedText} style={{ marginRight: 6 }} />
                  <Text style={styles.burnText}>Avg Run: <Text style={styles.burnBold}>₹{analytics.avgBasket}</Text></Text>
                </View>
              </View>
            </>
          ) : (
            /* New user zero-state budget view */
            <View style={styles.newUserBudgetNotice}>
              <View style={styles.targetRow}>
                <Text style={styles.targetLabel}>Target Limit:</Text>
                <Text style={styles.targetValue}>₹{analytics.monthlyBudget.toLocaleString('en-IN')}</Text>
              </View>
              <Text style={styles.targetDesc}>
                Set your monthly grocery spending limit above. As you upload receipts, your real-time spend pace and remaining balance will track here automatically.
              </Text>
            </View>
          )}
        </View>

        {/* ─── 2. Conditional View: Empty State vs Full Analytics ─── */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading financial insights...</Text>
          </View>
        ) : !hasData ? (
          /* ─── NEW USER EMPTY STATE (ZERO FAKE DATA) ─── */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Feather name="pie-chart" size={32} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>No Spending Insights Yet</Text>
              <Text style={styles.emptySubtitle}>
                Pantrix calculates your real grocery spending trends, category allocations, daily burn rate, and personalized AI tips once you scan or upload your receipts.
              </Text>

              {/* CTA Button */}
              <TouchableOpacity
                style={styles.emptyCtaBtn}
                onPress={() => navigation.navigate('Scan')}
                activeOpacity={0.88}
              >
                <Feather name="camera" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.emptyCtaText}>Scan Your First Receipt</Text>
              </TouchableOpacity>
            </View>

            {/* Feature Highlights Grid */}
            <View style={styles.featuresSection}>
              <Text style={styles.featuresHeader}>WHAT YOU’LL UNLOCK</Text>

              <View style={styles.featureGrid}>
                <View style={styles.featureItem}>
                  <View style={[styles.featureIconBg, { backgroundColor: '#E8F5E9' }]}>
                    <Feather name="trending-up" size={18} color="#2E7D32" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.featureItemTitle}>Real-Time Budget Pace</Text>
                    <Text style={styles.featureItemDesc}>Track live burn rate and projected month-end grocery spend.</Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureIconBg, { backgroundColor: '#E3F2FD' }]}>
                    <Feather name="layers" size={18} color="#1565C0" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.featureItemTitle}>True Category Breakdown</Text>
                    <Text style={styles.featureItemDesc}>Auto-categorized into produce, dairy, protein, grains, and snacks.</Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureIconBg, { backgroundColor: '#F3E5F5' }]}>
                    <Feather name="activity" size={18} color="#7B1FA2" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.featureItemTitle}>Cumulative Trend Timeline</Text>
                    <Text style={styles.featureItemDesc}>Interactive graph tracking each grocery run adding up over time.</Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureIconBg, { backgroundColor: '#FFF3E0' }]}>
                    <Feather name="zap" size={18} color="#E65100" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.featureItemTitle}>AI Cost-Saving Swaps</Text>
                    <Text style={styles.featureItemDesc}>Data-backed suggestions on family packs and budget-friendly staples.</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : (
          /* ─── FULL ANALYTICS DASHBOARD (REAL USER DATA) ─── */
          <>
            {/* ─── Cumulative Financial Spending Trends ─── */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.sectionTitle}>Cumulative Financial Trends</Text>
                  <Text style={styles.sectionSubtitle}>
                    Progression of total grocery expenses adding up over time
                  </Text>
                </View>
                <View style={styles.filterPillGroup}>
                  {['All Receipts', 'This Month'].map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.filterPill, timeFilter === opt && styles.filterPillActive]}
                      onPress={() => {
                        setTimeFilter(opt);
                        setSelectedPoint(null);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          timeFilter === opt && styles.filterPillTextActive,
                        ]}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Interactive Tooltip Card if point is clicked */}
              {selectedPoint && (
                <View style={styles.pointTooltip}>
                  <View style={styles.tooltipIconBox}>
                    <Feather name="check-circle" size={14} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tooltipStore}>{selectedPoint.merchant}</Text>
                    <Text style={styles.tooltipDate}>
                      {selectedPoint.date} • Run: ₹{selectedPoint.amount?.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.tooltipCumLabel}>Cumulative</Text>
                    <Text style={styles.tooltipCumVal}>₹{selectedPoint.cumulative?.toLocaleString('en-IN')}</Text>
                  </View>
                </View>
              )}

              {/* SVG Cumulative Graph */}
              <View style={styles.chartWrapper}>
                <View style={styles.chartContainer}>
                  <Svg width={chartWidth} height={chartHeight}>
                    <Defs>
                      <LinearGradient id="cumGradient" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor={COLORS.primary} stopOpacity="0.22" />
                        <Stop offset="80%" stopColor={COLORS.primary} stopOpacity="0.04" />
                        <Stop offset="100%" stopColor={COLORS.primary} stopOpacity="0.0" />
                      </LinearGradient>
                    </Defs>

                    {/* Baseline grid */}
                    <Line
                      x1={0}
                      y1={chartHeight - paddingBottom}
                      x2={chartWidth}
                      y2={chartHeight - paddingBottom}
                      stroke="#E8DFD8"
                      strokeWidth={1}
                    />

                    {/* Dashed Target Monthly Budget Line */}
                    {chartData.budgetLineY > 10 && chartData.budgetLineY < chartHeight - paddingBottom ? (
                      <Line
                        x1={0}
                        y1={chartData.budgetLineY}
                        x2={chartWidth}
                        y2={chartData.budgetLineY}
                        stroke="#c0392b"
                        strokeWidth={1.5}
                        strokeDasharray={[4, 4]}
                        strokeOpacity={0.6}
                      />
                    ) : null}

                    {/* Area Gradient */}
                    {chartData.areaD ? <Path d={chartData.areaD} fill="url(#cumGradient)" /> : null}

                    {/* Line Path */}
                    {chartData.pathD ? (
                      <Path
                        d={chartData.pathD}
                        fill="none"
                        stroke={COLORS.primary}
                        strokeWidth={2.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}

                    {/* Point Circles */}
                    {chartData.coords.map((pt, i) => {
                      const isSel = selectedPoint?.id === pt.id;
                      return (
                        <Circle
                          key={`pt-${pt.id || i}`}
                          cx={pt.x}
                          cy={pt.y}
                          r={isSel ? 6 : 4}
                          fill="#FFFFFF"
                          stroke={isSel ? COLORS.primary : '#A50000'}
                          strokeWidth={isSel ? 3 : 2}
                        />
                      );
                    })}
                  </Svg>

                  {/* Target Budget Line Tag Overlay */}
                  {chartData.budgetLineY > 10 && chartData.budgetLineY < chartHeight - paddingBottom ? (
                    <View
                      style={[
                        styles.budgetGoalLineBadge,
                        { top: Math.max(chartData.budgetLineY - 18, 2) },
                      ]}
                    >
                      <Text style={styles.budgetGoalLineText}>
                        Target: ₹{analytics.monthlyBudget.toLocaleString('en-IN')}
                      </Text>
                    </View>
                  ) : null}

                  {/* Touch overlay hit targets */}
                  <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                    {chartData.coords.map((pt, i) => (
                      <TouchableOpacity
                        key={`hit-${pt.id || i}`}
                        style={[styles.chartTouchPoint, { left: Math.max(0, pt.x - 18), top: Math.max(0, pt.y - 18) }]}
                        onPress={() => setSelectedPoint(pt)}
                        activeOpacity={0.6}
                      />
                    ))}
                  </View>
                </View>

                {/* X-Axis Dates Row */}
                <View style={styles.xAxisRow}>
                  <Text style={styles.xAxisText}>{chartData.firstDate}</Text>
                  {chartData.midDate ? <Text style={styles.xAxisText}>{chartData.midDate}</Text> : null}
                  <Text style={styles.xAxisText}>{chartData.lastDate}</Text>
                </View>
              </View>

              <View style={styles.chartFootnote}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendSquare, { backgroundColor: COLORS.primary }]} />
                  <Text style={styles.legendLabel}>Cumulative Spend</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDash, { borderColor: '#c0392b' }]} />
                  <Text style={styles.legendLabel}>Budget Goal Line</Text>
                </View>
              </View>
            </View>

            {/* ─── Financial Shopping Velocity KPIs ─── */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconBox, { backgroundColor: '#E3F2FD' }]}>
                  <Feather name="shopping-bag" size={16} color="#1976D2" />
                </View>
                <Text style={styles.kpiValue}>₹{analytics.avgBasket.toLocaleString('en-IN')}</Text>
                <Text style={styles.kpiLabel}>Avg Basket Value</Text>
                <Text style={styles.kpiSub}>Across {analytics.tripCount} trip{analytics.tripCount !== 1 ? 's' : ''}</Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconBox, { backgroundColor: '#EDE7F6' }]}>
                  <Feather name="calendar" size={16} color="#5E35B1" />
                </View>
                <Text style={styles.kpiValue}>{analytics.tripCount} Trips</Text>
                <Text style={styles.kpiLabel}>Shopping Trips</Text>
                <Text style={styles.kpiSub}>Tracked in period</Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconBox, { backgroundColor: '#E8F5E9' }]}>
                  <Feather name="trending-up" size={16} color="#2E7D32" />
                </View>
                <Text style={styles.kpiValue}>₹{analytics.totalSpend.toLocaleString('en-IN')}</Text>
                <Text style={styles.kpiLabel}>Total Tracked</Text>
                <Text style={styles.kpiSub}>All-time cumulative</Text>
              </View>
            </View>

            {/* ─── Real Category Spending Distribution ─── */}
            {analytics.categories && analytics.categories.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Category Spending Distribution</Text>
                    <Text style={styles.sectionSubtitle}>
                      Authentic allocation computed from your itemized receipts
                    </Text>
                  </View>
                </View>

                <View style={styles.categoryList}>
                  {analytics.categories.map((item, idx) => (
                    <View key={idx} style={styles.categoryItem}>
                      <View style={styles.categoryItemTop}>
                        <View style={styles.categoryLabelRow}>
                          <View style={[styles.categoryColorDot, { backgroundColor: item.color || '#455A64' }]} />
                          <Text style={styles.categoryName}>{item.label}</Text>
                        </View>
                        <View style={styles.categoryAmountRow}>
                          <Text style={styles.categoryAmount}>₹{Number(item.amount || 0).toLocaleString('en-IN')}</Text>
                          <Text style={styles.categoryPct}>({item.pct}%)</Text>
                        </View>
                      </View>
                      <View style={styles.categoryTrack}>
                        <View
                          style={[
                            styles.categoryFill,
                            { width: `${Math.min(Math.max(item.pct, 0), 100)}%`, backgroundColor: item.color || '#455A64' },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ─── Smart AI Savings Tip ─── */}
            {analytics.aiTip && (
              <View style={styles.aiTipCard}>
                <View style={styles.aiTipHeader}>
                  <View style={styles.aiTipIconBox}>
                    <Feather name="zap" size={16} color="#B7791F" />
                  </View>
                  <Text style={styles.aiTipTitle}>AI Budget Optimization Tip</Text>
                </View>
                <Text style={styles.aiTipText}>{analytics.aiTip}</Text>
              </View>
            )}

            {/* ─── Fast Action Buttons ─── */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.scanActionBtn}
                onPress={() => navigation.navigate('Scan')}
                activeOpacity={0.85}
              >
                <Feather name="camera" size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.scanActionBtnText}>Scan New Receipt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.historyActionBtn}
                onPress={() => navigation.navigate('Receipts')}
                activeOpacity={0.85}
              >
                <Feather name="list" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={styles.historyActionBtnText}>View Receipt History</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: 28 }} />
      </ScrollView>
    </ScreenLayout>
  );
}

export default function SpendingAnalyticsScreen(props) {
  return (
    <ErrorBoundary>
      <SpendingAnalyticsContent {...props} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },

  // Budget Card
  budgetCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EDE4DA',
    shadowColor: '#2C1010',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  budgetCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  budgetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconPill: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetHeaderTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#2C1010',
  },
  budgetHeaderSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.mutedText,
    marginTop: 1,
  },
  budgetHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  editBudgetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF6F1',
    borderWidth: 1,
    borderColor: '#EDE6DE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  editBudgetText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },

  // Editor Box
  budgetEditorBox: {
    backgroundColor: '#FAF6F1',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EDE6DE',
  },
  editorBoxTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#3a2020',
    marginBottom: 8,
  },
  editorInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  currencyPrefix: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.primary,
  },
  budgetTextInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EDE6DE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#2C1010',
  },
  saveBudgetBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  saveBudgetBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#fff',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
  },
  presetChip: {
    backgroundColor: '#fff',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EDE6DE',
  },
  presetChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  presetChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#3a2020',
  },
  presetChipTextActive: {
    color: '#fff',
  },

  // Numbers Grid
  numbersGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  numLabel: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.mutedText,
    marginBottom: 2,
  },
  numLarge: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    color: '#2C1010',
  },
  numSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.mutedText,
    marginTop: 2,
  },
  numRightBox: {
    alignItems: 'flex-end',
  },

  // Progress Bar
  progressContainer: {
    marginBottom: 14,
  },
  progressTrack: {
    height: 10,
    backgroundColor: '#F0EBE5',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  metaPct: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#2C1010',
  },
  metaPace: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.mutedText,
  },

  // Burn Rate
  burnRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF6F1',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  burnItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  burnText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#555',
  },
  burnBold: {
    fontFamily: FONTS.bold,
    color: '#2C1010',
  },
  burnDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#DDD5CC',
    marginHorizontal: 8,
  },

  // New User Budget Notice
  newUserBudgetNotice: {
    backgroundColor: '#FAF6F1',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDE6DE',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  targetLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#555',
  },
  targetValue: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.primary,
  },
  targetDesc: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#7A6666',
    lineHeight: 18,
  },

  // Loading
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.mutedText,
    marginTop: 12,
  },

  // Empty State
  emptyContainer: {
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDE4DA',
    shadowColor: '#2C1010',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 20,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FDEEE9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 19,
    color: '#2C1010',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#7A6666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  emptyCtaText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#fff',
  },

  // Features Section
  featuresSection: {
    marginBottom: 16,
  },
  featuresHeader: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: COLORS.mutedText,
    marginBottom: 12,
    marginLeft: 4,
  },
  featureGrid: {
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDE4DA',
    gap: 12,
  },
  featureIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureItemTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#2C1010',
    marginBottom: 2,
  },
  featureItemDesc: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#7A6666',
    lineHeight: 16,
  },

  // Section Card
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EDE4DA',
    shadowColor: '#2C1010',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#2C1010',
  },
  sectionSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.mutedText,
    marginTop: 2,
    maxWidth: 220,
  },
  filterPillGroup: {
    flexDirection: 'row',
    backgroundColor: '#FAF6F1',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#EDE6DE',
  },
  filterPill: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
  },
  filterPillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.mutedText,
  },
  filterPillTextActive: {
    color: '#fff',
  },

  pointTooltip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF6F1',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EDE6DE',
    gap: 8,
  },
  tooltipIconBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FBEBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipStore: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#2C1010',
  },
  tooltipDate: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.mutedText,
  },
  tooltipCumLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.mutedText,
  },
  tooltipCumVal: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.primary,
  },

  chartWrapper: {
    width: '100%',
    marginTop: 4,
  },
  chartContainer: {
    height: 150,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  budgetGoalLineBadge: {
    position: 'absolute',
    right: 4,
    backgroundColor: '#FFF2F2',
    borderWidth: 1,
    borderColor: '#F5C2C2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  budgetGoalLineText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#c0392b',
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  xAxisText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.mutedText,
  },
  chartTouchPoint: {
    position: 'absolute',
    width: 36,
    height: 36,
  },
  chartFootnote: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSquare: {
    width: 12,
    height: 4,
    borderRadius: 2,
  },
  legendDash: {
    width: 14,
    height: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  legendLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.mutedText,
  },

  // KPI Row
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EDE4DA',
    shadowColor: '#2C1010',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  kpiIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#2C1010',
    marginBottom: 2,
  },
  kpiLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    color: '#555',
  },
  kpiSub: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: COLORS.mutedText,
    marginTop: 1,
  },

  // Categories
  categoryList: {
    gap: 12,
    marginTop: 4,
  },
  categoryItem: {
    gap: 6,
  },
  categoryItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryName: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#2C1010',
  },
  categoryAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryAmount: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#2C1010',
  },
  categoryPct: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.mutedText,
  },
  categoryTrack: {
    height: 6,
    backgroundColor: '#F0EBE5',
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryFill: {
    height: '100%',
    borderRadius: 3,
  },

  // AI Tip
  aiTipCard: {
    backgroundColor: '#FEFCF5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3E8D0',
  },
  aiTipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  aiTipIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTipTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#8A5800',
  },
  aiTipText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#5A4325',
    lineHeight: 18,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  scanActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  scanActionBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#fff',
  },
  historyActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF6F1',
    borderWidth: 1,
    borderColor: '#EDE4DA',
    paddingVertical: 14,
    borderRadius: 14,
  },
  historyActionBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
  },
});
