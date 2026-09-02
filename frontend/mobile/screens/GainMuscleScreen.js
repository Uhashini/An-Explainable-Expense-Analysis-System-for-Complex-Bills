/**
 * GainMuscleScreen.js — Person 5: Gain Muscle / Protein Intelligence
 *
 * Displays GM-01 through GM-05 analyses using REAL data from the backend.
 * Follows existing app design system: PlusJakartaSans fonts, brand colors
 * (#990808 red, #94B6EF blue, #E6E279 yellow, #F4F2EF background),
 * white cards with shadows, ScreenLayout wrapper.
 *
 * No mock data. All values come from the API backed by real receipts and nutrition DB.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Svg, { Rect, Text as SvgText, Line, Circle, Path } from 'react-native-svg';
import ScreenLayout from '../components/ScreenLayout';
import { COLORS, FONTS } from '../theme';
import { API_BASE_URL } from '../utils/apiConfig';
import { getUser } from '../utils/authStorage';

// ─── Constants ────────────────────────────────────────────────────────────────
const QUALITY_COLORS = {
  Excellent: '#16a34a',
  Good:      '#0284c7',
  Moderate:  '#d97706',
  Low:       COLORS.primary,
  Unknown:   '#9ca3af',
};

// ─── Loading / Error / Empty States ──────────────────────────────────────────
function LoadingCard({ message }) {
  return (
    <View style={styles.stateCard}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.stateText}>{message || 'Loading...'}</Text>
    </View>
  );
}

function EmptyCard({ message, icon }) {
  return (
    <View style={styles.stateCard}>
      <Text style={styles.stateIcon}>{icon || '📊'}</Text>
      <Text style={styles.stateText}>{message}</Text>
    </View>
  );
}

function ErrorCard({ message, onRetry }) {
  return (
    <View style={[styles.stateCard, { borderColor: COLORS.primary, borderWidth: 1 }]}>
      <Text style={styles.stateIcon}>⚠️</Text>
      <Text style={[styles.stateText, { color: COLORS.primary }]}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ tag, title, color }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionTag, { backgroundColor: color || COLORS.primary }]}>
        <Text style={[styles.sectionTagText, { color: color === COLORS.accent ? COLORS.primary : '#fff' }]}>
          {tag}
        </Text>
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// ─── GM-01: Protein Availability ──────────────────────────────────────────────
function ProteinAvailabilitySection({ data }) {
  if (!data) return <LoadingCard />;

  const hasItems = data.items && data.items.length > 0;

  return (
    <View style={styles.card}>
      <SectionHeader tag="GM-01" title="PROTEIN AVAILABILITY" color={COLORS.primary} />

      {/* Total protein hero metric */}
      <View style={styles.heroMetricRow}>
        <View style={styles.heroMetric}>
          <Text style={styles.heroValue}>{data.total_protein_g?.toFixed(1) ?? '—'}g</Text>
          <Text style={styles.heroLabel}>Total Protein Purchased</Text>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroMetric}>
          <Text style={[styles.heroValue, { color: COLORS.secondary }]}>
            {data.matched_item_count ?? 0}
          </Text>
          <Text style={styles.heroLabel}>Items With Nutrition Data</Text>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroMetric}>
          <Text style={[styles.heroValue, { fontSize: 16, color: '#9ca3af' }]}>
            {data.unmatched_item_count ?? 0}
          </Text>
          <Text style={styles.heroLabel}>Items Without Data</Text>
        </View>
      </View>

      {!hasItems ? (
        <EmptyCard
          icon="🥗"
          message={data.message || 'No matched food items found. Try scanning more receipts.'}
        />
      ) : (
        <>
          <Text style={styles.subSectionTitle}>TOP PROTEIN SOURCES</Text>
          {data.items.slice(0, 5).map((item, idx) => (
            <ProteinItemRow key={`${item.food_id}-${idx}`} item={item} maxProtein={data.items[0].protein_g} />
          ))}

          {data.items.length > 5 && (
            <Text style={styles.moreText}>+{data.items.length - 5} more items</Text>
          )}
        </>
      )}
    </View>
  );
}

