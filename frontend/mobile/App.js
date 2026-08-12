import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator } from 'react-native';
import HomeIcon from './assets/icons/home.svg';
import ReceiptIcon from './assets/icons/receipt.svg';
import CameraIcon from './assets/icons/camera.svg';
import InsightsIcon from './assets/icons/insights.svg';
import ProfileIcon from './assets/icons/profile.svg';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';

// â”€â”€ Auth Screens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import LandingScreen       from './screens/LandingScreen';
import SignInScreen        from './screens/SignInScreen';
import SignUpScreen        from './screens/SignUpScreen';

// â”€â”€ Onboarding Screens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import PersonalInfoScreen  from './screens/OnboardingFlowScreen';
import GoalsScreen         from './screens/GoalsScreen';

// â”€â”€ Main App Screens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import DashboardScreen          from './screens/DashboardScreen';
import ReceiptHistoryScreen     from './screens/ReceiptHistoryScreen';
import UploadReceiptScreen      from './screens/UploadReceiptScreen';
import SpendingAnalyticsScreen  from './screens/SpendingAnalyticsScreen';
import ReceiptDetailsScreen     from './screens/ReceiptDetailsScreen';
import ProfileScreen            from './screens/ProfileScreen';
import SettingsScreen           from './screens/SettingsScreen';
import HealthProfileScreen      from './screens/HealthProfileScreen';
import ShoppingPreferencesScreen from './screens/ShoppingPreferencesScreen';
import PersonalInformationScreen from './screens/PersonalInformationScreen';
import FoodItemDetailsScreen      from './screens/FoodItemDetailsScreen';

import { COLORS, FONTS } from './theme';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// â”€â”€â”€ Tab Icons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TAB_ICONS = {
  Home:     HomeIcon,
  Receipts: ReceiptIcon,
  Scan:     CameraIcon,
  Insights: InsightsIcon,
  Profile:  ProfileIcon,
};

// â”€â”€â”€ Custom Tab Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[tabStyles.bar, { paddingBottom: insets.bottom || 8 }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const isScan    = route.name === 'Scan';
        const icon      = TAB_ICONS[route.name];

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (isScan) {
          const Icon = icon;
          return (
            <TouchableOpacity
              key={route.key}
              style={tabStyles.scanBtn}
              onPress={onPress}
              activeOpacity={0.8}
            >
              <Icon width={20} height={20} fill="#fff" />
              <Text style={tabStyles.scanLabel}>Scan</Text>
            </TouchableOpacity>
          );
        }

        const Icon = icon;
        return (
          <TouchableOpacity
            key={route.key}
            style={tabStyles.tab}
            onPress={onPress}
            activeOpacity={0.7}
          >
            {isFocused && <View style={tabStyles.activeDot} />}
            <Icon width={30} height={30} fill={isFocused ? COLORS.primary : '#94B6EF'} style={tabStyles.tabIcon} />
            <Text style={[tabStyles.tabLabel, isFocused && tabStyles.tabLabelActive]}>
              {route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ede8e0',
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    top: -8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  tabIcon: { width: 30, height: 30, marginBottom: 2 },
  tabLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#9e9e9e',
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  scanBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    alignSelf: 'center',
  },
  scanIcon: { fontSize: 22 },
  scanLabel: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#fff',
    letterSpacing: 0.3,
  },
});

// â”€â”€â”€ Main Tab Navigator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"     component={DashboardScreen} />
      <Tab.Screen name="Receipts" component={ReceiptHistoryScreen} />
      <Tab.Screen name="Scan"     component={UploadReceiptScreen} />
      <Tab.Screen name="Insights" component={SpendingAnalyticsScreen} />
      <Tab.Screen name="Profile"  component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// â”€â”€â”€ Root Stack â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    TheSeasons: require('./assets/the-seasons-regular.ttf'),
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Landing"
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { flex: 1 },
          }}
        >
          {/* â”€â”€ Auth â”€â”€ */}
          <Stack.Screen name="Landing"       component={LandingScreen} />
          <Stack.Screen name="SignIn"        component={SignInScreen} />
          <Stack.Screen name="SignUp"        component={SignUpScreen} />

          {/* â”€â”€ Onboarding â”€â”€ */}
          <Stack.Screen name="PersonalInfo"  component={PersonalInfoScreen} />
          <Stack.Screen name="Goals"         component={GoalsScreen} />
          <Stack.Screen name="PersonalInformation" component={PersonalInformationScreen} />
          <Stack.Screen name="HealthProfile" component={HealthProfileScreen} />
          <Stack.Screen name="ShoppingPreferences" component={ShoppingPreferencesScreen} />
          <Stack.Screen name="Settings"      component={SettingsScreen} />

          {/* â”€â”€ Main App (Tab Navigator) â”€â”€ */}
          <Stack.Screen name="Main"          component={MainTabs} />

          {/* â”€â”€ Detail screens pushed on top of tabs â”€â”€ */}
          <Stack.Screen
            name="ReceiptDetails"
            component={ReceiptDetailsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="FoodItemDetails"
            component={FoodItemDetailsScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

