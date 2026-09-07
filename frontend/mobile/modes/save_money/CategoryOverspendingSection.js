import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { FONTS, COLORS } from '../../theme';
import styles from './saveMoneyStyles';

export default function CategoryOverspendingSection({ categoryAnomaliesData, isLoading }) {
  const isObject =
    categoryAnomaliesData &&
    typeof categoryAnomaliesData === 'object' &&
    !Array.isArray(categoryAnomaliesData);

  const isAlert = isObject
    ? Boolean(categoryAnomaliesData.is_basket_anomalous)
    : Array.isArray(categoryAnomaliesData) && categoryAnomaliesData.length > 0;

  const anomaliesList = isObject
    ? categoryAnomaliesData.anomalous_categories || []
    : Array.isArray(categoryAnomaliesData)
    ? categoryAnomaliesData
    : [];

  const shapContributions = isObject ? categoryAnomaliesData.shap_contributions || [] : [];
  const primaryContributor = isObject ? categoryAnomaliesData.primary_contributor : null;
  const summaryExplanation = isObject ? categoryAnomaliesData.summary_explanation : null;

  return (
    <View
      style={[
        styles.insightItemExtravagant,
        {
          borderColor: isAlert ? '#FFCDD2' : 'rgba(142, 68, 173, 0.15)',
          borderWidth: isAlert ? 1.5 : 1,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.insightHeaderExtravagant}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: isAlert ? '#FFEBEE' : '#F3E5F5' },
          ]}
        >
          <Feather
            name={isAlert ? 'alert-triangle' : 'cpu'}
            size={20}
            color={isAlert ? '#D32F2F' : '#8E44AD'}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.insightTitleExtravagant}>Category Overspending & SHAP</Text>
            {isAlert ? (
              <View style={[styles.subBadge, { backgroundColor: '#FFEBEE' }]}>
                <Text style={[styles.subBadgeText, { color: '#D32F2F' }]}>OVERSPEND ALERT</Text>
              </View>
            ) : (
              <View style={[styles.subBadge, { backgroundColor: '#F3E5F5' }]}>
                <Text style={[styles.subBadgeText, { color: '#8E44AD' }]}>NORMAL BASKET</Text>
              </View>
            )}
          </View>
          <Text style={styles.sectionSubtitle}>
            SM-06: Machine Learning (Isolation Forest + SHAP) multivariate overspending detection.
          </Text>
        </View>
      </View>

      {/* Summary Explanation Banner */}
      {summaryExplanation ? (
        <View
          style={[
            styles.summaryBanner,
            {
              backgroundColor: isAlert ? '#FFF5F5' : '#F8F9FA',
              borderColor: isAlert ? '#FFCDD2' : '#E9ECEF',
            },
          ]}
        >
          <Text style={styles.summaryBannerIcon}>{isAlert ? '🚨' : '✨'}</Text>
          <Text
            style={[
              styles.summaryBannerText,
              { color: isAlert ? '#C62828' : '#2D3436' },
            ]}
          >
            {summaryExplanation}
          </Text>
        </View>
      ) : null}

      {/* High-Risk Spending Spikes */}
      {isAlert && anomaliesList.length > 0 ? (
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.subSectionTitle, { color: '#D32F2F', marginBottom: 8 }]}>
            ⚠️ High-Risk Category Spikes
          </Text>
          {anomaliesList.map((cat, idx) => (
            <View
              key={idx}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFF5F5',
                padding: 12,
                borderRadius: 10,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: '#FFE0E0',
              }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontFamily: FONTS.bold, fontSize: 13, color: '#D32F2F' }}>
                    {cat.category}
                  </Text>
                  {cat.category === primaryContributor && (
                    <View style={{ backgroundColor: '#D32F2F', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ color: '#fff', fontSize: 9, fontFamily: FONTS.bold }}>
                        PRIMARY DRIVER
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={{
                    fontFamily: FONTS.regular,
                    fontSize: 12,
                    color: '#636E72',
                    marginTop: 3,
                  }}
                >
                  Current Spend:{' '}
                  <Text style={{ fontFamily: FONTS.bold, color: '#D32F2F' }}>
                    ₹{cat.current_spending}
                  </Text>{' '}
                  | Baseline Average:{' '}
                  <Text style={{ fontFamily: FONTS.semiBold, color: '#2D3436' }}>
                    ₹{cat.historical_average}
                  </Text>
                </Text>
                {cat.explanation && (
                  <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: '#888', marginTop: 2 }}>
                    💡 {cat.explanation}
                  </Text>
                )}
              </View>
              <Feather name="trending-up" size={20} color="#D32F2F" />
            </View>
          ))}
        </View>
      ) : !isAlert ? (
        <View style={styles.emptyStateBox}>
          <Text style={styles.emptyStateIcon}>🛡️</Text>
          <Text style={styles.insightDesc}>
            No anomalous category spikes detected. Spending conforms to your multivariate baseline model!
          </Text>
        </View>
      ) : null}

      {/* SHAP Feature Contribution Attributions */}
      {shapContributions.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <Text style={[styles.subSectionTitle, { marginBottom: 6 }]}>
            🔬 SHAP Feature Importance Attribution
          </Text>
          <Text style={styles.shapExplanation}>
            Shapley values calculate the mathematical influence of each category on this receipt's spending pattern:
          </Text>

          {shapContributions.slice(0, 5).map((sc, i) => {
            const pct = Math.round(sc.contribution_percentage ?? 0);
            return (
              <View key={i} style={styles.shapRow}>
                <View style={styles.shapTopRow}>
                  <Text style={styles.shapCategoryName}>{sc.category}</Text>
                  <Text style={styles.shapPctValue}>{pct}% impact</Text>
                </View>
                <View style={styles.shapProgressBg}>
                  <View
                    style={[
                      styles.shapProgressFill,
                      {
                        width: `${Math.min(100, Math.max(5, pct))}%`,
                        backgroundColor:
                          pct >= 30 ? '#D32F2F' : pct >= 15 ? '#F57C00' : '#1976D2',
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