function ProteinItemRow({ item, maxProtein }) {
  const pct = maxProtein > 0 ? (item.protein_g / maxProtein) * 100 : 0;
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{item.food_name}</Text>
        {item.category ? (
          <Text style={styles.itemCategory}>{item.category}</Text>
        ) : null}
      </View>
      <View style={styles.itemBarArea}>
        <View style={styles.itemBarTrack}>
          <View style={[styles.itemBarFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.itemProtein}>{item.protein_g?.toFixed(1)}g</Text>
      </View>
      <View style={styles.itemMetrics}>
        {item.protein_per_rupee != null && (
          <Text style={styles.metricPill}>₹ {item.protein_per_rupee?.toFixed(2)}g/₹</Text>
        )}
      </View>
    </View>
  );
}

// ─── GM-02: Protein Quality ────────────────────────────────────────────────────
function ProteinQualitySection({ data }) {
  if (!data) return <LoadingCard />;

  const basketScore = data.basket_quality_score;
  const basketLabel = data.basket_quality_label || 'Unknown';
  const labelColor = QUALITY_COLORS[basketLabel] || '#9ca3af';
  const hasBreakdown = data.quality_breakdown && data.quality_breakdown.length > 0;

  return (
    <View style={styles.card}>
      <SectionHeader tag="GM-02" title="PROTEIN QUALITY" color={COLORS.secondary} />

      {/* Basket quality score */}
      <View style={styles.qualityScoreRow}>
        <View style={[styles.qualityScoreCircle, { borderColor: labelColor }]}>
          <Text style={[styles.qualityScoreNumber, { color: labelColor }]}>
            {basketScore != null ? Math.round(basketScore) : '—'}
          </Text>
          <Text style={styles.qualityScoreMax}>/100</Text>
        </View>
        <View style={styles.qualityScoreInfo}>
          <Text style={[styles.qualityLabel, { color: labelColor }]}>{basketLabel}</Text>
          <Text style={styles.qualitySubtitle}>Overall Basket Quality</Text>
          <View style={[styles.qualityBadge, { backgroundColor: `${labelColor}20` }]}>
            <Text style={[styles.qualityBadgeText, { color: labelColor }]}>
              {basketLabel === 'Excellent' ? 'Strong protein sources' :
               basketLabel === 'Good' ? 'Solid protein mix' :
               basketLabel === 'Moderate' ? 'Room to improve' :
               'Consider higher quality proteins'}
            </Text>
          </View>
        </View>
      </View>

      {!hasBreakdown ? (
        <EmptyCard
          icon="🔬"
          message={data.message || 'No quality data available.'}
        />
      ) : (
        <>
          <Text style={styles.subSectionTitle}>QUALITY BY FOOD</Text>
          {data.quality_breakdown.slice(0, 5).map((item, idx) => (
            <QualityItemRow key={`${item.food_id}-${idx}`} item={item} />
          ))}
        </>
      )}

      <View style={styles.methodologyBox}>
        <Text style={styles.methodologyTitle}>HOW QUALITY IS SCORED</Text>
        <Text style={styles.methodologyText}>
          Each food is scored 0–100: high-protein flag (+40), health score contribution (+30), protein-rich category (+20), ultra-processed penalty (−10). Basket score is protein-weighted.
        </Text>
      </View>
    </View>
  );
}

