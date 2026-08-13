import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, Platform, ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ScreenLayout from '../components/ScreenLayout';
import { COLORS, FONTS } from '../theme';

const TIPS = [
  'Place receipt on a flat, stable surface',
  'Ensure the area is well-lit',
  'Capture the entire receipt in frame',
  'Hold steady to avoid blur',
];

const FORMATS = ['JPG', 'PNG', 'PDF'];

export default function UploadReceiptScreen({ navigation }) {
  const [pickedImage, setPickedImage] = useState(null);

  // ── Camera ──────────────────────────────────────────────────────────────────
  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Access Required',
        'Please allow camera access in your device settings to take a receipt photo.',
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setPickedImage(result.assets[0].uri);
    }
  };

  // ── Gallery ──────────────────────────────────────────────────────────────────
  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Gallery Access Required',
        'Please allow photo library access in your device settings to pick a receipt.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setPickedImage(result.assets[0].uri);
    }
  };

  const [isUploading, setIsUploading] = useState(false);

  // ── Proceed ──────────────────────────────────────────────────────────────────
  const handleProceed = async () => {
    if (!pickedImage) return;

    setIsUploading(true);

    try {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const blobResponse = await fetch(pickedImage);
        const blob = await blobResponse.blob();
        const ext = blob.type.split('/')[1] || 'jpg';
        formData.append('file', blob, `receipt.${ext}`);
      } else {
        const filename = pickedImage.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
        formData.append('file', {
          uri: pickedImage,
          name: filename || 'receipt.jpg',
          type,
        });
      }

      // Import API_BASE_URL locally to avoid breaking if it's missing at top level
      const { API_BASE_URL } = require('../utils/apiConfig');

      const response = await fetch(`${API_BASE_URL}/receipts/upload`, {
        method: 'POST',
        body: formData,
        // Do NOT set Content-Type manually for FormData in React Native
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.detail || `Server error ${response.status}`);
      }

      // Navigate to ReceiptDetails with the actual extracted backend data
      navigation.navigate('ReceiptDetails', {
        imageUri: pickedImage,
        receiptData: responseData,
      });

    } catch (error) {
      console.error('Upload Error:', error);
      Alert.alert(
        'Upload Failed',
        error.message || 'Could not process the receipt. Please ensure the backend is running.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetake = () => {
    setPickedImage(null);
  };

  return (
    <ScreenLayout title="Upload Receipt">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Scan or upload your grocery receipt to unlock smart insights.
        </Text>

        {/* ── Image Preview (shown after picking) ── */}
        {pickedImage ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: pickedImage }} style={styles.previewImage} resizeMode="contain" />
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake} activeOpacity={0.8}>
                <Text style={styles.retakeBtnText}>Retake / Change</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.proceedBtn, isUploading && { opacity: 0.7 }]}
                onPress={handleProceed}
                activeOpacity={0.85}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.proceedBtnText}>Analyse Receipt</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* ── Upload Drop Zone ── */}
            <View style={styles.uploadZone}>
              <View style={styles.uploadIconBox}>
                <Text style={styles.uploadIconText}>RECEIPT</Text>
              </View>
              <Text style={styles.uploadTitle}>No receipt selected yet</Text>
              <Text style={styles.uploadSub}>
                Use the buttons below to take a photo or pick from your gallery.
              </Text>

              {/* Supported Formats */}
              <View style={styles.formatsRow}>
                {FORMATS.map((f) => (
                  <View key={f} style={styles.formatBadge}>
                    <Text style={styles.formatText}>{f}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.maxSize}>Maximum size: 10 MB</Text>
            </View>

            {/* ── Action Buttons ── */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleTakePhoto}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handlePickFromGallery}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryButtonText}>Upload from Gallery</Text>
            </TouchableOpacity>

            {/* ── Tips ── */}
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>Tips for Best Results</Text>
              {TIPS.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <View style={styles.tipDot} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>

            {/* ── Security Note ── */}
            <View style={styles.securityNote}>
              <View style={styles.lockIcon}>
                <Text style={styles.lockText}>SEC</Text>
              </View>
              <Text style={styles.securityText}>
                Your receipts are securely processed and encrypted end-to-end.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    alignItems: 'center',
    paddingBottom: 36,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: 'rgba(153, 8, 8, 0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },

  // ── Preview ─────────────────────────────────────────────────────────────────
  previewContainer: {
    width: '100%',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 320,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.secondary,
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  previewActions: {
    width: '100%',
    gap: 12,
  },
  retakeBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  retakeBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  proceedBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  proceedBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.white,
    letterSpacing: 1,
  },

  // ── Drop Zone ───────────────────────────────────────────────────────────────
  uploadZone: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.secondary,
    backgroundColor: '#fff',
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadIconBox: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  uploadIconText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#fff',
    letterSpacing: 1.5,
  },
  uploadTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  uploadSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(153, 8, 8, 0.55)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  formatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  formatBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(148, 182, 239, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  formatText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  maxSize: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: 'rgba(153, 8, 8, 0.45)',
    marginTop: 4,
  },

  // ── Buttons ──────────────────────────────────────────────────────────────────
  primaryButton: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.white,
    letterSpacing: 1,
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: '#fff',
    alignItems: 'center',
    marginBottom: 24,
  },
  secondaryButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.primary,
    letterSpacing: 0.5,
  },

  // ── Tips ─────────────────────────────────────────────────────────────────────
  tipsCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 182, 239, 0.35)',
  },
  tipsTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.secondary,
    marginRight: 10,
    marginTop: 5,
  },
  tipText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.primary,
    lineHeight: 19,
  },

  // ── Security ──────────────────────────────────────────────────────────────────
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(148, 182, 239, 0.12)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(148, 182, 239, 0.3)',
  },
  lockIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  lockText: {
    fontFamily: FONTS.bold,
    fontSize: 8,
    color: '#fff',
    letterSpacing: 1,
  },
  securityText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.primary,
    lineHeight: 17,
  },
});
