import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import ProgressBar from '../components/ProgressBar';
import PreferenceChip from '../components/PreferenceChip';
import GoalCard from '../components/GoalCard';
import ReviewCard from '../components/ReviewCard';

const GOALS_LIST = [
  {
    id: 'save_money',
    title: 'Save Money',
    description: 'Track spending and find savings opportunities',
    icon: '₹',
    bg: '#E8F5E9',
  },
  {
    id: 'eat_healthy',
    title: 'Eat Healthy',
    description: 'Improve your nutrition and make healthier choices',
    icon: '🥗',
    bg: '#E8F5E9',
  },
  {
    id: 'gain_muscle',
    title: 'Gain Muscle',
    description: 'Increase protein intake and build muscle',
    icon: '💪',
    bg: '#FFF3E0',
  },
  {
    id: 'lose_weight',
    title: 'Lose Weight',
    description: 'Reduce calories while maintaining nutrition',
    icon: '⚖️',
    bg: '#FCE4EC',
  },
  {
    id: 'manage_diabetes',
    title: 'Manage Diabetes',
    description: 'Monitor sugar intake and make better food choices',
    icon: '🩸',
    bg: '#F3E5F5',
  },
];

const ACTIVITY_OPTIONS = [
  'Sedentary (Little or no exercise)',
  'Lightly Active (1-3 days/week)',
  'Moderately Active (3-5 days/week)',
  'Very Active (6-7 days/week)',
  'Athlete (Physical job or 2x training)',
];

const FOOD_OPTIONS = [
  'Non Vegetarian',
  'Vegetarian',
  'Vegan',
  'Eggetarian',
  'Pescatarian',
];

const HOUSEHOLD_OPTIONS = [
  '1 Person',
  '2 People',
  '3 People',
  '4 People',
  '5+ People',
];

const STORES_LIST = [
  'Reliance Fresh',
  'D-Mart',
  'More Supermarket',
  'Big Bazaar',
  'Spencer\'s',
  'Local Market',
];

