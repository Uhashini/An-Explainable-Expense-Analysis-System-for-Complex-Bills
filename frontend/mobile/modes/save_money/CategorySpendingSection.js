import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../theme';
import styles from './saveMoneyStyles';

export default function CategorySpendingSection({ categorySpendingData, isLoading }) {
  const total = categorySpendingData?.total_spending ?? categorySpendingData?.total_spend ?? 0;
  const categories = categorySpendingData?.categories || categorySpendingData?.category_spending || [];
  const highestCategory = categorySpendingData?.highest_category || categorySpendingData?.highest_spend_category;

  const highestName = highestCategory?.category || highestCategory?.category_name || '';
  const highestAmount = highestCategory?.amount ?? 0;
  const highestPct = highestCategory?.percentage ?? (total > 0 ? Math.round((highestAmount / total) * 100) : 0);

  return (
    <View style={styles.insightItemExtravagant}>
      {/* Header */}
      <View style={styles.insightHeaderExtravagant}>
        <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
          <Feather name="pie-chart" size={20} color="#1976D2" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.insightTitleExtravagant}>Category Spending</Text>
            {total > 0 && (
              <View style={[styles.subBadge, { backgroundColor: '#E3F2FD' }]}>
                <Text style={[styles.subBadgeText, { color: '#1976D2' }]}>
                  Total: ₹{total.toLocaleString()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.sectionSubtitle}>
            SM-01: Grouping receipt items into spending categories and identifying primary expenses.
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.smLoadingBox}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.smLoadingText}>Analyzing category spending...</Text>
        </View>
      ) : categories.length > 0 ? (
        <>
          {highestName ? (
            <View style={styles.smHighlightBanner}>
              <Text style={styles.smHighlightLabel}>🏆 Highest Spend Category:</Text>
              <Text style={styles.smHighlightValue}>
                {highestName} — ₹{highestAmount.toLocaleString()} ({highestPct}%)
              </Text>
            </View>
          ) : null}

          <View style={styles.smCategoryList}>
            {categories.map((cat, idx) => {
              const colors = ['#1976D2', '#388E3C', '#F57C00', '#7B1FA2', '#0097A7', '#C2185B', '#5D4037'];
              const barColor = colors[idx % colors.length];
              const catName = cat.category || cat.category_name || 'Item';
              const catAmount = cat.amount ?? 0;
              const catPct = cat.percentage ?? (total > 0 ? Math.round((catAmount / total) * 100) : 0);

              return (
                <View key={idx} style={styles.smCategoryRow}>
                  <View style={styles.smCategoryInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                      <View style={[styles.smCategoryDot, { backgroundColor: barColor }]} />
                      <Text style={styles.smCategoryName} numberOfLines={1}>
                        {catName}
                      </Text>
                    </View>
                    <Text style={styles.smCategoryAmount}>
                      ₹{catAmount.toLocaleString()}{' '}
                      <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: COLORS.mutedText }}>
                        ({catPct}%)
                      </Text>
                    </Text>
                  </View>
                  <View style={styles.smCatBarBg}>
                    <View
                      style={[
                        styles.smCatBarFill,
                        {
                          width: `${Math.min(Math.max(catPct, 4), 100)}%`,
                          backgroundColor: barColor,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <View style={styles.emptyStateBox}>
          <Text style={styles.emptyStateIcon}>📊</Text>
          <Text style={styles.insightDesc}>No category breakdown available for this receipt.</Text>
        </View>
      )}
    </View>
  );
}
