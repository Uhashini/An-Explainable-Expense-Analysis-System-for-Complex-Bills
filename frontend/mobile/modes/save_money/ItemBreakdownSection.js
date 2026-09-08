import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../theme';
import styles from './saveMoneyStyles';

export default function ItemBreakdownSection({ itemBreakdownData, isLoading }) {
  const items = itemBreakdownData?.items || itemBreakdownData?.sorted_items || [];
  const mostExpensive = itemBreakdownData?.most_expensive_item || itemBreakdownData?.highest_expense;

  const mostExpName = mostExpensive?.name || mostExpensive?.item_name || '';
  const mostExpPrice = mostExpensive?.total_cost ?? mostExpensive?.price ?? 0;
  const mostExpPct = mostExpensive?.percentage_of_total ?? mostExpensive?.percentage ?? 0;

  return (
    <View style={styles.insightItemExtravagant}>
      {/* Header */}
      <View style={styles.insightHeaderExtravagant}>
        <View style={[styles.iconBox, { backgroundColor: '#FFF3E0' }]}>
          <Feather name="list" size={20} color="#F57C00" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text style={styles.insightTitleExtravagant}>Item-wise Spending Breakdown</Text>
            {items.length > 0 && (
              <View style={[styles.subBadge, { backgroundColor: '#FFF3E0' }]}>
                <Text style={[styles.subBadgeText, { color: '#F57C00' }]}>
                  {items.length} Items Ranked
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.sectionSubtitle}>
            SM-02: Sorting items descending by price and pinpointing the most expensive purchases.
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.smLoadingBox}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.smLoadingText}>Ranking items by cost...</Text>
        </View>
      ) : items.length > 0 ? (
        <>
          {mostExpName ? (
            <View style={[styles.smHighlightBanner, { backgroundColor: 'rgba(245, 124, 0, 0.08)' }]}>
              <Text style={styles.smHighlightLabel}>💎 Most Expensive Purchase:</Text>
              <Text style={[styles.smHighlightValue, { color: '#E65100' }]}>
                {mostExpName} — ₹{mostExpPrice.toLocaleString()} {mostExpPct > 0 ? `(${mostExpPct}% of receipt)` : ''}
              </Text>
            </View>
          ) : null}

          <View style={styles.smRankedList}>
            {items.map((it, idx) => {
              const name = it.name || it.item_name || 'Grocery Item';
              const price = it.total_cost ?? it.price ?? 0;
              const pct = it.percentage_of_total ?? it.percentage ?? 0;
              const rank = it.rank || idx + 1;

              return (
                <View key={idx} style={styles.smRankedRow}>
                  <View
                    style={[
                      styles.smRankBadge,
                      rank === 1
                        ? { backgroundColor: '#D32F2F' }
                        : rank === 2
                        ? { backgroundColor: '#F57C00' }
                        : rank === 3
                        ? { backgroundColor: '#1976D2' }
                        : { backgroundColor: '#78909C' },
                    ]}
                  >
                    <Text style={styles.smRankBadgeText}>#{rank}</Text>
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.smRankedName} numberOfLines={1}>
                      {name}
                    </Text>
                    {it.category && (
                      <Text style={{ fontFamily: FONTS.regular, fontSize: 10, color: COLORS.mutedText }}>
                        {it.category}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.smRankedPrice}>₹{price.toLocaleString()}</Text>
                    {pct > 0 && (
                      <Text style={{ fontFamily: FONTS.regular, fontSize: 10, color: COLORS.mutedText }}>
                        {pct}%
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <View style={styles.emptyStateBox}>
          <Text style={styles.emptyStateIcon}>🛒</Text>
          <Text style={styles.insightDesc}>No item data available for ranking.</Text>
        </View>
      )}
    </View>
  );
}
