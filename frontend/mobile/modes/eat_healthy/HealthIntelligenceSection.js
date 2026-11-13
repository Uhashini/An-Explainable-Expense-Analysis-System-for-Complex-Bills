import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  StyleSheet
} from 'react-native';
import Svg, { Rect, G, Text as SvgText, Line, Circle } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../theme';
import { API_BASE_URL } from '../../utils/apiConfig';
import { getUser } from '../../utils/authStorage';
import { computeLocalHealthIntelligence } from './healthIntelligenceUtils';
import styles from './eatHealthyStyles';

const SECTION_TABS = [
  { id: 'all', label: 'All Insights', icon: 'grid' },
  { id: 'glycemic', label: 'Glycemic', icon: 'activity' },
  { id: 'sodium', label: 'Sodium & Heart', icon: 'heart' },
  { id: 'allergen', label: 'Allergens', icon: 'shield' },
  { id: 'balance', label: 'Nutrition Balance', icon: 'pie-chart' },
  { id: 'recs', label: 'Recommendations', icon: 'award' },
];

export default function HealthIntelligenceSection({
  data,
  receiptId,
  receiptData,
  savedReceiptsList = []
}) {
  const [activeTab, setActiveTab] = useState('all');
  const [intelligence, setIntelligence] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    glycemic: true,
    sodium: true,
    allergen: true,
    balance: true,
    recs: true,
  });

  const toggleSection = (sec) => {
    setExpandedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const extractItems = () => {
    if (receiptData?.receipt_info?.items) return receiptData.receipt_info.items;
    if (receiptData?.items) return receiptData.items;
    if (data?.parsedItems) return data.parsedItems;
    return [];
  };

  const loadHealthIntelligence = async () => {
    setIsLoading(true);
    let currentUser = null;
    let onboardingData = null;

    try {
      currentUser = await getUser();
      setUserProfile(currentUser);

      if (currentUser?.id) {
        // Fetch fresh onboarding profile from backend
        try {
          const profileRes = await fetch(`${API_BASE_URL}/auth/me/${currentUser.id}`);
          if (profileRes.ok) {
            const pJson = await profileRes.json();
            if (pJson.onboarding) onboardingData = pJson.onboarding;
          }
        } catch (e) {
          console.log('Using cached user profile context');
        }
      }
    } catch (e) {
      console.warn('Could not load user profile storage', e);
    }

    const items = extractItems();

    // 1. Instant client-side computation for immediate responsive UI
    const instantData = computeLocalHealthIntelligence(
      items,
      currentUser || { name: 'User' },
      onboardingData || {}
    );
    setIntelligence(instantData);

    // 2. Fetch enriched backend analysis from PostgreSQL / Neon DB
    try {
      const payload = {
        user_id: currentUser?.id || 1,
        receipt_id: receiptId || null,
        items: items.map((it) => ({
          name: it.name || it.matched_name || it.display_name || 'Item',
          quantity: it.quantity || it.qty || 1,
          price: it.price || it.total_price || null,
          rate: it.rate || it.unit_price || null,
          matched_food_id: it.matched_food_id || it.food_id || null,
          category: it.category || null,
        })),
      };

      const res = await fetch(`${API_BASE_URL}/analytics/health-intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success') {
          setIntelligence(json);
        }
      }
    } catch (err) {
      console.log('Using instant health intelligence calculation:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHealthIntelligence();
  }, [receiptId, receiptData]);

  const intel = intelligence || computeLocalHealthIntelligence(extractItems(), userProfile || {}, {});
  const userCtx = intel.user_context || {};
  const glycemic = intel.glycemic_impact || {};
  const sodium = intel.sodium_cardiovascular || {};
  const allergen = intel.allergen_detection || {};
  const balance = intel.nutritional_balance || {};
  const recs = intel.personalized_recommendations || [];

  return (
    <View style={localStyles.container}>
      {/* ── 1. Purpose Banner & Personalized Health Profile ── */}
      <View style={[styles.purposeCard, { borderLeftColor: COLORS.primary }]}>
        <View style={styles.badgeRow}>
          <Text style={[styles.purposeBadge, { color: COLORS.primary }]}>
            HEALTH INTELLIGENCE
          </Text>
          <View style={localStyles.personalizedPill}>
            <Feather name="user-check" size={11} color={COLORS.primary} style={{ marginRight: 4 }} />
            <Text style={localStyles.personalizedPillText}>
              Personalized for {userCtx.name || 'You'}
            </Text>
          </View>
        </View>

        <Text style={styles.purposeTitle}>Personalized Nutrition & Risk Screen</Text>
        <Text style={styles.purposeSub}>
          Cross-referencing purchased foods against your personal health goals, declared allergies, glycemic load, and cardiovascular sodium targets.
        </Text>

        {/* User Context Chips */}
        <View style={localStyles.contextChipsRow}>
          <View style={localStyles.contextChip}>
            <Text style={localStyles.contextChipLabel}>🎯 Goal:</Text>
            <Text style={localStyles.contextChipValue}>{userCtx.goals || 'Eat Healthy'}</Text>
          </View>
          <View style={localStyles.contextChip}>
            <Text style={localStyles.contextChipLabel}>🥗 Diet:</Text>
            <Text style={localStyles.contextChipValue}>{userCtx.food_preference || 'Standard'}</Text>
          </View>
          <View style={localStyles.contextChip}>
            <Text style={localStyles.contextChipLabel}>🛡️ Allergies:</Text>
            <Text style={localStyles.contextChipValue}>{userCtx.allergies || 'None'}</Text>
          </View>
          {userCtx.medical_conditions && userCtx.medical_conditions !== 'None declared' && (
            <View style={[localStyles.contextChip, { borderColor: '#FFCDD2', backgroundColor: '#FFEBEE' }]}>
              <Text style={[localStyles.contextChipLabel, { color: '#C62828' }]}>❤️ Condition:</Text>
              <Text style={[localStyles.contextChipValue, { color: '#C62828' }]}>{userCtx.medical_conditions}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── 2. Interactive Navigation Filter Tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={localStyles.tabsScroll}
      >
        {SECTION_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[localStyles.filterTab, isActive && localStyles.filterTabActive]}
            >
              <Feather
                name={tab.icon}
                size={13}
                color={isActive ? '#FFFFFF' : COLORS.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={[localStyles.filterTabText, isActive && localStyles.filterTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {isLoading && !intelligence && (
        <View style={localStyles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={localStyles.loadingText}>Analyzing health profile & nutritional database...</Text>
        </View>
      )}

      {/* ── 3. Section A: Glycemic Impact Analysis ── */}
      {(activeTab === 'all' || activeTab === 'glycemic') && (
        <View style={styles.card}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => toggleSection('glycemic')}
            style={localStyles.sectionHeaderTouchable}
          >
            <View style={localStyles.sectionTitleGroup}>
              <View style={[localStyles.iconBadge, { backgroundColor: '#FFEBEE' }]}>
                <Text style={localStyles.iconBadgeText}>🩸</Text>
              </View>
              <View>
                <Text style={styles.cardHeaderTitle}>Glycemic Impact & Glucose Stability</Text>
                <Text style={localStyles.sectionSub}>Carbohydrate quality & postprandial glucose spike analysis</Text>
              </View>
            </View>
            <View style={[localStyles.statusBadge, { backgroundColor: glycemic.status_color + '15', borderColor: glycemic.status_color }]}>
              <Text style={[localStyles.statusBadgeText, { color: glycemic.status_color }]}>
                {glycemic.status_badge || 'Low Impact'}
              </Text>
            </View>
          </TouchableOpacity>

          {expandedSections.glycemic && (
            <View style={localStyles.sectionBody}>
              {/* Glycemic Metrics Highlights */}
              <View style={localStyles.glycemicMetricsRow}>
                <View style={localStyles.glycemicMiniCard}>
                  <Text style={localStyles.glycemicMiniVal}>{glycemic.glycemic_load_total ?? 0}</Text>
                  <Text style={localStyles.glycemicMiniLabel}>Glycemic Load</Text>
                  <Text style={localStyles.glycemicMiniSub}>{glycemic.overall_level} Tier</Text>
                </View>

                <View style={localStyles.glycemicMiniCard}>
                  <Text style={localStyles.glycemicMiniVal}>{glycemic.fiber_to_carb_ratio ?? 0}</Text>
                  <Text style={localStyles.glycemicMiniLabel}>Fiber : Carb Ratio</Text>
                  <Text style={localStyles.glycemicMiniSub}>{glycemic.fiber_to_carb_ratio >= 0.12 ? 'Protective' : 'Low Buffer'}</Text>
                </View>

                <View style={localStyles.glycemicMiniCard}>
                  <Text style={localStyles.glycemicMiniVal}>{glycemic.total_sugar_g ?? 0}g</Text>
                  <Text style={localStyles.glycemicMiniLabel}>Simple Sugar</Text>
                  <Text style={localStyles.glycemicMiniSub}>of {glycemic.total_carbs_g ?? 0}g Carbs</Text>
                </View>
              </View>

              {/* Clinical Explanation */}
              <View style={localStyles.explanationBox}>
                <Feather name="info" size={14} color="#C2185B" style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={localStyles.explanationText}>{glycemic.summary}</Text>
              </View>

              {/* High Impact Items Callout */}
              {glycemic.high_impact_items && glycemic.high_impact_items.length > 0 && (
                <View style={localStyles.itemsCalloutContainer}>
                  <Text style={localStyles.calloutTitle}>Foods Contributing to Rapid Glucose Rise:</Text>
                  {glycemic.high_impact_items.map((it, idx) => (
                    <View key={idx} style={localStyles.itemCalloutRow}>
                      <Feather name="alert-circle" size={13} color="#E53935" style={{ marginRight: 6 }} />
                      <Text style={localStyles.itemCalloutName}>{it.name}</Text>
                      <Text style={localStyles.itemCalloutDetail}>
                        {it.carbs_g}g Carbs • GL {it.glycemic_load}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Protective Items */}
              {glycemic.protective_items && glycemic.protective_items.length > 0 && (
                <View style={[localStyles.itemsCalloutContainer, { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' }]}>
                  <Text style={[localStyles.calloutTitle, { color: '#2E7D32' }]}>Glucose-Stabilizing Choices:</Text>
                  {glycemic.protective_items.map((it, idx) => (
                    <View key={idx} style={localStyles.itemCalloutRow}>
                      <Feather name="check-circle" size={13} color="#2E7D32" style={{ marginRight: 6 }} />
                      <Text style={[localStyles.itemCalloutName, { color: '#1B5E20' }]}>{it.name}</Text>
                      <Text style={[localStyles.itemCalloutDetail, { color: '#2E7D32' }]}>
                        {it.fiber_g ? `${it.fiber_g}g Fiber` : `${it.protein_g}g Protein`}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Actionable Alternatives */}
              {glycemic.alternatives && glycemic.alternatives.length > 0 && (
                <View style={localStyles.alternativesBox}>
                  <Text style={localStyles.alternativesHeading}>💡 Healthier Glycemic Swaps:</Text>
                  {glycemic.alternatives.map((alt, idx) => (
                    <Text key={idx} style={localStyles.alternativeBullet}>
                      • {alt}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* ── 4. Section B: Sodium & Cardiovascular Health ── */}
      {(activeTab === 'all' || activeTab === 'sodium') && (
        <View style={styles.card}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => toggleSection('sodium')}
            style={localStyles.sectionHeaderTouchable}
          >
            <View style={localStyles.sectionTitleGroup}>
              <View style={[localStyles.iconBadge, { backgroundColor: '#FFEBEE' }]}>
                <Text style={localStyles.iconBadgeText}>❤️</Text>
              </View>
              <View>
                <Text style={styles.cardHeaderTitle}>Sodium & Cardiovascular Risk Flag</Text>
                <Text style={localStyles.sectionSub}>Estimated sodium intake against AHA / WHO reference values</Text>
              </View>
            </View>
            <View style={[localStyles.statusBadge, { backgroundColor: sodium.status_color + '15', borderColor: sodium.status_color }]}>
              <Text style={[localStyles.statusBadgeText, { color: sodium.status_color }]}>
                {sodium.status_badge || 'Optimal'}
              </Text>
            </View>
          </TouchableOpacity>

          {expandedSections.sodium && (
            <View style={localStyles.sectionBody}>
              {/* Sodium Progress Bar */}
              <View style={localStyles.sodiumProgressContainer}>
                <View style={localStyles.sodiumProgressHeader}>
                  <Text style={localStyles.sodiumCurrentText}>
                    {sodium.total_sodium_mg ?? 0} mg <Text style={localStyles.sodiumSubText}>estimated sodium</Text>
                  </Text>
                  <Text style={localStyles.sodiumLimitText}>
                    Limit: {sodium.daily_limit_mg ?? 2000} mg/day
                  </Text>
                </View>

                {/* Progress bar line */}
                <View style={localStyles.progressBarTrack}>
                  <View
                    style={[
                      localStyles.progressBarFill,
                      {
                        width: `${Math.min(100, sodium.sodium_percentage || 0)}%`,
                        backgroundColor: sodium.status_color || '#2E7D32',
                      },
                    ]}
                  />
                </View>
                <View style={localStyles.progressLegend}>
                  <Text style={localStyles.legendText}>{sodium.sodium_percentage || 0}% of daily reference ceiling</Text>
                  <Text style={localStyles.legendText}>{sodium.overall_level} Tier</Text>
                </View>
              </View>

              {/* Clinical Explanation */}
              <View style={localStyles.explanationBox}>
                <Feather name="heart" size={14} color="#C2185B" style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={localStyles.explanationText}>{sodium.summary}</Text>
              </View>

              {/* High Sodium Items List */}
              {sodium.high_sodium_items && sodium.high_sodium_items.length > 0 ? (
                <View style={localStyles.itemsCalloutContainer}>
                  <Text style={localStyles.calloutTitle}>Items with Elevated Sodium (&gt; 400 mg):</Text>
                  {sodium.high_sodium_items.map((it, idx) => (
                    <View key={idx} style={localStyles.itemCalloutRow}>
                      <Feather name="alert-triangle" size={13} color="#FB8C00" style={{ marginRight: 6 }} />
                      <Text style={localStyles.itemCalloutName}>{it.name}</Text>
                      <Text style={localStyles.itemCalloutDetail}>{it.sodium_mg} mg ({it.pct_daily_limit}% limit)</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[localStyles.itemsCalloutContainer, { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' }]}>
                  <Text style={[localStyles.calloutTitle, { color: '#2E7D32' }]}>
                    ✓ No individual items exceed 400 mg sodium threshold.
                  </Text>
                </View>
              )}

              {/* Cardiovascular Guidance */}
              {sodium.alternatives && sodium.alternatives.length > 0 && (
                <View style={localStyles.alternativesBox}>
                  <Text style={localStyles.alternativesHeading}>🌿 Heart-Healthy Seasoning Guidance:</Text>
                  {sodium.alternatives.map((alt, idx) => (
                    <Text key={idx} style={localStyles.alternativeBullet}>
                      • {alt}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* ── 5. Section C: Allergen & Dietary Restriction Screening ── */}
      {(activeTab === 'all' || activeTab === 'allergen') && (
        <View style={styles.card}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => toggleSection('allergen')}
            style={localStyles.sectionHeaderTouchable}
          >
            <View style={localStyles.sectionTitleGroup}>
              <View style={[localStyles.iconBadge, { backgroundColor: '#E3F2FD' }]}>
                <Text style={localStyles.iconBadgeText}>🛡️</Text>
              </View>
              <View>
                <Text style={styles.cardHeaderTitle}>Allergen & Dietary Restrictions Check</Text>
                <Text style={localStyles.sectionSub}>Screened against declared allergies & vegetarian/vegan lifestyle</Text>
              </View>
            </View>
            <View style={[localStyles.statusBadge, { backgroundColor: allergen.status_color + '15', borderColor: allergen.status_color }]}>
              <Text style={[localStyles.statusBadgeText, { color: allergen.status_color }]}>
                {allergen.status_badge || 'Allergens Clean'}
              </Text>
            </View>
          </TouchableOpacity>

          {expandedSections.allergen && (
            <View style={localStyles.sectionBody}>
              {/* Declared Profiles Summary */}
              <View style={localStyles.allergenProfileRow}>
                <View style={localStyles.allergenProfilePill}>
                  <Text style={localStyles.allergenProfileLabel}>Declared Allergies:</Text>
                  <Text style={localStyles.allergenProfileVal}>
                    {Array.isArray(allergen.declared_allergies) ? allergen.declared_allergies.join(', ') : allergen.declared_allergies}
                  </Text>
                </View>
                <View style={localStyles.allergenProfilePill}>
                  <Text style={localStyles.allergenProfileLabel}>Lifestyle Diet:</Text>
                  <Text style={localStyles.allergenProfileVal}>{allergen.declared_diet || 'Standard'}</Text>
                </View>
              </View>

              {/* Warning Cards List */}
              {allergen.warnings && allergen.warnings.length > 0 ? (
                <View style={{ gap: 8, marginTop: 10 }}>
                  {allergen.warnings.map((w, idx) => {
                    const isCritical = w.severity === 'CRITICAL_TRIGGER';
                    return (
                      <View
                        key={idx}
                        style={[
                          localStyles.allergenWarningCard,
                          {
                            backgroundColor: isCritical ? '#FFEBEE' : '#FFF3E0',
                            borderColor: isCritical ? '#EF9A9A' : '#FFE082',
                          },
                        ]}
                      >
                        <Feather
                          name={isCritical ? 'alert-octagon' : 'alert-triangle'}
                          size={18}
                          color={isCritical ? '#D32F2F' : '#E65100'}
                          style={{ marginRight: 10, marginTop: 2 }}
                        />
                        <View style={{ flex: 1 }}>
                          <View style={localStyles.warningHeaderRow}>
                            <Text style={[localStyles.warningTitle, { color: isCritical ? '#C62828' : '#E65100' }]}>
                              {w.allergen_type} Trigger ({w.item_name})
                            </Text>
                            <Text style={localStyles.confidenceBadge}>{w.confidence}</Text>
                          </View>
                          <Text style={localStyles.warningMessage}>{w.message}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={[localStyles.itemsCalloutContainer, { backgroundColor: '#E8F5E9', borderColor: '#C8E6C9' }]}>
                  <Feather name="check-circle" size={14} color="#2E7D32" style={{ marginRight: 8 }} />
                  <Text style={[localStyles.calloutTitle, { color: '#2E7D32' }]}>
                    Zero declared allergen triggers detected in scanned item titles.
                  </Text>
                </View>
              )}

              {/* Item-by-item transparency breakdown */}
              {allergen.item_breakdown && allergen.item_breakdown.length > 0 && (
                <View style={localStyles.itemAllergenListContainer}>
                  <Text style={localStyles.itemBreakdownHeading}>Scanned Item Allergen Transparency:</Text>
                  {allergen.item_breakdown.map((ib, idx) => (
                    <View key={idx} style={localStyles.itemBreakdownRow}>
                      <Text style={localStyles.ibName}>{ib.name}</Text>
                      <View style={localStyles.ibTagsRow}>
                        {ib.detected_allergens.map((tag, tIdx) => (
                          <View key={tIdx} style={localStyles.ibTag}>
                            <Text style={localStyles.ibTagText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Safety Mandate Notice */}
              <View style={localStyles.safetyNoticeBox}>
                <Feather name="shield" size={13} color="#5D4037" style={{ marginRight: 6 }} />
                <Text style={localStyles.safetyNoticeText}>
                  {allergen.safety_disclaimer}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── 6. Section D: Nutritional Balance Analysis ── */}
      {(activeTab === 'all' || activeTab === 'balance') && (
        <View style={styles.card}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => toggleSection('balance')}
            style={localStyles.sectionHeaderTouchable}
          >
            <View style={localStyles.sectionTitleGroup}>
              <View style={[localStyles.iconBadge, { backgroundColor: '#EDE7F6' }]}>
                <Text style={localStyles.iconBadgeText}>🥗</Text>
              </View>
              <View>
                <Text style={styles.cardHeaderTitle}>Nutritional Balance & Macro Gaps</Text>
                <Text style={localStyles.sectionSub}>Macronutrient ratio distribution, strengths, and dietary balance</Text>
              </View>
            </View>
            <View style={[styles.gradePill, { backgroundColor: '#E8F5E9' }]}>
              <Text style={[styles.gradePillText, { color: '#2E7D32' }]}>
                Score {balance.balance_score || 85}/100
              </Text>
            </View>
          </TouchableOpacity>

          {expandedSections.balance && (
            <View style={localStyles.sectionBody}>
              {/* Macro Distribution Stacked Bar */}
              {balance.macro_distribution_pct && (
                <View style={localStyles.macroDistributionContainer}>
                  <Text style={localStyles.macroDistHeader}>Macronutrient Calorie Distribution:</Text>
                  <View style={localStyles.stackedMacroBar}>
                    <View style={{ flex: balance.macro_distribution_pct.protein || 20, backgroundColor: '#42A5F5' }} />
                    <View style={{ flex: balance.macro_distribution_pct.carbs || 55, backgroundColor: '#E6E279' }} />
                    <View style={{ flex: balance.macro_distribution_pct.fat || 25, backgroundColor: '#AB47BC' }} />
                  </View>
                  <View style={localStyles.stackedMacroLegend}>
                    <Text style={localStyles.legendDotText}>
                      <Text style={{ color: '#1976D2', fontFamily: FONTS.bold }}>■ </Text>
                      Protein {balance.macro_distribution_pct.protein}%
                    </Text>
                    <Text style={localStyles.legendDotText}>
                      <Text style={{ color: '#FBC02D', fontFamily: FONTS.bold }}>■ </Text>
                      Carbs {balance.macro_distribution_pct.carbs}%
                    </Text>
                    <Text style={localStyles.legendDotText}>
                      <Text style={{ color: '#8E24AA', fontFamily: FONTS.bold }}>■ </Text>
                      Fat {balance.macro_distribution_pct.fat}%
                    </Text>
                  </View>
                </View>
              )}

              {/* 3x2 Nutrients Grid */}
              {balance.macronutrients && (
                <View style={localStyles.macroGrid}>
                  <View style={localStyles.macroGridItem}>
                    <Text style={localStyles.macroGridVal}>{balance.macronutrients.calories || 0}</Text>
                    <Text style={localStyles.macroGridLabel}>Total Calories (kcal)</Text>
                  </View>
                  <View style={localStyles.macroGridItem}>
                    <Text style={localStyles.macroGridVal}>{balance.macronutrients.protein_g || 0}g</Text>
                    <Text style={localStyles.macroGridLabel}>Protein</Text>
                  </View>
                  <View style={localStyles.macroGridItem}>
                    <Text style={localStyles.macroGridVal}>{balance.macronutrients.carbs_g || 0}g</Text>
                    <Text style={localStyles.macroGridLabel}>Carbohydrates</Text>
                  </View>
                  <View style={localStyles.macroGridItem}>
                    <Text style={localStyles.macroGridVal}>{balance.macronutrients.fiber_g || 0}g</Text>
                    <Text style={localStyles.macroGridLabel}>Dietary Fiber</Text>
                  </View>
                  <View style={localStyles.macroGridItem}>
                    <Text style={localStyles.macroGridVal}>{balance.macronutrients.fat_g || 0}g</Text>
                    <Text style={localStyles.macroGridLabel}>Fats</Text>
                  </View>
                  <View style={localStyles.macroGridItem}>
                    <Text style={localStyles.macroGridVal}>{balance.macronutrients.sugar_g || 0}g</Text>
                    <Text style={localStyles.macroGridLabel}>Sugar</Text>
                  </View>
                </View>
              )}

              {/* Strengths and Gaps */}
              <View style={localStyles.strengthsGapsRow}>
                {/* Strengths */}
                <View style={localStyles.strengthsCol}>
                  <Text style={localStyles.colHeadingText}>✓ Nutritional Strengths:</Text>
                  {balance.strengths?.map((s, idx) => (
                    <Text key={idx} style={localStyles.strengthItemText}>• {s}</Text>
                  ))}
                </View>

                {/* Gaps */}
                <View style={localStyles.gapsCol}>
                  <Text style={localStyles.colHeadingText}>⚠️ Nutritional Gaps:</Text>
                  {balance.gaps?.map((g, idx) => (
                    <Text key={idx} style={localStyles.gapItemText}>• {g}</Text>
                  ))}
                </View>
              </View>

              {/* Missing Food Groups */}
              {balance.missing_food_groups && balance.missing_food_groups.length > 0 && (
                <View style={localStyles.missingGroupsBox}>
                  <Text style={localStyles.missingGroupsLabel}>Food Groups to Include:</Text>
                  <View style={localStyles.missingPillsRow}>
                    {balance.missing_food_groups.map((mg, idx) => (
                      <View key={idx} style={localStyles.missingPill}>
                        <Feather name="plus-circle" size={11} color={COLORS.primary} style={{ marginRight: 4 }} />
                        <Text style={localStyles.missingPillText}>{mg}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* ── 7. Section E: Personalized Health Recommendations ── */}
      {(activeTab === 'all' || activeTab === 'recs') && (
        <View style={styles.card}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => toggleSection('recs')}
            style={localStyles.sectionHeaderTouchable}
          >
            <View style={localStyles.sectionTitleGroup}>
              <View style={[localStyles.iconBadge, { backgroundColor: '#FFF8E1' }]}>
                <Text style={localStyles.iconBadgeText}>💡</Text>
              </View>
              <View>
                <Text style={styles.cardHeaderTitle}>Personalized Health Recommendations</Text>
                <Text style={localStyles.sectionSub}>Customized action items for {userCtx.goals || 'your goals'}</Text>
              </View>
            </View>
            <View style={[styles.gradePill, { backgroundColor: '#FFF3E0' }]}>
              <Text style={[styles.gradePillText, { color: '#E65100' }]}>
                {recs.length} Action Items
              </Text>
            </View>
          </TouchableOpacity>

          {expandedSections.recs && (
            <View style={localStyles.sectionBody}>
              {recs && recs.length > 0 ? (
                recs.map((rec, idx) => (
                  <View key={idx} style={localStyles.recommendationCard}>
                    <View style={localStyles.recHeaderRow}>
                      <View style={localStyles.recCategoryBadge}>
                        <Text style={localStyles.recCategoryText}>{rec.category}</Text>
                      </View>
                      <View style={localStyles.recImpactBadge}>
                        <Text style={localStyles.recImpactText}>{rec.impact}</Text>
                      </View>
                    </View>

                    <Text style={localStyles.recTitle}>{rec.title}</Text>
                    <Text style={localStyles.recDesc}>{rec.description}</Text>

                    {rec.suggested_swap && (
                      <View style={localStyles.suggestedSwapRow}>
                        <Text style={localStyles.swapLabel}>Suggested Action / Swap:</Text>
                        <Text style={localStyles.swapVal}>{rec.suggested_swap}</Text>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <Text style={localStyles.emptyText}>No recommendations needed for current cart.</Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* ── 8. Medical & Legal Disclaimer ── */}
      <View style={localStyles.disclaimerCard}>
        <Feather name="alert-circle" size={14} color="#757575" style={{ marginRight: 8, marginTop: 1 }} />
        <Text style={localStyles.disclaimerText}>
          {intel.disclaimer || 'Pantrics Health Intelligence provides automated nutritional estimations for wellness and educational purposes. Values are estimated from USDA/NIN data and OCR parsing. For clinical medical conditions, prescription diets, or severe food allergies, always verify official product labels.'}
        </Text>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    gap: 14,
    paddingBottom: 24,
  },
  personalizedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(153, 8, 8, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(153, 8, 8, 0.15)',
  },
  personalizedPillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    color: COLORS.primary,
  },
  contextChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF8F5',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 4,
  },
  contextChipLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.mutedText,
  },
  contextChipValue: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
  },
  tabsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(153, 8, 8, 0.15)',
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterTabText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: '#FFF',
    borderRadius: 12,
    gap: 10,
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.mutedText,
  },
  sectionHeaderTouchable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconBadgeText: {
    fontSize: 18,
  },
  sectionSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.mutedText,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
  },
  sectionBody: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0EBE6',
    paddingTop: 14,
  },
  glycemicMetricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  glycemicMiniCard: {
    flex: 1,
    backgroundColor: '#FAF8F5',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECE7E1',
    alignItems: 'center',
  },
  glycemicMiniVal: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.primary,
  },
  glycemicMiniLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    color: COLORS.mutedText,
    marginTop: 2,
    textAlign: 'center',
  },
  glycemicMiniSub: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: '#8D6E63',
    marginTop: 1,
  },
  explanationBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF8F0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FB8C00',
  },
  explanationText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#3E2723',
    lineHeight: 17,
    flex: 1,
  },
  itemsCalloutContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  calloutTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#C62828',
    marginBottom: 6,
  },
  itemCalloutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  itemCalloutName: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#37474F',
    flex: 1,
  },
  itemCalloutDetail: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#78909C',
  },
  alternativesBox: {
    backgroundColor: '#F1F8E9',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#DCEDC8',
  },
  alternativesHeading: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#33691E',
    marginBottom: 4,
  },
  alternativeBullet: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#2E7D32',
    lineHeight: 16,
    marginBottom: 3,
  },
  sodiumProgressContainer: {
    marginBottom: 14,
  },
  sodiumProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  sodiumCurrentText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.primary,
  },
  sodiumSubText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.mutedText,
  },
  sodiumLimitText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.mutedText,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ECE7E1',
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.mutedText,
  },
  allergenProfileRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  allergenProfilePill: {
    flex: 1,
    backgroundColor: '#FAF8F5',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  allergenProfileLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 9,
    color: COLORS.mutedText,
  },
  allergenProfileVal: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    marginTop: 1,
  },
  allergenWarningCard: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  warningHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  warningTitle: {
    fontFamily: FONTS.bold,
    fontSize: 12,
  },
  confidenceBadge: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: '#757575',
  },
  warningMessage: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#3E2723',
    lineHeight: 16,
  },
  itemAllergenListContainer: {
    marginTop: 10,
    backgroundColor: '#FAF8F5',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ECE7E1',
  },
  itemBreakdownHeading: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    marginBottom: 6,
  },
  itemBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  ibName: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#37474F',
    flex: 1,
  },
  ibTagsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  ibTag: {
    backgroundColor: '#EDE7F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ibTagText: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: '#512DA8',
  },
  safetyNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 8,
    backgroundColor: '#EFEBE9',
    borderRadius: 8,
  },
  safetyNoticeText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#5D4037',
    flex: 1,
    lineHeight: 14,
  },
  macroDistributionContainer: {
    marginBottom: 14,
  },
  macroDistHeader: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    marginBottom: 6,
  },
  stackedMacroBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 6,
  },
  stackedMacroLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendDotText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.mutedText,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  macroGridItem: {
    width: Platform.OS === 'web' ? '31.5%' : '48%',
    backgroundColor: '#FAF8F5',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#ECE7E1',
    alignItems: 'center',
  },
  macroGridVal: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.primary,
  },
  macroGridLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.mutedText,
    marginTop: 1,
  },
  strengthsGapsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  strengthsCol: {
    flex: 1,
    backgroundColor: '#F1F8E9',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCEDC8',
  },
  gapsCol: {
    flex: 1,
    backgroundColor: '#FFF8E1',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  colHeadingText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#33691E',
    marginBottom: 4,
  },
  strengthItemText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#2E7D32',
    lineHeight: 14,
    marginBottom: 3,
  },
  gapItemText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#F57F17',
    lineHeight: 14,
    marginBottom: 3,
  },
  missingGroupsBox: {
    marginTop: 4,
  },
  missingGroupsLabel: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.primary,
    marginBottom: 4,
  },
  missingPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  missingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  missingPillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    color: COLORS.primary,
  },
  recommendationCard: {
    backgroundColor: '#FAF8F5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ECE7E1',
    marginBottom: 10,
  },
  recHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  recCategoryBadge: {
    backgroundColor: '#EDE7F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recCategoryText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#512DA8',
  },
  recImpactBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recImpactText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#2E7D32',
  },
  recTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
    marginBottom: 3,
  },
  recDesc: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#424242',
    lineHeight: 16,
  },
  suggestedSwapRow: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFFDE7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFF59D',
  },
  swapLabel: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#F57F17',
  },
  swapVal: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#37474F',
    marginTop: 1,
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.mutedText,
    fontStyle: 'italic',
  },
  disclaimerCard: {
    flexDirection: 'row',
    backgroundColor: '#EEEEEE',
    borderRadius: 10,
    padding: 12,
  },
  disclaimerText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#616161',
    lineHeight: 14,
    flex: 1,
  },
});
