import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import ScreenLayout from '../components/ScreenLayout';
import { COLORS, FONTS } from '../theme';
import { API_BASE_URL } from '../utils/apiConfig';

export default function FoodItemDetailsScreen({ route, navigation }) {
  const { product_id, item_name, item_data } = route.params || {};
  const [productDetails, setProductDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product_id) {
      fetchProductDetails(product_id);
    } else if (item_data) {
      setProductDetails({
        name: item_name || item_data.matched_name || item_data.name,
        category: item_data.category || 'Unknown Category',
        health_score: item_data.health?.health_score || null,
        nutrition: item_data.nutrition || null,
        health: item_data.health || null,
      });
    }
  }, [product_id]);

  const fetchProductDetails = async (id) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || `Server error ${response.status}`);
      }
      
      if (data && data.data) {
        setProductDetails(data.data);
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
      Alert.alert('Error', 'Failed to fetch detailed product information.');
    } finally {
      setLoading(false);
    }
  };

  const renderDetailRow = (label, value) => {
    if (value === null || value === undefined) return null;
    return (
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    );
  };

  return (
    <ScreenLayout title="Food Details" navigation={navigation} showBack>
      <ScrollView contentContainerStyle={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading details...</Text>
          </View>
        ) : productDetails ? (
          <View style={styles.card}>
            <View style={styles.header}>
              <View style={styles.iconBox}>
                <Text style={styles.iconText}>FOOD</Text>
              </View>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>{productDetails.name || item_name || 'Unknown Item'}</Text>
                <Text style={styles.category}>{productDetails.category || 'General'}</Text>
              </View>
              {productDetails.health_score !== null && productDetails.health_score !== undefined && (
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreValue}>{productDetails.health_score}</Text>
                  <Text style={styles.scoreLabel}>Score</Text>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>NUTRITIONAL INFO</Text>
            
            <View style={styles.detailsContainer}>
              {renderDetailRow('Calories', productDetails.nutrition?.calories_kcal ? `${productDetails.nutrition.calories_kcal} kcal` : null)}
              {renderDetailRow('Protein', productDetails.nutrition?.protein_g ? `${productDetails.nutrition.protein_g}g` : null)}
              {renderDetailRow('Carbs', productDetails.nutrition?.carbohydrates_g ? `${productDetails.nutrition.carbohydrates_g}g` : null)}
              {renderDetailRow('Fat', productDetails.nutrition?.fat_g ? `${productDetails.nutrition.fat_g}g` : null)}
              {renderDetailRow('Fiber', productDetails.nutrition?.fiber_g ? `${productDetails.nutrition.fiber_g}g` : null)}
              {renderDetailRow('Price', item_data?.total_price ? `₹${item_data.total_price}` : (item_data?.price ? `₹${item_data.price}` : null))}
              {renderDetailRow('Quantity', item_data?.quantity || item_data?.qty)}
            </View>

            {productDetails.health && (
              <View style={styles.extraInfoBox}>
                <Text style={styles.extraInfoTitle}>Health Indicators</Text>
                {productDetails.health.high_protein && <Text style={styles.extraInfoText}>• High Protein</Text>}
                {productDetails.health.high_fiber && <Text style={styles.extraInfoText}>• High Fiber</Text>}
                {productDetails.health.high_sugar && <Text style={styles.extraInfoText}>• High Sugar</Text>}
                {productDetails.health.is_processed && <Text style={styles.extraInfoText}>• Processed ({productDetails.health.processed_level})</Text>}
                {productDetails.health.vegan && <Text style={styles.extraInfoText}>• Vegan</Text>}
                {productDetails.health.vegetarian && <Text style={styles.extraInfoText}>• Vegetarian</Text>}
                {productDetails.health.gluten_free && <Text style={styles.extraInfoText}>• Gluten Free</Text>}
                {!productDetails.health.high_protein && !productDetails.health.high_fiber && !productDetails.health.high_sugar && !productDetails.health.is_processed && !productDetails.health.vegan && !productDetails.health.vegetarian && !productDetails.health.gluten_free && (
                  <Text style={styles.extraInfoText}>No specific flags available.</Text>
                )}
              </View>
            )}
            
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No detailed information available for this item.</Text>
            <Text style={styles.itemNameText}>{item_name}</Text>
          </View>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 18,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontFamily: FONTS.regular,
    marginTop: 12,
    color: COLORS.primary,
    opacity: 0.7,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderTopWidth: 5,
    borderTopColor: COLORS.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: 'rgba(148, 182, 239, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  iconText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
    letterSpacing: 1.5,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.primary,
    marginBottom: 4,
  },
  category: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: 'rgba(153,8,8,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scoreBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    marginLeft: 10,
  },
  scoreValue: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.primary,
  },
  scoreLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 9,
    color: COLORS.primary,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(148, 182, 239, 0.2)',
    marginVertical: 20,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.primary,
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  detailsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: 'rgba(153,8,8,0.6)',
  },
  detailValue: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.primary,
  },
  extraInfoBox: {
    backgroundColor: 'rgba(148, 182, 239, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  extraInfoTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
    marginBottom: 8,
  },
  extraInfoText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: 'rgba(153,8,8,0.8)',
    lineHeight: 22,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginTop: 20,
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: 'rgba(153,8,8,0.6)',
    textAlign: 'center',
    marginBottom: 10,
  },
  itemNameText: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.primary,
    textAlign: 'center',
  }
});
