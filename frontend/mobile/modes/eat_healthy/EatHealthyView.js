import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import BasicNutritionSection from './BasicNutritionSection';
import HealthIntelligenceSection from './HealthIntelligenceSection';
import { getDefaultNutritionData } from './nutritionUtils';
import styles from './eatHealthyStyles';

const HEALTHY_SUB_OPTIONS = ['Basic Nutrition Analysis', 'Health Intelligence'];

export default function EatHealthyView({
  nutritionData,
  healthySubOption,
  setHealthySubOption,
  comparisonViewMode,
  setComparisonViewMode,
  savedReceiptsList,
}) {
  const data = nutritionData || getDefaultNutritionData();

  return (
    <View>
      {/* Sub-options Tab Row */}
      <View style={styles.subOptionRow}>
        {HEALTHY_SUB_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt}
            onPress={() => setHealthySubOption(opt)}
            style={[
              styles.subOptionTab,
              healthySubOption === opt && styles.subOptionTabActive,
            ]}
          >
            <Text
              style={[
                styles.subOptionText,
                healthySubOption === opt && styles.subOptionTextActive,
              ]}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Dynamic Sub-Option Content */}
      {healthySubOption === 'Basic Nutrition Analysis' ? (
        <BasicNutritionSection
          data={data}
          comparisonViewMode={comparisonViewMode}
          setComparisonViewMode={setComparisonViewMode}
          savedReceiptsList={savedReceiptsList}
        />
      ) : (
        <HealthIntelligenceSection data={data} />
      )}
    </View>
  );
}
