import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert
} from 'react-native';
import ScreenLayout from '../components/ScreenLayout';
import { COLORS, FONTS } from '../theme';
import { getUser } from '../utils/authStorage';
import { API_BASE_URL } from '../utils/apiConfig';

const GOALS = [
  {
    id: 'save-money',
    tag: '$',
    title: 'Save Money',
    description: 'Track grocery spending, discover cheaper alternatives, and stay within your monthly budget.',
  },
  {
    id: 'eat-healthier',
    tag: 'EH',
    title: 'Eat Healthier',
    description: 'Analyze nutritional value, reduce unhealthy purchases, and build better eating habits.',
  },
  {
    id: 'gain-muscle',
    tag: 'GM',
    title: 'Gain Muscle',
    description: 'Monitor protein intake, discover high-protein foods, and support muscle growth.',
  },
  {
    id: 'lose-weight',
    tag: 'LW',
    title: 'Lose Weight',
    description: 'Track calories, reduce excess sugar and fat intake, and maintain a calorie deficit.',
  },
  {
    id: 'balanced-lifestyle',
    tag: 'BL',
    title: 'Balanced Lifestyle',
    description: 'Maintain a healthy balance between nutrition, spending, and overall wellness.',
  },
];

export default function EditGoalsScreen({ navigation }) {
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const user = await getUser();
      if (!user || !user.id) {
        Alert.alert('Error', 'Not logged in');
        return;
      }
      setUserId(user.id);
      
      const res = await fetch(`${API_BASE_URL}/auth/me/${user.id}`);
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();
      
      if (data.onboarding && data.onboarding.goals) {
        const userGoals = data.onboarding.goals.split(',').map(g => g.trim());
        setSelected(new Set(userGoals));
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not load your current goals.');
    } finally {
      setLoading(false);
    }
  };

  const toggleGoal = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const goalsString = Array.from(selected).join(',');
      const payload = {
        user_id: userId,
        goals: goalsString,
      };

      const res = await fetch(`${API_BASE_URL}/auth/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to save goals');
      
      Alert.alert('Success', 'Goals updated successfully');
      navigation.goBack();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not save goals.');
    } finally {
      setSaving(false);
    }
  };

  const selectedGoals = GOALS.filter((g) => selected.has(g.id));

  return (
    <ScreenLayout title="Your Goals" navigation={navigation} showBack>
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.subtitle}>Choose one or more goals to focus on.</Text>
          </View>

          {/* Goal Cards */}
          <View style={styles.cardsContainer}>
            {GOALS.map((goal) => {
              const isSelected = selected.has(goal.id);
              return (
                <TouchableOpacity
                  key={goal.id}
                  style={[styles.card, isSelected && styles.cardSelected]}
                  onPress={() => toggleGoal(goal.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.cardTagBox, isSelected && styles.cardTagBoxSelected]}>
                      <Text style={[styles.cardTag, isSelected && styles.cardTagSelected]}>
                        {goal.tag}
                      </Text>
                    </View>
                    <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                      {goal.title}
                    </Text>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                  </View>
                  <Text style={[styles.cardDescription, isSelected && styles.cardDescriptionSelected]}>
                    {goal.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected Chips */}
          {selectedGoals.length > 0 && (
            <View style={styles.chipsSection}>
              <Text style={styles.chipsLabel}>SELECTED GOALS</Text>
              <View style={styles.chipsRow}>
                {selectedGoals.map((goal) => (
                  <TouchableOpacity
                    key={goal.id}
                    style={styles.chip}
                    onPress={() => toggleGoal(goal.id)}
                  >
                    <Text style={styles.chipText}>{goal.title}</Text>
                    <Text style={styles.chipRemove}>  ✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Save FAB */}
      {!loading && (
        <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.fabIcon}>✓</Text>}
        </TouchableOpacity>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 100, // Space for FAB
    backgroundColor: COLORS.background,
  },
  header: {
    marginBottom: 20,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    color: COLORS.mutedText,
    fontSize: 14,
    lineHeight: 20,
  },
  cardsContainer: {
    width: '100%',
    gap: 10,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.divider,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(139, 26, 26, 0.04)',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTagBox: {
    width: 34,
    height: 28,
    borderRadius: 6,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTagBoxSelected: {
    backgroundColor: COLORS.primary,
  },
  cardTag: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#fff',
    letterSpacing: 0.5,
  },
  cardTagSelected: {
    color: COLORS.accent,
  },
  cardTitle: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#3a2020',
    letterSpacing: 0.3,
  },
  cardTitleSelected: {
    color: COLORS.primary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: COLORS.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxMark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  cardDescription: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.mutedText,
    lineHeight: 18,
  },
  cardDescriptionSelected: {
    color: COLORS.primaryLight,
  },
  chipsSection: {
    width: '100%',
    marginTop: 16,
  },
  chipsLabel: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.primary,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#fff',
    letterSpacing: 0.3,
  },
  chipRemove: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: {
    fontSize: 24,
    color: '#fff',
    lineHeight: 28,
  },
});
