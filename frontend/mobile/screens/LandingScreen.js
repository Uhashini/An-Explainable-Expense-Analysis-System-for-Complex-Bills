import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import BackgroundLayout from '../components/BackgroundLayout';

export default function LandingScreen({ navigation }) {
  return (
    <BackgroundLayout>
      {/* Brand Title */}
      <Text style={styles.title}>PANTRIX</Text>

      {/* Cart Illustration */}
      <View style={styles.imageContainer}>
        <Image
          source={require('../assets/cart.png')}
          style={styles.image}
          resizeMode="contain"
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('SignUp')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>GET STARTED</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('SignIn')}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>SIGN IN</Text>
        </TouchableOpacity>
      </View>

      {/* Tagline */}
      <Text style={styles.footerText}>RECEIPT ANALYSIS{'\n'}FOR GROCERY ITEMS</Text>
    </BackgroundLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: 'TheSeasons',
    fontSize: 52,
    color: '#8B1A1A',
    letterSpacing: 6,
    marginTop: 28,
    marginBottom: 4,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
  },
  image: {
    width: 250,
    height: 250,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  primaryButton: {
    width: 230,
    paddingVertical: 15,
    borderRadius: 50,
    backgroundColor: '#8B1A1A',
    alignItems: 'center',
    shadowColor: '#8B1A1A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#fff',
    fontFamily: 'TheSeasons',
    fontSize: 14,
    letterSpacing: 2.5,
  },
  secondaryButton: {
    width: 230,
    paddingVertical: 14,
    borderRadius: 50,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#8B1A1A',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#8B1A1A',
    fontFamily: 'serif',
    fontSize: 14,
    letterSpacing: 2.5,
  },
  footerText: {
    textAlign: 'center',
    color: '#8B1A1A',
    fontFamily: 'serif',
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 14,
    marginBottom: 10,
    lineHeight: 17,
    opacity: 0.75,
  },
});
