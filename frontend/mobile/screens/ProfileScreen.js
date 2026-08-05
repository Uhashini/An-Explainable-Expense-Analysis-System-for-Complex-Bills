import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import ScreenLayout from '../components/ScreenLayout';
import { getUser } from '../utils/authStorage';
import { COLORS, FONTS } from '../theme';
import { useEffect, useState } from 'react';

const MENU = [
  {
    id: 'personal',
    title: 'Personal Information',
    subtitle: 'Name, age, and contact details',
    screen: 'PersonalInformation',
  },
  {
    id: 'goals',
    title: 'Goals',
    subtitle: 'Save money, eat healthy, gain muscle',
    screen: 'Goals',
  },
  {
    id: 'health',
    title: 'Health Profile',
    subtitle: 'Dietary needs and restrictions',
    screen: 'HealthProfile',
  },
  {
    id: 'shopping',
    title: 'Shopping Preferences',
    subtitle: 'Brands, categories, and budget',
    screen: 'ShoppingPreferences',
  },
  {
    id: 'settings',
    title: 'Settings',
    subtitle: 'Notifications, privacy, and app',
    screen: 'Settings',
  },
];

export default function ProfileScreen({ navigation }) {
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    let mounted = true;
    getUser().then((user) => {
      if (mounted && user) {
        setUserName(user.name || '');
        setUserEmail(user.email || '');
      }
    });
    return () => { mounted = false; };
  }, []);

  return (
    <ScreenLayout title="Profile">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar / User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {userName ? userName.charAt(0).toUpperCase() : 'P'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userName || 'Pantrix User'}</Text>
            <Text style={styles.userEmail}>{userEmail || 'your@email.com'}</Text>
          </View>
          <View style={styles.badgeBox}>
            <Text style={styles.badgeText}>Member</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menu}>
          {MENU.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                index === MENU.length - 1 && styles.menuItemLast,
              ]}
              activeOpacity={0.75}
              onPress={() => navigation.navigate(item.screen)}
            >
              <View style={styles.menuAccent} />
              <View style={styles.menuTextGroup}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.signOutBtn}
          activeOpacity={0.8}
          onPress={() => navigation.replace('Landing')}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 36,
  },

  // User card
  userCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarInitial: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.primary,
  },
  userInfo: { flex: 1 },
  userName: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.white,
    marginBottom: 3,
  },
  userEmail: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(244,242,239,0.75)',
  },
  badgeBox: {
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },

  // Menu
  menu: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.secondary,
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingRight: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 182, 239, 0.25)',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuAccent: {
    width: 4,
    height: 36,
    borderRadius: 2,
    backgroundColor: COLORS.secondary,
    marginRight: 14,
    marginLeft: 0,
  },
  menuTextGroup: { flex: 1 },
  menuTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.primary,
    marginBottom: 2,
  },
  menuSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153, 8, 8, 0.5)',
  },
  menuChevron: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.secondary,
    lineHeight: 26,
  },

  // Sign out
  signOutBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  signOutText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.primary,
    letterSpacing: 1,
  },
});
