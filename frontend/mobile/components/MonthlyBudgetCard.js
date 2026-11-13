import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONTS } from '../theme';
import { API_BASE_URL } from '../utils/apiConfig';
import { getUser } from '../utils/authStorage';

export const STORAGE_BUDGET_KEY = 'PANTRIX_MONTHLY_BUDGET';
export const DEFAULT_BUDGET = 6000;
const BUDGET_PRESETS = [3000, 5000, 6000, 8000, 10000];

function safeFmt(n) {
  try {
    const num = Number(n);
    return Number.isFinite(num) ? num.toLocaleString('en-IN') : '0';
  } catch (e) {
    return String(n || 0);
  }
}

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

export default function MonthlyBudgetCard({ userId: propUserId, onBudgetChange, style }) {
  const [monthlyBudget, setMonthlyBudget] = useState(DEFAULT_BUDGET);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(DEFAULT_BUDGET));
  const [spendingData, setSpendingData] = useState(null);
  const [rawReceipts, setRawReceipts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved budget from local storage
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

  // Fetch spending data
  const fetchSpendingData = useCallback(async () => {
    try {
      let uid = propUserId;
      if (!uid) {
        const user = await getUser();
        uid = user?.id || 1;
      }

      // 1. Try dedicated spending analytics endpoint
      try {
        const res = await fetch(`${API_BASE_URL}/analytics/spending/${uid}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.status === 'success') {
            setSpendingData(data);
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        // Fallback to receipts endpoint
      }

      // 2. Fallback: fetch raw receipts list
      const recRes = await fetch(`${API_BASE_URL}/receipts/user/${uid}`);
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
      console.warn('Could not fetch spending data for budget card:', e);
    } finally {
      setIsLoading(false);
    }
  }, [propUserId]);

  useEffect(() => {
    fetchSpendingData();
  }, [fetchSpendingData]);

  // Handle saving new budget
  const handleSaveBudget = async () => {
    const parsed = parseFloat(budgetInput);
    if (!isNaN(parsed) && parsed > 0) {
      setMonthlyBudget(parsed);
      setIsEditingBudget(false);
      try {
        await AsyncStorage.setItem(STORAGE_BUDGET_KEY, String(parsed));
        if (onBudgetChange) onBudgetChange(parsed);
      } catch (e) {
        console.warn('Error saving budget to storage:', e);
      }
    } else {
      setBudgetInput(String(monthlyBudget));
      setIsEditingBudget(false);
    }
  };

  // Compute live budget metrics
  const budgetMetrics = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const safeBudget =
      typeof monthlyBudget === 'number' && !isNaN(monthlyBudget) && monthlyBudget > 0
        ? monthlyBudget
        : DEFAULT_BUDGET;

    // From backend analytics
    if (spendingData && spendingData.has_data && spendingData.total_receipts > 0) {
      const currentSpend = spendingData.this_month_spend ?? spendingData.total_spend ?? 0;
      const trips = spendingData.this_month_receipts ?? spendingData.total_receipts ?? 0;
      const remaining = safeBudget - currentSpend;
      const rawPct = safeBudget > 0 ? (currentSpend / safeBudget) * 100 : 0;
      const clampedPct = Math.min(Math.max(rawPct, 0), 100);

      const dailyBurn = spendingData.daily_burn ?? (trips > 0 ? Math.round(currentSpend / Math.max(1, trips * 4)) : 0);
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

      const avgBasket = trips > 0 ? Math.round(currentSpend / trips) : (spendingData.avg_basket || 0);

      return {
        hasData: true,
        monthlyBudget: safeBudget,
        currentSpend,
        remaining,
        utilizationPct: clampedPct,
        rawPct: Math.round(rawPct),
        statusColor: statColor,
        statusText: statTxt,
        statusBg: statBg,
        burnRate: dailyBurn,
        projectedMonthEnd: projected,
        avgBasket,
      };
    }

    // Client-side fallback if raw receipts exist
    if (rawReceipts && rawReceipts.length > 0) {
      let thisMonthSpend = 0;
      let thisMonthCount = 0;

      rawReceipts.forEach((r) => {
        const amt = parseFloat(r.total_amount || r.amount || 0);
        const rDate = parseSafeDate(r.date);
        if (rDate && rDate.getFullYear() === currentYear && rDate.getMonth() === currentMonth) {
          thisMonthSpend += amt;
          thisMonthCount += 1;
        }
      });

      const effectiveSpend = thisMonthSpend > 0 ? thisMonthSpend : rawReceipts.reduce((sum, r) => sum + parseFloat(r.total_amount || r.amount || 0), 0);
      const remaining = safeBudget - effectiveSpend;
      const rawPct = safeBudget > 0 ? (effectiveSpend / safeBudget) * 100 : 0;
      const clampedPct = Math.min(Math.max(rawPct, 0), 100);

      const daysPassed = Math.max(1, now.getDate());
      const dailyBurn = Math.round(effectiveSpend / daysPassed);
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

      const avgBasket = thisMonthCount > 0 ? Math.round(effectiveSpend / thisMonthCount) : Math.round(effectiveSpend / rawReceipts.length);

      return {
        hasData: true,
        monthlyBudget: safeBudget,
        currentSpend: effectiveSpend,
        remaining,
        utilizationPct: clampedPct,
        rawPct: Math.round(rawPct),
        statusColor: statColor,
        statusText: statTxt,
        statusBg: statBg,
        burnRate: dailyBurn,
        projectedMonthEnd: projected,
        avgBasket,
      };
    }

    // Zero-state for new users
    return {
      hasData: false,
      monthlyBudget: safeBudget,
      currentSpend: 0,
      remaining: safeBudget,
      utilizationPct: 0,
      rawPct: 0,
      statusColor: '#2E7D32',
      statusText: 'No Spend',
      statusBg: 'rgba(46, 125, 50, 0.12)',
      burnRate: 0,
      projectedMonthEnd: 0,
      avgBasket: 0,
    };
  }, [spendingData, rawReceipts, monthlyBudget]);

  if (isLoading) {
    return (
      <View style={[styles.budgetCard, styles.loadingCard, style]}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading monthly budget...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.budgetCard, style]}>
      {/* Top Header */}
      <View style={styles.budgetCardTop}>
        <View style={styles.budgetTitleRow}>
          <View style={[styles.iconPill, { backgroundColor: '#FBEBEB' }]}>
            <Feather name="target" size={16} color={COLORS.primary} />
          </View>
          <View style={styles.titleTextContainer}>
            <Text style={styles.budgetHeaderTitle} numberOfLines={1}>
              Monthly Target
            </Text>
            <Text style={styles.budgetHeaderSubtitle} numberOfLines={1}>
              Grocery spending pace
            </Text>
          </View>
        </View>

        <View style={styles.budgetHeaderRight}>
          {budgetMetrics.hasData && (
            <View style={[styles.statusBadge, { backgroundColor: budgetMetrics.statusBg }]}>
              <View style={[styles.statusDot, { backgroundColor: budgetMetrics.statusColor }]} />
              <Text
                style={[styles.statusBadgeText, { color: budgetMetrics.statusColor }]}
                numberOfLines={1}
              >
                {budgetMetrics.statusText}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.editBudgetPill}
            onPress={() => {
              setBudgetInput(String(budgetMetrics.monthlyBudget));
              setIsEditingBudget(!isEditingBudget);
            }}
            activeOpacity={0.7}
          >
            <Feather name={isEditingBudget ? 'x' : 'edit-2'} size={12} color={COLORS.primary} />
            <Text style={styles.editBudgetText}>{isEditingBudget ? 'Done' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Inline Quick Editor */}
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

      {/* Numbers Grid & Progress */}
      {budgetMetrics.hasData ? (
        <>
          <View style={styles.numbersGrid}>
            <View style={styles.numColLeft}>
              <Text style={styles.numLabel} numberOfLines={1}>SPENT</Text>
              <Text style={styles.numLarge} numberOfLines={1}>
                ₹{safeFmt(budgetMetrics.currentSpend)}
              </Text>
              <Text style={styles.numSub} numberOfLines={1}>
                of ₹{safeFmt(budgetMetrics.monthlyBudget)} limit
              </Text>
            </View>

            <View style={styles.numDivider} />

            <View style={styles.numColRight}>
              <Text style={styles.numLabel} numberOfLines={1}>REMAINING</Text>
              <Text
                style={[
                  styles.numLarge,
                  { color: budgetMetrics.remaining >= 0 ? '#2E7D32' : '#D32F2F' },
                ]}
                numberOfLines={1}
              >
                {budgetMetrics.remaining >= 0
                  ? `₹${safeFmt(budgetMetrics.remaining)}`
                  : `-₹${safeFmt(Math.abs(budgetMetrics.remaining))}`}
              </Text>
              <Text
                style={[
                  styles.numSub,
                  { color: budgetMetrics.remaining >= 0 ? '#2E7D32' : '#D32F2F' },
                ]}
                numberOfLines={1}
              >
                {budgetMetrics.remaining >= 0 ? 'Available' : 'Over limit'}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Number.isFinite(budgetMetrics.utilizationPct) ? Math.min(Math.max(budgetMetrics.utilizationPct, 0), 100) : 0}%`,
                    backgroundColor: budgetMetrics.statusColor || '#2E7D32',
                  },
                ]}
              />
            </View>
            <View style={styles.progressMetaRow}>
              <Text style={styles.metaPct} numberOfLines={1}>
                {budgetMetrics.rawPct}% used
              </Text>
              <Text style={styles.metaPace} numberOfLines={1}>
                {budgetMetrics.projectedMonthEnd > budgetMetrics.monthlyBudget
                  ? `Proj ₹${safeFmt(budgetMetrics.projectedMonthEnd)} (Over)`
                  : `Proj ₹${safeFmt(budgetMetrics.projectedMonthEnd)} (Safe)`}
              </Text>
            </View>
          </View>

          {/* Daily Burn Rate & Avg Basket Banner */}
          <View style={styles.burnRateRow}>
            <View style={styles.burnItem}>
              <Feather name="activity" size={13} color={COLORS.mutedText} style={{ marginRight: 5 }} />
              <Text style={styles.burnText} numberOfLines={1}>
                Daily: <Text style={styles.burnBold}>₹{budgetMetrics.burnRate}</Text>
              </Text>
            </View>
            <View style={styles.burnDivider} />
            <View style={styles.burnItem}>
              <Feather name="shopping-bag" size={13} color={COLORS.mutedText} style={{ marginRight: 5 }} />
              <Text style={styles.burnText} numberOfLines={1}>
                Avg Trip: <Text style={styles.burnBold}>₹{budgetMetrics.avgBasket}</Text>
              </Text>
            </View>
          </View>
        </>
      ) : (
        /* Zero-state notice for new users */
        <View style={styles.newUserBudgetNotice}>
          <View style={styles.targetRow}>
            <Text style={styles.targetLabel}>Target Limit:</Text>
            <Text style={styles.targetValue}>₹{safeFmt(budgetMetrics.monthlyBudget)}</Text>
          </View>
          <Text style={styles.targetDesc}>
            Set your monthly grocery spending limit above. As you upload receipts, your real-time spend pace and remaining balance will track here automatically.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.mutedText,
    marginTop: 8,
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
    gap: 8,
    flex: 1,
    marginRight: 6,
  },
  iconPill: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleTextContainer: {
    flex: 1,
  },
  budgetHeaderTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
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
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 20,
    gap: 4,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  editBudgetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FAF6F1',
    borderWidth: 1,
    borderColor: '#EDE6DE',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
  },
  editBudgetText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
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
    flexWrap: 'wrap',
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
  numbersGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  numColLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  numColRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  numDivider: {
    width: 1,
    height: 38,
    backgroundColor: '#EDE4DA',
    marginHorizontal: 8,
  },
  numLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: COLORS.mutedText,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  numLarge: {
    fontFamily: FONTS.bold,
    fontSize: 21,
    color: '#2C1010',
  },
  numSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.mutedText,
    marginTop: 2,
  },
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
    alignItems: 'center',
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
    flexShrink: 1,
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
});

