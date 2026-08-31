import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import ScreenLayout from '../components/ScreenLayout';
import { COLORS, FONTS } from '../theme';

const MODES = ['Save Money', 'Eat Healthy', 'Gain Muscles'];

export default function AIInsightsScreen({ route, navigation }) {
  const [activeMode, setActiveMode] = useState('Save Money');
  
  // The receiptId passed from ReceiptDetailsScreen
  const { receiptId } = route.params || {};

  const renderContent = () => {
    switch(activeMode) {
      case 'Save Money':
        return (
          <View style={styles.card}>
            <Text style={styles.title}>Money Saving Insights</Text>
            <Text style={styles.subtitle}>Analyzing Receipt #{receiptId || 'N/A'}</Text>
            
            <View style={styles.insightItem}>
              <Text style={styles.insightIcon}>📉</Text>
              <View style={styles.insightTextContainer}>
                <Text style={styles.insightTitle}>Price Deviation</Text>
                <Text style={styles.insightDesc}>AI will compare prices in this receipt against your historical average.</Text>
              </View>
            </View>
            
            <View style={styles.insightItem}>
              <Text style={styles.insightIcon}>🚨</Text>
              <View style={styles.insightTextContainer}>
                <Text style={styles.insightTitle}>Category Overspending</Text>
                <Text style={styles.insightDesc}>AI Anomaly detection (Isolation Forest) will flag unusual spending in categories like Snacks or Dairy.</Text>
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
    <ScreenLayout title="AI Spending Insights" showBack={true} navigation={navigation}>
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
  }
});