export default function OnboardingFlowScreen({ navigation, route }) {
  const [step, setStep] = useState(1);

  // Form State initialized with defaults from mockup
  const [data, setData] = useState({
    age: '25',
    gender: 'Male',
    height: '175',
    weight: '70',
    activity: 'Moderately Active',
    food: 'Non Vegetarian',
    allergies: '',
    conditions: ['Hypertension'],
    goals: ['Save Money', 'Eat Healthy', 'Gain Muscle'],
    budget: '6000',
    stores: ['Reliance Fresh', 'D-Mart', 'More Supermarket'],
    household: '3 People',
    location: 'Hyderabad, Telangana',
  });

  // Custom Dropdown Modal State
  const [modalType, setModalType] = useState(null); // 'gender' | 'activity' | 'food' | 'household'

  const update = (key, value) => setData((d) => ({ ...d, [key]: value }));

  const toggleCondition = (cond) => {
    if (cond === 'None') {
      update('conditions', ['None']);
    } else {
      const current = data.conditions.filter((c) => c !== 'None');
      if (current.includes(cond)) {
        update('conditions', current.filter((c) => c !== cond));
      } else {
        update('conditions', [...current, cond]);
      }
    }
  };

  const toggleGoal = (title) => {
    if (data.goals.includes(title)) {
      update('goals', data.goals.filter((g) => g !== title));
    } else {
      update('goals', [...data.goals, title]);
    }
  };

  const toggleStore = (store) => {
    if (data.stores.includes(store)) {
      update('stores', data.stores.filter((s) => s !== store));
    } else {
      update('stores', [...data.stores, store]);
    }
  };

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    }
  };

  const renderDropdownModal = () => {
    if (!modalType) return null;

    let options = [];
    let title = '';
    let selectedValue = '';
    let onSelect = () => {};

    if (modalType === 'gender') {
      options = ['Male', 'Female', 'Other', 'Prefer not to say'];
      title = 'Select Gender';
      selectedValue = data.gender;
      onSelect = (val) => update('gender', val);
    } else if (modalType === 'activity') {
      options = ACTIVITY_OPTIONS;
      title = 'Select Activity Level';
      selectedValue = data.activity;
      onSelect = (val) => update('activity', val.split(' (')[0]);
    } else if (modalType === 'food') {
      options = FOOD_OPTIONS;
      title = 'Select Food Preference';
      selectedValue = data.food;
      onSelect = (val) => update('food', val);
    } else if (modalType === 'household') {
      options = HOUSEHOLD_OPTIONS;
      title = 'Select Household Size';
      selectedValue = data.household;
      onSelect = (val) => update('household', val);
    }

    return (
      <Modal visible={!!modalType} transparent animationType="fade" onRequestClose={() => setModalType(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalType(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{title}</Text>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.modalOption, selectedValue === opt && styles.modalOptionSelected]}
                onPress={() => {
                  onSelect(opt);
                  setModalType(null);
                }}
              >
                <Text style={[styles.modalOptionText, selectedValue === opt && styles.modalOptionTextSelected]}>
                  {opt}
                </Text>
                {selectedValue === opt && <Ionicons name="checkmark" size={18} color="#7A3525" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Progress Stepper (1 - 2 - 3 - 4 - 5) */}
          <ProgressBar step={step} total={5} />

          {/* Step 1: Personal Information */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <View style={styles.heroHeader}>
                <Text style={styles.mainTitle}>Tell Us About You</Text>
                <Text style={styles.subtitle}>This helps us provide better insights</Text>

                <View style={styles.illustrationContainer}>
                  <View style={styles.illustrationCircle}>
                    <Ionicons name="clipboard-outline" size={42} color="#7A3525" />
                  </View>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardHeader}>Personal Information</Text>

                <Text style={styles.inputLabel}>Age</Text>
                <TextInput
                  style={styles.textInput}
                  value={data.age}
                  onChangeText={(v) => update('age', v)}
                  keyboardType="numeric"
                  placeholder="e.g. 25"
                  placeholderTextColor="#A89F99"
                />

                <Text style={styles.inputLabel}>Gender</Text>
                <TouchableOpacity
                  style={styles.dropdownInput}
                  onPress={() => setModalType('gender')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dropdownText}>{data.gender || 'Select Gender'}</Text>
                  <Ionicons name="chevron-down" size={18} color="#7C6F6B" />
                </TouchableOpacity>

                <Text style={styles.inputLabel}>Height (cm)</Text>
                <TextInput
                  style={styles.textInput}
                  value={data.height}
                  onChangeText={(v) => update('height', v)}
                  keyboardType="numeric"
                  placeholder="e.g. 175"
                  placeholderTextColor="#A89F99"
                />

                <Text style={styles.inputLabel}>Weight (kg)</Text>
                <TextInput
                  style={styles.textInput}
                  value={data.weight}
                  onChangeText={(v) => update('weight', v)}
                  keyboardType="numeric"
                  placeholder="e.g. 70"
                  placeholderTextColor="#A89F99"
                />
              </View>

              <TouchableOpacity style={styles.btnPrimary} onPress={handleNext} activeOpacity={0.85}>
                <Text style={styles.btnPrimaryText}>Next</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: Your Lifestyle */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <View style={styles.heroHeader}>
                <Text style={styles.mainTitle}>Your Lifestyle</Text>
                <View style={styles.illustrationContainer}>
                  <View style={styles.illustrationCircle}>
                    <Ionicons name="heart-outline" size={42} color="#7A3525" />
                  </View>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.inputLabel}>Activity Level</Text>
                <TouchableOpacity
                  style={styles.dropdownInput}
                  onPress={() => setModalType('activity')}
                  activeOpacity={0.8}
                >
                  <View style={styles.dropdownValueRow}>
                    <Ionicons name="walk-outline" size={18} color="#7A3525" style={{ marginRight: 8 }} />
                    <Text style={styles.dropdownText}>{data.activity || 'Select Activity Level'}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#7C6F6B" />
                </TouchableOpacity>

                <Text style={styles.inputLabel}>Food Preference</Text>
                <TouchableOpacity
                  style={styles.dropdownInput}
                  onPress={() => setModalType('food')}
                  activeOpacity={0.8}
                >
                  <View style={styles.dropdownValueRow}>
                    <MaterialCommunityIcons name="food-variant" size={18} color="#7A3525" style={{ marginRight: 8 }} />
                    <Text style={styles.dropdownText}>{data.food || 'Select Food Preference'}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#7C6F6B" />
                </TouchableOpacity>

                <Text style={styles.inputLabel}>Allergies (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={data.allergies}
                  onChangeText={(v) => update('allergies', v)}
                  placeholder="Ex: Nuts, Dairy, Gluten..."
                  placeholderTextColor="#A89F99"
                />

                <Text style={styles.inputLabel}>Medical Conditions (Optional)</Text>
                <View style={styles.chipRow}>
                  {['Diabetes', 'Hypertension', 'High Cholesterol', 'PCOS', 'None'].map((cond) => (
                    <PreferenceChip
                      key={cond}
                      label={cond}
                      selected={data.conditions.includes(cond)}
                      onPress={() => toggleCondition(cond)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep(1)} activeOpacity={0.85}>
                  <Text style={styles.btnSecondaryText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={handleNext} activeOpacity={0.85}>
                  <Text style={styles.btnPrimaryText}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 3: Your Goals */}
          {step === 3 && (
            <View style={styles.stepContainer}>
              <View style={styles.heroHeader}>
                <Text style={styles.mainTitle}>Your Goals</Text>
                <Text style={styles.subtitle}>Choose one or more goals</Text>
              </View>

              <View style={{ width: '100%', marginBottom: 12 }}>
                {GOALS_LIST.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    selected={data.goals.includes(goal.title)}
                    onPress={() => toggleGoal(goal.title)}
                  />
                ))}
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep(2)} activeOpacity={0.85}>
                  <Text style={styles.btnSecondaryText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={handleNext} activeOpacity={0.85}>
                  <Text style={styles.btnPrimaryText}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 4: Shopping Preferences */}
          {step === 4 && (
            <View style={styles.stepContainer}>
              <View style={styles.heroHeader}>
                <Text style={styles.mainTitle}>Shopping Preferences</Text>
                <View style={styles.illustrationContainer}>
                  <View style={styles.illustrationCircle}>
                    <Ionicons name="basket-outline" size={42} color="#7A3525" />
                  </View>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.inputLabel}>Monthly Grocery Budget</Text>
                <View style={styles.currencyInputRow}>
                  <Text style={styles.currencyPrefix}>₹</Text>
                  <TextInput
                    style={[styles.textInput, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
                    value={data.budget}
                    onChangeText={(v) => update('budget', v)}
                    keyboardType="numeric"
                    placeholder="6000"
                    placeholderTextColor="#A89F99"
                  />
                </View>


                <Text style={[styles.inputLabel, { marginTop: 14 }]}>Household Size</Text>
                <TouchableOpacity
                  style={styles.dropdownInput}
                  onPress={() => setModalType('household')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dropdownText}>{data.household || 'Select Household Size'}</Text>
                  <Ionicons name="chevron-down" size={18} color="#7C6F6B" />
                </TouchableOpacity>

                <Text style={styles.inputLabel}>Location (Optional)</Text>
                <View style={styles.locationInputRow}>
                  <Ionicons name="location-outline" size={18} color="#7A3525" style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.textInput, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
                    value={data.location}
                    onChangeText={(v) => update('location', v)}
                    placeholder="Hyderabad, Telangana"
                    placeholderTextColor="#A89F99"
                  />
                </View>
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep(3)} activeOpacity={0.85}>
                  <Text style={styles.btnSecondaryText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={handleNext} activeOpacity={0.85}>
                  <Text style={styles.btnPrimaryText}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 5: Review & Finish */}
          {step === 5 && (
            <View style={styles.stepContainer}>
              <View style={styles.heroHeader}>
                <Text style={styles.mainTitle}>Review & Finish</Text>
                <Text style={styles.subtitle}>Please review your details</Text>
              </View>

              <ReviewCard
                icon="👤"
                title="Personal Information"
                onEdit={() => setStep(1)}
                rows={[
                  ['Age', data.age],
                  ['Gender', data.gender],
                  ['Height', data.height ? `${data.height} cm` : '—'],
                  ['Weight', data.weight ? `${data.weight} kg` : '—'],
                ]}
              />

              <ReviewCard
                icon="❤️"
                title="Lifestyle"
                onEdit={() => setStep(2)}
                rows={[
                  ['Activity Level', data.activity],
                  ['Food Preference', data.food],
                  ['Medical Conditions', data.conditions.join(', ') || 'None'],
                  ['Allergies', data.allergies || 'None'],
                ]}
              />

              <ReviewCard
                icon="🎯"
                title="Goals"
                onEdit={() => setStep(3)}
                rows={[
                  ['Goals', data.goals.join(', ') || 'None'],
                ]}
              />

              <ReviewCard
                icon="🛒"
                title="Preferences"
                onEdit={() => setStep(4)}
                rows={[
                  ['Budget', data.budget ? `₹${Number(data.budget).toLocaleString()} / month` : '—'],
                  ['Household Size', data.household],
                ]}
              />

              <TouchableOpacity
                style={[styles.btnPrimary, { width: '100%', marginTop: 8 }]}
                onPress={handleNext}
                activeOpacity={0.85}
              >
                <Text style={styles.btnPrimaryText}>Finish Setup</Text>
              </TouchableOpacity>

              <Text style={styles.disclaimerText}>
                You can change these later in settings.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {renderDropdownModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 36,
    alignItems: 'center',
  },
  stepContainer: {
    width: '100%',
    alignItems: 'center',
  },
  heroHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#3B1A13',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#7C6F6B',
    textAlign: 'center',
  },
  illustrationContainer: {
    marginTop: 14,
    alignItems: 'center',
  },
  illustrationCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#F3E9E3',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8DCD4',
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#EFEBE4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D1D19',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A3B36',
    marginBottom: 6,
    marginTop: 4,
  },
  textInput: {
    backgroundColor: '#FAFAF8',
    borderWidth: 1.5,
    borderColor: '#E6E0D8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#2D1D19',
    marginBottom: 12,
  },
  dropdownInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAF8',
    borderWidth: 1.5,
    borderColor: '#E6E0D8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  dropdownValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 14,
    color: '#2D1D19',
    fontWeight: '500',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  currencyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
    borderWidth: 1.5,
    borderColor: '#E6E0D8',
    borderRadius: 12,
    paddingLeft: 14,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7A3525',
    marginRight: 4,
  },
  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
    borderWidth: 1.5,
    borderColor: '#E6E0D8',
    borderRadius: 12,
    paddingLeft: 14,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  storeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F1EB',
    borderWidth: 1,
    borderColor: '#E2DAD0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  storeTagSelected: {
    backgroundColor: '#F7EBE8',
    borderColor: '#7A3525',
  },
  storeTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A3B36',
  },
  storeTagTextSelected: {
    color: '#7A3525',
  },
  storeTagRemove: {
    fontSize: 12,
    color: '#7A3525',
    marginLeft: 6,
    fontWeight: '700',
  },
  navRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btnPrimary: {
    backgroundColor: '#7A3525',
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7A3525',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  btnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#7A3525',
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    color: '#7A3525',
    fontSize: 15,
    fontWeight: '700',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#7C6F6B',
    marginTop: 10,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D1D19',
    marginBottom: 14,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F1EB',
  },
  modalOptionSelected: {
    backgroundColor: '#FDFCFB',
  },
  modalOptionText: {
    fontSize: 14,
    color: '#4A3B36',
    fontWeight: '500',
  },
  modalOptionTextSelected: {
    color: '#7A3525',
    fontWeight: '700',
  },
});