function QualityItemRow({ item }) {
  const labelColor = QUALITY_COLORS[item.quality_label] || '#9ca3af';
  return (
    <View style={styles.qualityRow}>
      <Text style={styles.qualityItemName} numberOfLines={1}>{item.food_name}</Text>
      <View style={styles.qualityRowRight}>
        <View style={styles.qualityBarTrack}>
          <View style={[styles.qualityBarFill, { width: `${item.quality_score}%`, backgroundColor: labelColor }]} />
        </View>
        <View style={[styles.qualityChip, { backgroundColor: `${labelColor}20` }]}>
          <Text style={[styles.qualityChipText, { color: labelColor }]}>{item.quality_label}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── GM-03: Protein Cost Efficiency ───────────────────────────────────────────
function ProteinCostSection({ data }) {
  if (!data) return <LoadingCard />;

  const hasItems = data.ranked_items && data.ranked_items.length > 0;

  return (
    <View style={styles.card}>
      <SectionHeader tag="GM-03" title="PROTEIN COST EFFICIENCY" color={COLORS.accent} />

      <View style={styles.heroMetricRow}>
        <View style={styles.heroMetric}>
          <Text style={[styles.heroValue, { color: COLORS.accent === '#E6E279' ? '#7a6f00' : COLORS.primary }]}>
            {data.overall_efficiency != null ? `${data.overall_efficiency?.toFixed(2)}` : '—'}
          </Text>
          <Text style={styles.heroLabel}>g Protein per ₹ Spent</Text>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroMetric}>
          <Text style={[styles.heroValue, { color: COLORS.primary }]}>
            ₹{data.total_protein_spend?.toFixed(0) ?? '—'}
          </Text>
          <Text style={styles.heroLabel}>Total Spent on Protein Foods</Text>
        </View>
      </View>

      {!hasItems ? (
        <EmptyCard
          icon="💰"
          message={data.message || 'No cost data available. Receipts need prices for this analysis.'}
        />
      ) : (
        <>
          {data.best && (
            <View style={styles.highlightCard}>
              <Text style={styles.highlightEmoji}>🏆</Text>
              <View style={styles.highlightInfo}>
                <Text style={styles.highlightLabel}>BEST VALUE</Text>
                <Text style={styles.highlightName}>{data.best.food_name}</Text>
                <Text style={styles.highlightStat}>
                  {data.best.protein_per_rupee?.toFixed(2)}g protein per ₹ spent
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.subSectionTitle}>RANKED BY PROTEIN PER ₹</Text>
          {data.ranked_items.slice(0, 6).map((item, idx) => (
            <CostEfficiencyRow key={`${item.food_name}-${idx}`} item={item} rank={idx + 1}
              maxPPR={data.ranked_items[0].protein_per_rupee || 1} />
          ))}
        </>
      )}
    </View>
  );
}

function CostEfficiencyRow({ item, rank, maxPPR }) {
  const pct = maxPPR > 0 ? ((item.protein_per_rupee || 0) / maxPPR) * 100 : 0;
  const isTop = rank === 1;
  return (
    <View style={[styles.costRow, isTop && styles.costRowTop]}>
      <Text style={[styles.costRank, isTop && { color: '#7a6f00' }]}>#{rank}</Text>
      <View style={styles.costInfo}>
        <Text style={styles.costName} numberOfLines={1}>{item.food_name}</Text>
        <View style={styles.costBarTrack}>
          <View style={[styles.costBarFill, { width: `${pct}%`, backgroundColor: isTop ? '#7a6f00' : COLORS.secondary }]} />
        </View>
      </View>
      <View style={styles.costMetrics}>
        <Text style={styles.costPPR}>
          {item.protein_per_rupee != null ? `${item.protein_per_rupee.toFixed(2)}` : '—'}
        </Text>
        <Text style={styles.costPPRLabel}>g/₹</Text>
      </View>
    </View>
  );
}

// ─── GM-04: Recommendations ────────────────────────────────────────────────────
function RecommendationsSection({ data, loading }) {
  if (loading) return <LoadingCard message="Searching food database for recommendations..." />;
  if (!data) return null;

  const recs = data.recommendations || [];

  return (
    <View style={styles.card}>
      <SectionHeader tag="GM-04" title="HIGH-PROTEIN RECOMMENDATIONS" color={COLORS.secondary} />

      {recs.length === 0 ? (
        <EmptyCard
          icon="🔍"
          message={data.message || 'No recommendations available. The food database may not have enough nutrition data yet.'}
        />
      ) : (
        <>
          <Text style={styles.recsSubtitle}>
            From {data.candidates_evaluated ?? '?'} foods in database — excluding {data.user_basket_food_count ?? 0} you already buy
          </Text>
          {recs.map((rec, idx) => (
            <RecommendationCard key={`${rec.food_id}-${idx}`} rec={rec} rank={idx + 1} />
          ))}
        </>
      )}
    </View>
  );
}

function RecommendationCard({ rec, rank }) {
  const qColor = QUALITY_COLORS[rec.quality_label] || '#9ca3af';
  return (
    <View style={styles.recCard}>
      <View style={styles.recHeader}>
        <View style={styles.recRankBadge}>
          <Text style={styles.recRankText}>#{rank}</Text>
        </View>
        <Text style={styles.recName} numberOfLines={1}>{rec.food_name}</Text>
        <View style={[styles.recQualityChip, { backgroundColor: `${qColor}20` }]}>
          <Text style={[styles.recQualityText, { color: qColor }]}>{rec.quality_label}</Text>
        </View>
      </View>
      <Text style={styles.recReason}>{rec.reason}</Text>
      <View style={styles.recMetricsRow}>
        <View style={styles.recMetric}>
          <Text style={styles.recMetricValue}>{rec.protein_g_per_serving?.toFixed(1)}g</Text>
          <Text style={styles.recMetricLabel}>protein/serving</Text>
        </View>
        {rec.calories_per_serving != null && (
          <View style={styles.recMetric}>
            <Text style={styles.recMetricValue}>{rec.calories_per_serving?.toFixed(0)}</Text>
            <Text style={styles.recMetricLabel}>kcal/serving</Text>
          </View>
        )}
        <View style={styles.recMetric}>
          <Text style={styles.recMetricValue}>{Math.round(rec.quality_score)}</Text>
          <Text style={styles.recMetricLabel}>quality score</Text>
        </View>
        {rec.vegetarian && (
          <View style={[styles.recBadge, { backgroundColor: '#dcfce7' }]}>
            <Text style={[styles.recBadgeText, { color: '#16a34a' }]}>🌱 Veg</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── GM-05: Protein Trend ──────────────────────────────────────────────────────
function ProteinTrendSection({ data }) {
  if (!data) return <LoadingCard />;

  if (data.insufficient_data) {
    return (
      <View style={styles.card}>
        <SectionHeader tag="GM-05" title="PROTEIN PURCHASING TREND" color={COLORS.primary} />
        <EmptyCard
          icon="📈"
          message={data.message || 'Not enough data for a trend. Upload receipts across multiple months.'}
        />
        {data.time_series && data.time_series.length === 1 && (
          <View style={styles.singlePeriodCard}>
            <Text style={styles.singlePeriodLabel}>{data.time_series[0].period}</Text>
            <Text style={styles.singlePeriodValue}>{data.time_series[0].protein_g?.toFixed(1)}g</Text>
            <Text style={styles.singlePeriodSub}>protein purchased this period</Text>
          </View>
        )}
      </View>
    );
  }

  const trendColor =
    data.trend_direction === 'Increasing' ? '#16a34a' :
    data.trend_direction === 'Decreasing' ? COLORS.primary :
    '#0284c7';

  return (
    <View style={styles.card}>
      <SectionHeader tag="GM-05" title="PROTEIN PURCHASING TREND" color={trendColor} />

      {/* Trend summary */}
      <View style={styles.trendSummaryRow}>
        <View style={styles.trendDirection}>
          <Text style={styles.trendEmoji}>{data.trend_emoji}</Text>
          <Text style={[styles.trendDirectionText, { color: trendColor }]}>
            {data.trend_direction}
          </Text>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroMetric}>
          <Text style={[styles.heroValue, { color: trendColor, fontSize: 18 }]}>
            {data.change_percentage > 0 ? '+' : ''}{data.change_percentage?.toFixed(1)}%
          </Text>
          <Text style={styles.heroLabel}>{data.first_period} → {data.last_period}</Text>
        </View>
      </View>

      {/* Bar chart */}
      <Text style={styles.subSectionTitle}>PROTEIN BY PERIOD</Text>
      <ProteinBarChart timeSeries={data.time_series} />

      {/* Period details */}
      <View style={styles.periodDetailsRow}>
        <View style={styles.periodDetail}>
          <Text style={styles.periodDetailLabel}>First Period</Text>
          <Text style={styles.periodDetailPeriod}>{data.first_period}</Text>
          <Text style={styles.periodDetailValue}>{data.first_period_protein_g?.toFixed(1)}g</Text>
        </View>
        <View style={[styles.periodDetail, { borderLeftWidth: 1, borderLeftColor: '#e5e7eb' }]}>
          <Text style={styles.periodDetailLabel}>Latest Period</Text>
          <Text style={styles.periodDetailPeriod}>{data.last_period}</Text>
          <Text style={[styles.periodDetailValue, { color: trendColor }]}>
            {data.last_period_protein_g?.toFixed(1)}g
          </Text>
        </View>
      </View>
    </View>
  );
}

function ProteinBarChart({ timeSeries }) {
  if (!timeSeries || timeSeries.length === 0) return null;

  const maxProtein = Math.max(...timeSeries.map(d => d.protein_g || 0));
  const chartH = 120;
  const barW = Math.min(40, Math.floor(280 / timeSeries.length) - 8);
  const chartWidth = timeSeries.length * (barW + 8);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartH + 40, paddingHorizontal: 4 }}>
        {timeSeries.map((d, idx) => {
          const barH = maxProtein > 0 ? Math.max(4, (d.protein_g / maxProtein) * chartH) : 4;
          const isLast = idx === timeSeries.length - 1;
          return (
            <View key={d.period} style={{ width: barW + 8, alignItems: 'center', justifyContent: 'flex-end' }}>
              <Text style={{ fontFamily: FONTS.regular, fontSize: 9, color: COLORS.primary, marginBottom: 3 }}>
                {d.protein_g?.toFixed(0)}g
              </Text>
              <View style={{
                width: barW,
                height: barH,
                backgroundColor: isLast ? COLORS.primary : COLORS.secondary,
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
                opacity: isLast ? 1.0 : 0.65,
              }} />
              <Text style={{ fontFamily: FONTS.regular, fontSize: 9, color: 'rgba(153,8,8,0.5)', marginTop: 5, textAlign: 'center' }}>
                {d.period.slice(5) || d.period}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── Protein Overview Card ─────────────────────────────────────────────────────
function ProteinOverviewCard({ gm01, gm02, gm03, gm05 }) {
  const totalProtein = gm01?.total_protein_g;
  const qualityLabel = gm02?.basket_quality_label;
  const efficiency = gm03?.overall_efficiency;
  const trendDir = gm05?.trend_direction;

  return (
    <View style={styles.overviewCard}>
      <View style={styles.overviewHeader}>
        <Text style={styles.overviewIcon}>💪</Text>
        <View>
          <Text style={styles.overviewTitle}>Protein Overview</Text>
          <Text style={styles.overviewSub}>Based on your actual grocery receipts</Text>
        </View>
      </View>

      <View style={styles.overviewGrid}>
        <OverviewStat
          label="Total Protein"
          value={totalProtein != null ? `${totalProtein.toFixed(0)}g` : '—'}
          sub="purchased"
          color={COLORS.primary}
        />
        <OverviewStat
          label="Quality"
          value={qualityLabel || '—'}
          sub="basket rating"
          color={QUALITY_COLORS[qualityLabel] || '#9ca3af'}
        />
        <OverviewStat
          label="Efficiency"
          value={efficiency != null ? `${efficiency.toFixed(2)}` : '—'}
          sub="g per ₹"
          color='#7a6f00'
        />
        <OverviewStat
          label="Trend"
          value={trendDir ? `${gm05?.trend_emoji || ''} ${trendDir}` : '—'}
          sub="protein purchases"
          color={trendDir === 'Increasing' ? '#16a34a' : trendDir === 'Decreasing' ? COLORS.primary : '#0284c7'}
        />
      </View>
    </View>
  );
}

function OverviewStat({ label, value, sub, color }) {
  return (
    <View style={styles.overviewStat}>
      <Text style={[styles.overviewStatValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.overviewStatLabel}>{label}</Text>
      <Text style={styles.overviewStatSub}>{sub}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function GainMuscleScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [recsLoading, setRecsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);          // GM-01, 02, 03, 05
  const [recsData, setRecsData] = useState(null);  // GM-04

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const user = await getUser();
      const userId = user?.id || user?.user_id;

      if (!userId) {
        setError('Not logged in. Please sign in to see your protein analysis.');
        setLoading(false);
        setRecsLoading(false);
        return;
      }

      // Fetch GM-01, 02, 03, 05
      const mainResp = await fetch(`${API_BASE_URL}/gain-muscle/${userId}`);
      if (!mainResp.ok) {
        const errBody = await mainResp.json().catch(() => ({}));
        throw new Error(errBody.detail || `Server error ${mainResp.status}`);
      }
      const mainJson = await mainResp.json();
      if (mainJson.status === 'success') {
        setData(mainJson.data);
      }
    } catch (err) {
      console.error('GainMuscleScreen fetch error:', err);
      setError(err.message || 'Failed to load protein analysis. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchRecs = useCallback(async () => {
    try {
      const user = await getUser();
      const userId = user?.id || user?.user_id;
      if (!userId) return;

      const resp = await fetch(`${API_BASE_URL}/gain-muscle/${userId}/recommendations?top_n=6`);
      if (resp.ok) {
        const json = await resp.json();
        if (json.status === 'success') {
          setRecsData(json.data);
        }
      }
    } catch (err) {
      console.error('Recommendations fetch error:', err);
    } finally {
      setRecsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchRecs();
  }, [fetchData, fetchRecs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRecsLoading(true);
    setRecsData(null);
    fetchData();
    fetchRecs();
  }, [fetchData, fetchRecs]);

  // ── Render ────────────────────────────────────────────────────────────────
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.fullLoadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.fullLoadingText}>Analysing your protein purchases...</Text>
          <Text style={styles.fullLoadingSub}>Reading your receipt history</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={{ padding: 18 }}>
          <ErrorCard message={error} onRetry={() => { setLoading(true); fetchData(); }} />
        </View>
      );
    }

    const gm01 = data?.gm01_availability;
    const gm02 = data?.gm02_quality;
    const gm03 = data?.gm03_cost_efficiency;
    const gm05 = data?.gm05_trend;

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Page intro */}
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Gain Muscle</Text>
          <Text style={styles.introSub}>
            Protein intelligence from your actual grocery purchases.
            All metrics are calculated from your real receipt history and food nutrition database.
          </Text>
        </View>

        {/* Protein overview */}
        <ProteinOverviewCard gm01={gm01} gm02={gm02} gm03={gm03} gm05={gm05} />

        {/* GM-01 */}
        <ProteinAvailabilitySection data={gm01} />

        {/* GM-02 */}
        <ProteinQualitySection data={gm02} />

        {/* GM-03 */}
        <ProteinCostSection data={gm03} />

        {/* GM-04 */}
        <RecommendationsSection data={recsData} loading={recsLoading} />

        {/* GM-05 */}
        <ProteinTrendSection data={gm05} />

        <View style={{ height: 32 }} />
      </ScrollView>
    );
  };

  return (
    <ScreenLayout
      title="GAIN MUSCLE"
      navigation={navigation}
      showBack={true}
    >
      {renderContent()}
    </ScreenLayout>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Intro
  introCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },
  introTitle: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: '#fff',
    letterSpacing: 1,
    marginBottom: 6,
  },
  introSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },

  // Overview card
  overviewCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    borderTopWidth: 3,
    borderTopColor: COLORS.primary,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  overviewIcon: { fontSize: 28 },
  overviewTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.primary,
  },
  overviewSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: 'rgba(153,8,8,0.5)',
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  overviewStat: {
    width: '47%',
    backgroundColor: '#f7f3ee',
    borderRadius: 10,
    padding: 12,
  },
  overviewStatValue: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    marginBottom: 2,
  },
  overviewStatLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#3a2020',
    marginBottom: 1,
  },
  overviewStatSub: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: 'rgba(153,8,8,0.5)',
  },

  // Generic card
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  sectionTag: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sectionTagText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    letterSpacing: 1.5,
  },
  subSectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.primary,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 4,
  },

  // Hero metrics
  heroMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#f7f3ee',
    borderRadius: 12,
    padding: 14,
  },
  heroMetric: {
    flex: 1,
    alignItems: 'center',
  },
  heroValue: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.primary,
    marginBottom: 2,
  },
  heroLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: 'rgba(153,8,8,0.5)',
    textAlign: 'center',
  },
  heroDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#ede8e0',
    marginHorizontal: 8,
  },

  // Protein item row (GM-01)
  itemRow: {
    marginBottom: 12,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    gap: 8,
  },
  itemName: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#2c1010',
    flex: 1,
  },
  itemCategory: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.secondary,
    backgroundColor: `${COLORS.secondary}20`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemBarArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0e8e8',
    borderRadius: 4,
    overflow: 'hidden',
  },
  itemBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  itemProtein: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
    width: 40,
    textAlign: 'right',
  },
  itemMetrics: {
    flexDirection: 'row',
    marginTop: 3,
  },
  metricPill: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#7a6f00',
    backgroundColor: '#fefce8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  moreText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153,8,8,0.5)',
    textAlign: 'center',
    marginTop: 6,
  },

  // Quality (GM-02)
  qualityScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  qualityScoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualityScoreNumber: {
    fontFamily: FONTS.bold,
    fontSize: 28,
  },
  qualityScoreMax: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#9ca3af',
  },
  qualityScoreInfo: { flex: 1 },
  qualityLabel: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    marginBottom: 2,
  },
  qualitySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153,8,8,0.5)',
    marginBottom: 8,
  },
  qualityBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  qualityBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  qualityItemName: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#2c1010',
    width: 120,
  },
  qualityRowRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qualityBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#f0e8e8',
    borderRadius: 3,
    overflow: 'hidden',
  },
  qualityBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  qualityChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  qualityChipText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  methodologyBox: {
    backgroundColor: '#f7f3ee',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  methodologyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: 'rgba(153,8,8,0.5)',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  methodologyText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: 'rgba(153,8,8,0.7)',
    lineHeight: 17,
  },

  // Cost efficiency (GM-03)
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fefce8',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fef08a',
    gap: 12,
  },
  highlightEmoji: { fontSize: 24 },
  highlightInfo: { flex: 1 },
  highlightLabel: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#7a6f00',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  highlightName: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#2c1010',
    marginBottom: 2,
  },
  highlightStat: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#7a6f00',
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  costRowTop: {
    backgroundColor: '#fefce8',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  costRank: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: 'rgba(153,8,8,0.4)',
    width: 28,
  },
  costInfo: { flex: 1 },
  costName: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#2c1010',
    marginBottom: 4,
  },
  costBarTrack: {
    height: 6,
    backgroundColor: '#f0e8e8',
    borderRadius: 3,
    overflow: 'hidden',
  },
  costBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  costMetrics: { alignItems: 'flex-end' },
  costPPR: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.primary,
  },
  costPPRLabel: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: 'rgba(153,8,8,0.5)',
  },

  // Recommendations (GM-04)
  recsSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: 'rgba(153,8,8,0.5)',
    marginBottom: 14,
    lineHeight: 16,
  },
  recCard: {
    backgroundColor: '#f7f3ee',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.secondary,
  },
  recHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  recRankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recRankText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#fff',
  },
  recName: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#2c1010',
  },
  recQualityChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recQualityText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  recReason: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153,8,8,0.7)',
    lineHeight: 17,
    marginBottom: 10,
  },
  recMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  recMetric: { alignItems: 'center' },
  recMetricValue: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.primary,
  },
  recMetricLabel: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: 'rgba(153,8,8,0.5)',
  },
  recBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
  },

  // Trend (GM-05)
  trendSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f3ee',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  trendDirection: {
    flex: 1,
    alignItems: 'center',
  },
  trendEmoji: { fontSize: 28, marginBottom: 4 },
  trendDirectionText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  periodDetailsRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  periodDetail: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  periodDetailLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: 'rgba(153,8,8,0.5)',
    marginBottom: 2,
  },
  periodDetailPeriod: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#3a2020',
    marginBottom: 4,
  },
  periodDetailValue: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.primary,
  },
  singlePeriodCard: {
    backgroundColor: '#f7f3ee',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  singlePeriodLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#3a2020',
    marginBottom: 4,
  },
  singlePeriodValue: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: COLORS.primary,
  },
  singlePeriodSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: 'rgba(153,8,8,0.5)',
    marginTop: 2,
  },

  // State cards (loading / empty / error)
  stateCard: {
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },
  stateIcon: { fontSize: 32 },
  stateText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: 'rgba(153,8,8,0.6)',
    textAlign: 'center',
    lineHeight: 19,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
  },
  retryText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#fff',
  },

  // Full loading
  fullLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  fullLoadingText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.primary,
    textAlign: 'center',
  },
  fullLoadingSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153,8,8,0.5)',
    textAlign: 'center',
  },
});
