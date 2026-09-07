import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../theme';
import styles from './saveMoneyStyles';

export default function PriceDeviationSection({ priceDeviationData, isLoading }) {
  const deviations = priceDeviationData?.price_deviation || priceDeviationData?.deviations || [];
  const hasSignificantDeviations =
    priceDeviationData?.has_significant_deviations ??
    deviations.some((d) => Math.abs(d.change_percentage ?? d.pct_change ?? 0) > 8);

  return (
    <View style={styles.insightItemExtravagant}>
      {/* Header */}
      <View style={styles.insightHeaderExtravagant}>
        <View style={[styles.iconBox, { backgroundColor: '#FFF8E1' }]}>
          <Feather name="tag" size={20} color="#FFA000" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.insightTitleExtravagant}>Price Deviation Analysis</Text>
            {deviations.length > 0 && (
              <View style={[styles.subBadge, { backgroundColor: '#FFF8E1' }]}>
                <Text style={[styles.subBadgeText, { color: '#FFA000' }]}>
                  {deviations.length} Items Evaluated
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.sectionSubtitle}>
            SM-05: Comparing current receipt prices against historical purchase averages.
          </Text>
        </View>
      </View>

      {deviations.length > 0 ? (
        <>
          <Text style={[styles.insightDescExtravagant, { marginTop: 8, marginBottom: 12 }]}>
            Item prices in this receipt compared against your normal store prices:
          </Text>

          {/* Clean List View for Price Deviations */}
          <View style={{ marginTop: 4 }}>
            {deviations.map((dev, idx) => {
              const name = dev.item_name || dev.name || 'Item';
              const currentPrice = dev.current_price ?? dev.price ?? 0;
              const historicalAvg = dev.historical_average ?? dev.historical_avg;
              const hasHistory = historicalAvg !== null && historicalAvg !== undefined && historicalAvg > 0;
              const diff = dev.difference ?? (hasHistory ? currentPrice - historicalAvg : 0);
              const changePct = dev.change_percentage ?? dev.pct_change ?? (hasHistory ? (diff / historicalAvg) * 100 : 0);
              const isHigh = diff > 0.01;
              const isLow = diff < -0.01;

              const diffColor = isHigh ? '#D32F2F' : isLow ? '#2E7D32' : '#555';
              const diffBg = isHigh ? '#FFEBEE' : isLow ? '#E8F5E9' : '#F5F5F5';

              return (
                <View
                  key={idx}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 10,
                    borderBottomWidth: idx === deviations.length - 1 ? 0 : 1,
                    borderBottomColor: '#F0F0F0',
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text
                      style={{
                        fontFamily: FONTS.semiBold,
                        fontSize: 13,
                        color: COLORS.primary,
                        marginBottom: 2,
                      }}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    {hasHistory ? (
                      <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: COLORS.mutedText }}>
                        Normal Avg: ₹{Number(historicalAvg).toFixed(2)}
                      </Text>
                    ) : (
                      <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: '#1976D2' }}>
                        First time purchase tracked
                      </Text>
                    )}
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={{
                        fontFamily: FONTS.bold,
                        fontSize: 13,
                        color: COLORS.primary,
                        marginBottom: 3,
                      }}
                    >
                      ₹{Number(currentPrice).toFixed(2)}
                    </Text>
                    {!hasHistory ? (
                      <View style={{ backgroundColor: '#E3F2FD', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ fontSize: 10, fontFamily: FONTS.semiBold, color: '#1976D2' }}>
                          New Item
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={{
                          backgroundColor: diffBg,
                          paddingHorizontal: 7,
                          paddingVertical: 2,
                          borderRadius: 6,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 10, fontFamily: FONTS.bold, color: diffColor }}>
                          {isHigh ? '▲ +' : isLow ? '▼ -' : '• '}
                          {Math.abs(changePct).toFixed(1)}%
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {!hasSignificantDeviations && (
            <View style={styles.emptyStateBox}>
              <Text style={styles.emptyStateIcon}>✨</Text>
              <Text style={styles.insightDesc}>
                No unusual price surges found. All items were purchased at fair historical rates!
              </Text>
            </View>
          )}
        </>
      ) : (
        <View style={styles.emptyStateBox}>
          <Text style={styles.emptyStateIcon}>🏷️</Text>
          <Text style={styles.insightDesc}>No price comparison data available for this receipt.</Text>
        </View>
      )}
    </View>
  );
}
