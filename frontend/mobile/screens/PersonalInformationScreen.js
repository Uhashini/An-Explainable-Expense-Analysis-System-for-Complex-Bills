import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import ScreenLayout from '../components/ScreenLayout';
import { COLORS, FONTS } from '../theme';
import { getUser } from '../utils/authStorage';
import { API_BASE_URL } from '../utils/apiConfig';

export default function PersonalInformationScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [userId, setUserId] = useState(null);

  const [form, setForm] = useState({
    name: '',
    age: '',
    gender: '',
    height: '',
    weight: '',
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
      
      setForm({
        name: data.name || '',
        age: data.age ? String(data.age) : '',
        gender: data.gender || '',
        height: data.onboarding?.height || '',
        weight: data.onboarding?.weight || '',
      });
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not load personal information.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error('Failed to save profile');
      Alert.alert('Success', 'Profile updated successfully');
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not save personal information.');
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
        />
      ) : (
        <Text style={styles.value}>{form[key] || '-'}</Text>
      )}
    </View>
  );

  return (
    <ScreenLayout title="Personal Information" navigation={navigation} showBack>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : (
          <>
            {renderField('Full Name', 'name')}
            {renderField('Age', 'age', 'numeric')}
            {renderField('Gender', 'gender')}
            {renderField('Height', 'height')}
            {renderField('Weight', 'weight')}

            {isEditing ? (
              <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => { setIsEditing(false); fetchProfile(); }} disabled={saving}>
                  <Text style={[styles.buttonText, { color: COLORS.primary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={() => setIsEditing(true)}>
                <Text style={styles.buttonText}>Edit Information</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    backgroundColor: COLORS.background,
    flexGrow: 1,
  },
  row: {
    marginBottom: 18,
  },
  label: {
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 6,
  },
  value: {
    fontFamily: FONTS.regular,
    color: COLORS.primary,
    fontSize: 16,
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
});
