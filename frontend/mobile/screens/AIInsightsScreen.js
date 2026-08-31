import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, G, Text as SvgText, Rect, Line } from 'react-native-svg';
import ScreenLayout from '../components/ScreenLayout';
import { COLORS, FONTS } from '../theme';
import { API_BASE_URL } from '../utils/apiConfig';
import { getUser } from '../utils/authStorage';

const MODES = ['Save Money', 'Eat Healthy', 'Gain Muscles'];

export default function AIInsightsScreen({ route, navigation }) {
  const [activeMode, setActiveMode] = useState('Save Money');
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);
  
  // The data passed from ReceiptDetailsScreen
  const { receiptId, totalAmount, items } = route.params || {};

  useEffect(() => {
    const fetchAnalytics = async () => {
      // We can analyze even without a receiptId if we have totalAmount and items!
      if (totalAmount === undefined || !items || items.length === 0) {
        setLoading(false);
        return;
      }
      
      try {
        const user = await getUser();
        const userId = user?.id || user?.user_id;
        if (!userId) return;

        const cleanPrice = (val) => {
          if (val == null) return null;
          const cleaned = String(val).replace(/[^\d.]/g, '');
          return cleaned ? parseFloat(cleaned) : null;
        };

        const payload = {
          user_id: userId,
          receipt_id: receiptId || null,
          total_amount: cleanPrice(totalAmount) || 0.0,
          items: items.map(item => ({
            name: item.name || "Unknown",
            price: cleanPrice(item.price) || 0.0,
            total_price: cleanPrice(item.total_price),
            matched_food_id: item.food_id || item.matched_product_id || null
          }))
        };

        const response = await fetch(`${API_BASE_URL}/analytics/calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (response.ok && data.status === 'success') {
          setAnalyticsData(data.data);
        } else {
          console.error("Backend error:", data);
        }
      } catch (err) {
        console.error("Error fetching analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [receiptId, totalAmount, items]);

  const renderContent = () => {
    if (loading) {
      return (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 10, fontFamily: FONTS.regular, color: COLORS.mutedText }}>Analyzing your spending patterns...</Text>
        </View>
      );
    }

    switch(activeMode) {
      case 'Save Money':
        const trend = analyticsData?.trend;
        const deviations = analyticsData?.price_deviations || [];
        const hasSignificantDeviations = deviations.some(d => Math.abs(d.change_percentage) > 5 && d.historical_average !== null);
        
        // Gauge Chart Calcs
        let maxScale = 1;
        let avgPct = 0;
        let currPct = 0;
        let isOver = false;
        if (trend) {
          maxScale = Math.max(trend.previous_average, trend.current_spending) * 1.3; // 30% padding
          avgPct = trend.previous_average / maxScale;
          currPct = trend.current_spending / maxScale;
          isOver = trend.current_spending > trend.previous_average;
        }
        
        const radius = 65;
        const strokeWidth = 14;
        const circumference = 2 * Math.PI * radius;
        const avgDashoffset = circumference - (circumference * avgPct);
        const currDashoffset = circumference - (circumference * currPct);
        const screenWidth = Dimensions.get('window').width;

        // Monthly history chart calcs
        const monthlyHistory = trend?.monthly_history || [];
        const maxMonthVal = monthlyHistory.length > 0 ? Math.max(...monthlyHistory.map(m => m.amount), 1) : 1;

        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.title}>Money Saving Insights</Text>
                <Text style={styles.subtitle}>Analyzing Receipt #{receiptId || 'N/A'}</Text>
              </View>
            </View>
            
            {/* SM-04: Spending Trend */}
            <View style={styles.insightItemExtravagant}>
              <View style={styles.insightHeaderExtravagant}>
                <View style={styles.iconBox}>
                  <Text style={{ fontSize: 20 }}>{isOver ? '📈' : '📉'}</Text>
                </View>
                <Text style={styles.insightTitleExtravagant}>Monthly Spending Trend</Text>
              </View>
              
              {trend ? (
                <>
                  <Text style={styles.insightDescExtravagant}>
                    Comparing this receipt's total <Text style={{ fontFamily: FONTS.bold, color: COLORS.primary }}>(₹{trend.current_spending})</Text> against your rolling historical average <Text style={{ fontFamily: FONTS.bold, color: COLORS.primary }}>(₹{trend.previous_average})</Text>.
                  </Text>

                  {/* SVG Donut Gauge */}
                  <View style={{ alignItems: 'center', marginVertical: 24, position: 'relative' }}>
                    <Svg width={180} height={180} viewBox="0 0 180 180">
                      <Defs>
                        <LinearGradient id="gradOver" x1="0%" y1="0%" x2="100%" y2="100%">
                          <Stop offset="0%" stopColor="#ff4d4d" />
                          <Stop offset="100%" stopColor="#c0392b" />
                        </LinearGradient>
                        <LinearGradient id="gradUnder" x1="0%" y1="0%" x2="100%" y2="100%">
                          <Stop offset="0%" stopColor="#4cd137" />
                          <Stop offset="100%" stopColor="#27ae60" />
                        </LinearGradient>
                      </Defs>
                      
                      {/* Background Track */}
                      <Circle cx="90" cy="90" r={radius} stroke="#f0f0f0" strokeWidth={strokeWidth} fill="none" />
                      
                      {/* Historical Average Track */}
                      <Circle 
                        cx="90" cy="90" r={radius} 
                        stroke="#dcdde1" strokeWidth={strokeWidth} fill="none" 
                        strokeDasharray={circumference} strokeDashoffset={avgDashoffset}
                        strokeLinecap="round" transform="rotate(-90 90 90)"
                      />
                      
                      {/* Current Spending Track */}
                      <Circle 
                        cx="90" cy="90" r={radius} 
                        stroke={isOver ? "url(#gradOver)" : "url(#gradUnder)"} 
                        strokeWidth={strokeWidth - 2} fill="none" 
                        strokeDasharray={circumference} strokeDashoffset={currDashoffset}
                        strokeLinecap="round" transform="rotate(-90 90 90)"
                      />
                    </Svg>
                    <View style={styles.gaugeCenterText}>
                      <Text style={[styles.gaugePercentage, { color: isOver ? '#c0392b' : '#27ae60' }]}>
                        {isOver ? '+' : ''}{trend.change_percentage}%
                      </Text>
                      <Text style={styles.gaugeLabel}>{isOver ? 'Higher' : 'Lower'}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#dcdde1' }]} />
                      <Text style={styles.legendText}>Historical Avg</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: isOver ? '#e74c3c' : '#2ecc71' }]} />
                      <Text style={styles.legendText}>Current Receipt</Text>
                    </View>
                  </View>

                  {/* Monthly History Bar Chart */}
                  {monthlyHistory.length > 0 && (
                    <View style={{ marginTop: 32 }}>
                      <Text style={[styles.insightTitleExtravagant, { fontSize: 14, marginBottom: 24, textAlign: 'center' }]}>Historical Monthly Totals</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 130, borderBottomWidth: 1, borderBottomColor: '#dcdde1', paddingBottom: 8 }}>
                        {monthlyHistory.map((m, idx) => {
                          const barHeight = (m.amount / maxMonthVal) * 90;
                          return (
                            <View key={idx} style={{ alignItems: 'center' }}>
                              <Text style={{ fontSize: 11, color: COLORS.primary, marginBottom: 6, fontFamily: FONTS.semiBold }}>₹{Math.round(m.amount)}</Text>
                              <View style={{ width: 28, height: Math.max(barHeight, 4), backgroundColor: '#dcdde1', borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
                              <Text style={{ fontSize: 11, color: COLORS.mutedText, marginTop: 6, fontFamily: FONTS.medium }}>{m.month}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.insightDesc}>Not enough historical data to calculate a trend.</Text>
              )}
            </View>
            
            <View style={styles.extravagantDivider} />
            
            {/* SM-05: Price Deviation */}
            <View style={styles.insightItemExtravagant}>
              <View style={styles.insightHeaderExtravagant}>
                <View style={styles.iconBox}>
                  <Text style={{ fontSize: 20 }}>🏷️</Text>
                </View>
                <Text style={styles.insightTitleExtravagant}>Price Deviation Analysis</Text>
              </View>

              {deviations.length > 0 ? (
                <>
                  <Text style={[styles.insightDescExtravagant, { marginBottom: 16 }]}>
                    Here is how the prices of items in this receipt compare to what you normally pay:
                  </Text>

                  {/* Clean List View for Price Deviations */}
                  <View style={{ marginTop: 8 }}>
                    {deviations.map((dev, idx) => {
                      const noHistory = dev.historical_average === null;
                      const isHigh = dev.difference > 0;
                      const diffColor = isHigh ? '#e74c3c' : '#27ae60';
                      const diffBg = isHigh ? 'rgba(231, 76, 60, 0.1)' : 'rgba(39, 174, 96, 0.1)';

                      return (
                        <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: idx === deviations.length - 1 ? 0 : 1, borderBottomColor: '#f1f2f6' }}>
                          <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text style={{ fontFamily: FONTS.semiBold, fontSize: 13, color: COLORS.primary, marginBottom: 2 }}>{dev.item_name}</Text>
                            {!noHistory && (
                              <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: COLORS.mutedText }}>
                                You usually pay: ₹{dev.historical_average.toFixed(2)}
                              </Text>
                            )}
                          </View>
                          
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontFamily: FONTS.bold, fontSize: 14, color: COLORS.primary, marginBottom: 4 }}>
                              ₹{dev.current_price.toFixed(2)}
                            </Text>
                            {noHistory ? (
                              <View style={{ backgroundColor: '#f1f2f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                <Text style={{ fontSize: 10, fontFamily: FONTS.semiBold, color: COLORS.mutedText }}>New Item</Text>
                              </View>
                            ) : (
                              <View style={{ backgroundColor: diffBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ fontSize: 10, fontFamily: FONTS.bold, color: diffColor }}>
                                  {isHigh ? '▲ ' : '▼ '}{Math.abs(dev.change_percentage).toFixed(1)}%
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
                      <Text style={styles.insightDesc}>No significant price deviations found. You paid normal prices!</Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.emptyStateBox}>
                  <Text style={styles.insightDesc}>No recognizable items found to compare.</Text>
                </View>
              )}
            </View>
            
            <View style={styles.extravagantDivider} />
            
            {/* SM-06 placeholder */}
            <View style={styles.insightItemExtravagant}>
              <View style={styles.insightHeaderExtravagant}>
                <View style={[styles.iconBox, { backgroundColor: '#f3e5f5' }]}>
                  <Text style={{ fontSize: 20 }}>🧠</Text>
                </View>
                <Text style={styles.insightTitleExtravagant}>Category Overspending</Text>
              </View>
              <View style={styles.emptyStateBox}>
                <Text style={styles.insightDesc}>Anomaly detection (Isolation Forest) will flag unusual spending in categories like Snacks or Dairy. (Coming Soon)</Text>
              </View>
            </View>
          </View>
        );
      case 'Eat Healthy':
        return (
          <View style={styles.card}>
            <Text style={styles.title}>Healthy Eating Insights</Text>
            <Text style={styles.subtitle}>Analyzing Receipt #{receiptId || 'N/A'}</Text>
            
            <View style={styles.insightItem}>
              <Text style={styles.insightIcon}>🥗</Text>
              <View style={styles.insightTextContainer}>
                <Text style={styles.insightTitle}>Nutrient Density</Text>
                <Text style={styles.insightDesc}>AI will evaluate the balance of fibre and essential nutrients in this basket.</Text>
              </View>
            </View>
            
            <View style={styles.insightItem}>
              <Text style={styles.insightIcon}>🛒</Text>
              <View style={styles.insightTextContainer}>
                <Text style={styles.insightTitle}>Purchase Frequency</Text>
                <Text style={styles.insightDesc}>Identify your healthy grocery staples vs impulse buys.</Text>
              </View>
            </View>
          </View>
        );
      case 'Gain Muscles':
        return (
          <View style={styles.card}>
            <Text style={styles.title}>Muscle Gain Insights</Text>
            <Text style={styles.subtitle}>Analyzing Receipt #{receiptId || 'N/A'}</Text>
            
            <View style={styles.insightItem}>
              <Text style={styles.insightIcon}>💪</Text>
              <View style={styles.insightTextContainer}>
                <Text style={styles.insightTitle}>Protein Score</Text>
                <Text style={styles.insightDesc}>AI will calculate the total protein yield from this grocery haul.</Text>
              </View>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ScreenLayout title="Spending Insights" showBack={true} navigation={navigation}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Top Navigation Toggle */}
        <View style={styles.timeFilterRow}>
          {MODES.map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.timeChip, activeMode === mode && styles.timeChipActive]}
              onPress={() => setActiveMode(mode)}
              activeOpacity={0.8}
            >
              <Text style={[styles.timeChipText, activeMode === mode && styles.timeChipTextActive]}>
                {mode}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Dynamic Content */}
        {renderContent()}

      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  // Toggle Nav Styles
  timeFilterRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  timeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  timeChipActive: {
    backgroundColor: COLORS.primary,
  },
  timeChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.mutedText,
  },
  timeChipTextActive: {
    color: '#fff',
  },
  
  // Card Styles
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.mutedText,
    marginBottom: 20,
  },
  insightItem: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  insightIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  insightTextContainer: {
    flex: 1,
  },
  insightTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#3a2020',
    marginBottom: 4,
  },
  insightDesc: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.mutedText,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#ede8e0',
    marginVertical: 20,
  },
  
  // Extravagant Styles
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  aiBadge: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.3)',
  },
  aiBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#e74c3c',
    letterSpacing: 1,
  },
  insightItemExtravagant: {
    marginBottom: 8,
  },
  insightHeaderExtravagant: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightTitleExtravagant: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#2d3436',
  },
  insightDescExtravagant: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#636e72',
    lineHeight: 20,
  },
  extravagantDivider: {
    height: 1,
    backgroundColor: '#f1f2f6',
    marginVertical: 24,
  },
  gaugeCenterText: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugePercentage: {
    fontFamily: FONTS.bold,
    fontSize: 28,
  },
  gaugeLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.mutedText,
    marginTop: -4,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.mutedText,
  },
  emptyStateBox: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f2f6',
    alignItems: 'center',
    marginTop: 10,
  },
  emptyStateIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  deviationAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
  }
});
