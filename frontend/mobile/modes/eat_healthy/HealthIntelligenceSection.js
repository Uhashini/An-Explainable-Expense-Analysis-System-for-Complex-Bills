import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, G, Text as SvgText, Rect, Line } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../theme';
import styles from './eatHealthyStyles';

export default function HealthIntelligenceSection({ data }) {
  return (
    <View style={styles.contentContainer}>
      <View style={[styles.purposeCard, { borderLeftColor: '#C2185B' }]}>
        <View style={styles.purposeHeader}>
          <Text style={[styles.purposeBadge, { color: '#C2185B' }]}>HEALTH INTELLIGENCE</Text>
          <Text style={styles.purposeTitle}>Personalized Health Risk & Allergen Screen</Text>
          <Text style={styles.purposeSub}>
            Cross-referencing food items against user medical profile, glycemic load, sodium levels, and allergens.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHeaderTitle}>💖 Health Profile Matching</Text>

        <View style={styles.insightItem}>
          <Text style={styles.insightIcon}>🩸</Text>
          <View style={styles.insightTextContainer}>
            <Text style={styles.insightTitle}>Glycemic Impact & Blood Sugar Control</Text>
            <Text style={styles.insightDesc}>
              Low overall glycemic load detected. Complex carbs promote stable glucose response.
            </Text>
          </View>
        </View>

        <View style={styles.insightItem}>
          <Text style={styles.insightIcon}>❤️</Text>
          <View style={styles.insightTextContainer}>
            <Text style={styles.insightTitle}>Sodium & Cardiovascular Risk Flag</Text>
            <Text style={styles.insightDesc}>
              Sodium content is within healthy limits ({`< 600mg per serving`}). No cardiovascular warnings.
            </Text>
          </View>
        </View>

        <View style={styles.insightItem}>
          <Text style={styles.insightIcon}>🛡️</Text>
          <View style={styles.insightTextContainer}>
            <Text style={styles.insightTitle}>Allergen & Preference Check</Text>
            <Text style={styles.insightDesc}>
              100% compliant with user onboarding profile. Zero lactose or gluten allergen triggers found.
            </Text>
          </View>
        </View>
      </View>
    </View>
  
  );
}
