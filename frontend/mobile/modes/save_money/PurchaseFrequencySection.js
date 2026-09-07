import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { FONTS, COLORS } from '../../theme';
import styles from './saveMoneyStyles';

export default function PurchaseFrequencySection({ purchaseFrequencyData, isLoading }) {
  const staples = purchaseFrequencyData?.frequent_staples || [];
  const allFreqs = purchaseFrequencyData?.all_frequencies || [];
  const totalUnique = purchaseFrequencyData?.total_unique_items || allFreqs.length || staples.length || 0;

  return (
    <View style={styles.insightItemExtravagant}>
      {/* Header */}
      <View style={styles.insightHeaderExtravagant}>
        <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
          <Feather name="repeat" size={20} color="#1976D2" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.insightTitleExtravagant}>Purchase Frequency & Staples</Text>
            {totalUnique > 0 && (
              <View style={[styles.subBadge, { backgroundColor: '#E3F2FD' }]}>
                <Text style={[styles.subBadgeText, { color: '#1976D2' }]}>
                  {totalUnique} Items Tracked
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.sectionSubtitle}>
            SM-07: Tracking repurchase velocity and identifying recurring household staples.
          </Text>
        </View>
      </View>

      {/* Frequent Staples Highlights */}
      {staples.length > 0 ? (
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.subSectionTitle, { color: '#1976D2', marginBottom: 8 }]}>
            🔁 Top Recurring Staples
          </Text>
          <View style={styles.staplesGrid}>
            {staples.slice(0, 6).map((item, idx) => (
              <View key={idx} style={styles.stapleCard}>
                <View style={styles.stapleCardTop}>
                  <Text style={styles.stapleName} numberOfLines={1}>
                    {item.item_name || item.name}
                  </Text>
                  <View style={styles.stapleBadge}>
                    <Text style={styles.stapleBadgeText}>
                      {item.purchase_count ?? 1}x
                    </Text>
                  </View>
                </View>

                <View style={styles.stapleMetricRow}>
                  <Text style={styles.stapleRateText}>
                    ⚡ {item.purchases_per_month ?? 1} / month
                  </Text>
                  <Text style={styles.stapleCategoryText} numberOfLines={1}>
                    {item.category || 'Grocery'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.emptyStateBox}>
          <Text style={styles.emptyStateIcon}>🛒</Text>
          <Text style={styles.insightDesc}>
            Scan more receipts over time to calculate purchase velocity and detect recurring staples.
          </Text>
        </View>
      )}

      {/* Full Frequency Cadence Table */}
      {allFreqs.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <Text style={[styles.subSectionTitle, { marginBottom: 8 }]}>
            All Monitored Grocery Items
          </Text>
          <View style={styles.freqTable}>
            <View style={styles.freqTableHeader}>
              <Text style={[styles.freqColName, styles.freqHeadText]}>Item Name</Text>
              <Text style={[styles.freqColCount, styles.freqHeadText]}>Purchases</Text>
              <Text style={[styles.freqColRate, styles.freqHeadText]}>Cadence</Text>
            </View>
            {allFreqs.slice(0, 6).map((it, i) => (
              <View
                key={i}
                style={[
                  styles.freqTableRow,
                  i % 2 === 1 && { backgroundColor: '#F8FAFC' },
                ]}
              >
                <Text style={[styles.freqColName, styles.freqItemText]} numberOfLines={1}>
                  {it.item_name || it.name}
                </Text>
                <Text style={[styles.freqColCount, styles.freqValueText]}>
                  {it.purchase_count ?? 1} times
                </Text>
                <Text style={[styles.freqColRate, styles.freqRateText]}>
                  {it.purchases_per_month ?? 1}/mo
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
