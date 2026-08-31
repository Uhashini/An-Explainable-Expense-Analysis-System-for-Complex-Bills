import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import ScreenLayout from '../components/ScreenLayout';
import { COLORS, FONTS } from '../theme';
import { getUser } from '../utils/authStorage';
import { API_BASE_URL } from '../utils/apiConfig';

export default function ShoppingPreferencesScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [userId, setUserId] = useState(null);

  const [form, setForm] = useState({
    household_size: '',
    shopping_frequency: '',
    city: '',
  });

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
      
      if (data.onboarding) {
        setForm({
          household_size: data.onboarding.household_size || '',
          shopping_frequency: data.onboarding.shopping_frequency || '',
          city: data.onboarding.city || '',
        });
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not load shopping preferences.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        ...form
      };

      const res = await fetch(`${API_BASE_URL}/auth/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save shopping preferences');
      
      Alert.alert('Success', 'Shopping preferences updated successfully');
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not save shopping preferences.');
    } finally {
      setSaving(false);
    }
  };

  const renderField = (label, key, keyboardType = 'default') => (
    <View style={styles.row} key={key}>
      <Text style={styles.label}>{label}</Text>
      {isEditing ? (
        <TextInput
          style={styles.input}
          value={form[key]}
          onChangeText={(val) => setForm({ ...form, [key]: val })}
          keyboardType={keyboardType}
          placeholder={`Enter ${label.toLowerCase()}`}
          placeholderTextColor={COLORS.placeholder}
        />
      ) : (
        <Text style={styles.value}>{form[key] || 'Not specified'}</Text>
      )}
    </View>
  );

  return (
    <ScreenLayout title="Shopping Preferences" navigation={navigation} showBack>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : (
          <>
            {renderField('Household Size', 'household_size', 'numeric')}
            {renderField('Shopping Frequency', 'shopping_frequency')}
            {renderField('City', 'city')}

            {isEditing && (
              <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => { setIsEditing(false); fetchProfile(); }} disabled={saving}>
                  <Text style={[styles.buttonText, { color: COLORS.primary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {!loading && !isEditing && (
        <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => setIsEditing(true)}>
          <Text style={styles.fabIcon}>✎</Text>
        </TouchableOpacity>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 100,
    backgroundColor: COLORS.background,
  },
  row: {
    marginBottom: 18,
  },
  label: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
    letterSpacing: 1,
    marginBottom: 6,
  },
  value: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.primary,
    lineHeight: 22,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(148, 182, 239, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.primary,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    marginTop: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  buttonText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.surface,
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
