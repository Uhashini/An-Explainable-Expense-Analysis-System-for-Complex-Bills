import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator } from 'react-native';
import InsightsIcon from './assets/icons/insights.svg';
const HomeImg = require('./assets/icons/home.png');
const ReceiptImg = require('./assets/icons/receipt.png');
const CameraImg = require('./assets/icons/camera.png');
const ProfileImg = require('./assets/icons/profile.png');
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';

// â”€â”€ Auth Screens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import LandingScreen from './screens/LandingScreen';
import SignInScreen from './screens/SignInScreen';
import SignUpScreen from './screens/SignUpScreen';

// â”€â”€ Onboarding Screens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import PersonalInfoScreen from './screens/OnboardingFlowScreen';
import GoalsScreen from './screens/GoalsScreen';

// â”€â”€ Main App Screens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import DashboardScreen from './screens/DashboardScreen';
import ReceiptHistoryScreen from './screens/ReceiptHistoryScreen';
import UploadReceiptScreen from './screens/UploadReceiptScreen';
import SpendingAnalyticsScreen from './screens/SpendingAnalyticsScreen';
import AIInsightsScreen from './screens/AIInsightsScreen';
import ReceiptDetailsScreen from './screens/ReceiptDetailsScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import HealthProfileScreen from './screens/HealthProfileScreen';
import ShoppingPreferencesScreen from './screens/ShoppingPreferencesScreen';
import PersonalInformationScreen from './screens/PersonalInformationScreen';
import FoodItemDetailsScreen from './screens/FoodItemDetailsScreen';
import EditGoalsScreen from './screens/EditGoalsScreen';
import GainMuscleScreen from './screens/GainMuscleScreen';
import GemmaChatScreen from './screens/GemmaChatScreen';

import { COLORS, FONTS } from './theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// â”€â”€â”€ Tab Icons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TAB_ICONS = {
  Home: { type: 'image', source: HomeImg },
  Receipts: { type: 'image', source: ReceiptImg },
  Scan: { type: 'image', source: CameraImg },
  Insights: { type: 'svg', component: InsightsIcon },
  Profile: { type: 'image', source: ProfileImg },
};

// â”€â”€â”€ Custom Tab Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[tabStyles.bar, { paddingBottom: insets.bottom || 8 }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const isScan = route.name === 'Scan';
        const iconItem = TAB_ICONS[route.name];

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (isScan) {
          return (
            <TouchableOpacity
              key={route.key}
              style={[tabStyles.scanBtn, isFocused && tabStyles.scanBtnActive]}
              onPress={onPress}
              activeOpacity={0.85}
            >
              <Image
                source={iconItem?.source}
                style={tabStyles.scanImage}
                resizeMode="contain"
              />
              <Text style={tabStyles.scanLabel}>Scan</Text>
            </TouchableOpacity>
          );
        }

        const isImage = iconItem?.type === 'image';
        const SvgComponent = iconItem?.component;

        return (
          <TouchableOpacity
            key={route.key}
            style={tabStyles.tab}
            onPress={onPress}
            activeOpacity={0.7}
          >
            {isImage ? (
              <Image
                source={iconItem.source}
                style={[
                  tabStyles.tabImage,
                  {
                    opacity: isFocused ? 1 : 0.45,
                    transform: [{ scale: isFocused ? 1.08 : 0.95 }],
                  },
                ]}
                resizeMode="contain"
              />
            ) : (
              <SvgComponent
                width={26}
                height={26}
                style={[
                  tabStyles.tabIcon,
                  {
                    opacity: isFocused ? 1 : 0.45,
                    transform: [{ scale: isFocused ? 1.08 : 0.95 }],
                  },
                ]}
              />
            )}
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
  tabImage: {
    width: 27,
    height: 27,
    marginBottom: 2,
  },
  tabIcon: {
    width: 27,
    height: 27,
    marginBottom: 2,
  },
  tabLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    color: '#8A8A8A',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  scanBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FAF6F1',
    borderWidth: 1.5,
    borderColor: '#EDE6DE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 6,
    alignSelf: 'center',
  },
  scanBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#fff',
  },
  scanImage: {
    width: 32,
    height: 26,
    marginBottom: 2,
  },
  scanLabel: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: COLORS.primary,
    letterSpacing: 0.2,
  },
});

// â”€â”€â”€ Receipt Stack (Nested in Tabs) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ReceiptStack = createNativeStackNavigator();

function ReceiptStackNavigator() {
  return (
    <ReceiptStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <ReceiptStack.Screen name="ReceiptHistory" component={ReceiptHistoryScreen} />
      <ReceiptStack.Screen name="ReceiptDetails" component={ReceiptDetailsScreen} />
      <ReceiptStack.Screen name="AIInsights" component={AIInsightsScreen} />
    </ReceiptStack.Navigator>
  );
}

// â”€â”€â”€ Main Tab Navigator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Receipts" component={ReceiptStackNavigator} />
      <Tab.Screen name="Scan" component={UploadReceiptScreen} />
      <Tab.Screen name="Insights" component={SpendingAnalyticsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
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
          <Stack.Screen name="Landing" component={LandingScreen} />
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />

          {/* â”€â”€ Onboarding â”€â”€ */}
          <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
          <Stack.Screen name="Goals" component={GoalsScreen} />
          <Stack.Screen name="EditGoals" component={EditGoalsScreen} />
          <Stack.Screen name="PersonalInformation" component={PersonalInformationScreen} />
          <Stack.Screen name="HealthProfile" component={HealthProfileScreen} />
          <Stack.Screen name="ShoppingPreferences" component={ShoppingPreferencesScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />

          {/* ——— Main App (Tab Navigator) ——— */}
          <Stack.Screen name="Main" component={MainTabs} />

          {/* ——— Detail screens pushed on top of tabs ——— */}
          <Stack.Screen
            name="ReceiptDetails"
            component={ReceiptDetailsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="AIInsights"
            component={AIInsightsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="FoodItemDetails"
            component={FoodItemDetailsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="GainMuscle"
            component={GainMuscleScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="GemmaChat"
            component={GemmaChatScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

