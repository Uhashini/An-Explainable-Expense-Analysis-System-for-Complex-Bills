import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import BasicNutritionSection from './BasicNutritionSection';
import HealthIntelligenceSection from './HealthIntelligenceSection';
import AnalyticsStoryDeck from '../../components/AnalyticsStoryDeck';
import StoryQuestionBanner from '../../components/StoryQuestionBanner';
import { getDefaultNutritionData } from './nutritionUtils';
import { COLORS, FONTS } from '../../theme';
import styles from './eatHealthyStyles';

const HEALTHY_SUB_OPTIONS = ['Basic Nutrition Analysis', 'Health Intelligence'];

export default function EatHealthyView({
  nutritionData,
  healthySubOption,
  setHealthySubOption,
  comparisonViewMode,
  setComparisonViewMode,
  savedReceiptsList = [],
  receiptId,
  receiptData,
}) {
  const [viewMode, setViewMode] = useState('deck'); // 'deck' | 'list'
  const [activeDeckIndex, setActiveDeckIndex] = useState(0);
  const deckRef = useRef(null);

  const data = nutritionData || getDefaultNutritionData();

  // ─── 8 Complete Analytics Slides for Eat Healthy Story Deck ───
  const storyCards = [
    // Slide 1: Healthy Basket Score & Food Quality
    <View key="slide-1" style={viewStyles.slideWrapper}>
      <StoryQuestionBanner
        question="Was this a good grocery haul overall?"
        category="Basket Health & Quality"
        categoryIcon="🥗"
        themeColor="#2E7D32"
      />
      <BasicNutritionSection
        data={data}
        sectionFilter="score"
        comparisonViewMode={comparisonViewMode}
        setComparisonViewMode={setComparisonViewMode}
        savedReceiptsList={savedReceiptsList}
      />
    </View>,

    // Slide 2: Macronutrients & Daily RDI %
    <View key="slide-2" style={viewStyles.slideWrapper}>
      <StoryQuestionBanner
        question="Did I get enough protein, fiber, and balanced fuel?"
        category="Macro Fuel & Energy"
        categoryIcon="🥗"
        themeColor="#2E7D32"
      />
      <BasicNutritionSection
        data={data}
        sectionFilter="macros"
        comparisonViewMode={comparisonViewMode}
        setComparisonViewMode={setComparisonViewMode}
        savedReceiptsList={savedReceiptsList}
      />
    </View>,

    // Slide 3: Item Breakdown & Multi-Haul Trend
    <View key="slide-3" style={viewStyles.slideWrapper}>
      <StoryQuestionBanner
        question="How does this haul compare to my previous grocery trips?"
        category="Items & History Trend"
        categoryIcon="🥗"
        themeColor="#2E7D32"
      />
      <BasicNutritionSection
        data={data}
        sectionFilter="items_trend"
        comparisonViewMode={comparisonViewMode}
        setComparisonViewMode={setComparisonViewMode}
        savedReceiptsList={savedReceiptsList}
      />
    </View>,

    // Slide 4: Glycemic Impact & Glucose Stability
    <View key="slide-4" style={viewStyles.slideWrapper}>
      <StoryQuestionBanner
        question="Will these foods spike my blood sugar or cause energy crashes?"
        category="Glycemic Impact & Glucose Stability"
        categoryIcon="🧬"
        themeColor="#C2185B"
      />
      <HealthIntelligenceSection
        data={data}
        receiptId={receiptId}
        receiptData={receiptData}
        savedReceiptsList={savedReceiptsList}
        sectionFilter="glycemic"
        hideHeader={true}
      />
    </View>,

    // Slide 5: Sodium & Cardiovascular Health
    <View key="slide-5" style={viewStyles.slideWrapper}>
      <StoryQuestionBanner
        question="Is the sodium level safe for my heart health?"
        category="Sodium & Cardiovascular Health"
        categoryIcon="🧬"
        themeColor="#D32F2F"
      />
      <HealthIntelligenceSection
        data={data}
        receiptId={receiptId}
        receiptData={receiptData}
        savedReceiptsList={savedReceiptsList}
        sectionFilter="sodium"
        hideHeader={true}
      />
    </View>,

    // Slide 6: Allergen & Dietary Restriction Check
    <View key="slide-6" style={viewStyles.slideWrapper}>
      <StoryQuestionBanner
        question="Are there any ingredients that trigger my allergies or violate my diet?"
        category="Allergen & Dietary Restrictions"
        categoryIcon="🧬"
        themeColor="#1976D2"
      />
      <HealthIntelligenceSection
        data={data}
        receiptId={receiptId}
        receiptData={receiptData}
        savedReceiptsList={savedReceiptsList}
        sectionFilter="allergen"
        hideHeader={true}
      />
    </View>,

    // Slide 7: Nutritional Balance & Missing Food Groups
    <View key="slide-7" style={viewStyles.slideWrapper}>
      <StoryQuestionBanner
        question="What vital food groups or nutrients is my pantry missing?"
        category="Nutritional Balance & Gaps"
        categoryIcon="🧬"
        themeColor="#7B1FA2"
      />
      <HealthIntelligenceSection
        data={data}
        receiptId={receiptId}
        receiptData={receiptData}
        savedReceiptsList={savedReceiptsList}
        sectionFilter="balance"
        hideHeader={true}
      />
    </View>,

    // Slide 8: Personalized AI Recommendations & Smart Swaps
    <View key="slide-8" style={viewStyles.slideWrapper}>
      <StoryQuestionBanner
        question="What smart food swaps should I make on my next trip?"
        category="Personalized AI Recommendations"
        categoryIcon="🧬"
        themeColor="#E65100"
      />
      <HealthIntelligenceSection
        data={data}
        receiptId={receiptId}
        receiptData={receiptData}
        savedReceiptsList={savedReceiptsList}
        sectionFilter="recs"
        hideHeader={true}
      />
    </View>,
  ];

  return (
    <View style={styles.maxWidthWrapper}>
      {/* ── View Mode Switcher (Story Deck vs Full Audit Feed) ── */}
      <View style={viewStyles.modeToggleRow}>
        <TouchableOpacity
          onPress={() => setViewMode('deck')}
          style={[viewStyles.modeToggleBtn, viewMode === 'deck' && viewStyles.modeToggleBtnActive]}
          activeOpacity={0.8}
        >
          <Feather name="layers" size={13} color={viewMode === 'deck' ? '#FFFFFF' : '#7A7265'} />
          <Text style={[viewStyles.modeToggleText, viewMode === 'deck' && viewStyles.modeToggleTextActive]}>
            Story Deck
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setViewMode('list')}
          style={[viewStyles.modeToggleBtn, viewMode === 'list' && viewStyles.modeToggleBtnActive]}
          activeOpacity={0.8}
        >
          <Feather name="list" size={13} color={viewMode === 'list' ? '#FFFFFF' : '#7A7265'} />
          <Text style={[viewStyles.modeToggleText, viewMode === 'list' && viewStyles.modeToggleTextActive]}>
            Full Audit Feed
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Deck Mode: Option A Interactive Chapter Selector ── */}
      {viewMode === 'deck' && (
        <View style={viewStyles.chapterRow}>
          <TouchableOpacity
            style={[
              viewStyles.chapterBtn,
              activeDeckIndex < 3 && viewStyles.chapterBtnBasicActive,
            ]}
            onPress={() => deckRef.current?.goToCard(0)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                viewStyles.chapterBtnText,
                activeDeckIndex < 3 && viewStyles.chapterBtnBasicTextActive,
              ]}
            >
              🥗 Basic Nutrition (1–3)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              viewStyles.chapterBtn,
              activeDeckIndex >= 3 && viewStyles.chapterBtnIntelActive,
            ]}
            onPress={() => deckRef.current?.goToCard(3)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                viewStyles.chapterBtnText,
                activeDeckIndex >= 3 && viewStyles.chapterBtnIntelTextActive,
              ]}
            >
              🧬 Health Intelligence (4–8)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Content View ── */}
      {viewMode === 'deck' ? (
        <AnalyticsStoryDeck
          ref={deckRef}
          cards={storyCards}
          initialIndex={0}
          onCardChange={setActiveDeckIndex}
        />
      ) : (
        /* ── Full Audit Feed Mode ── */
        <View style={{ marginTop: 8 }}>
          {/* Sub-options Tab Row */}
          <View style={styles.subOptionRow}>
            {HEALTHY_SUB_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => setHealthySubOption(opt)}
                style={[
                  styles.subOptionTab,
                  healthySubOption === opt && styles.subOptionTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.subOptionText,
                    healthySubOption === opt && styles.subOptionTextActive,
                  ]}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Dynamic Sub-Option Content */}
          {healthySubOption === 'Basic Nutrition Analysis' ? (
            <BasicNutritionSection
              data={data}
              comparisonViewMode={comparisonViewMode}
              setComparisonViewMode={setComparisonViewMode}
              savedReceiptsList={savedReceiptsList}
              sectionFilter="all"
            />
          ) : (
            <HealthIntelligenceSection
              data={data}
              receiptId={receiptId}
              receiptData={receiptData}
              savedReceiptsList={savedReceiptsList}
              sectionFilter="all"
              hideHeader={false}
            />
          )}
        </View>
      )}
    </View>
  );
}

const viewStyles = StyleSheet.create({
  modeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAE6DC',
    borderRadius: 20,
    padding: 3,
    marginTop: 4,
    marginBottom: 8,
    alignSelf: 'center',
  },
  modeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 6,
  },
  modeToggleBtnActive: {
    backgroundColor: '#8B0000',
  },
  modeToggleText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#7A7265',
  },
  modeToggleTextActive: {
    color: '#FFFFFF',
  },

  // ── Option A Interactive Chapter Selector ──
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  chapterBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE6DC',
  },
  chapterBtnBasicActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
  },
  chapterBtnIntelActive: {
    backgroundColor: '#FCE4EC',
    borderColor: '#F48FB1',
  },
  chapterBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: '#7A7265',
  },
  chapterBtnBasicTextActive: {
    color: '#2E7D32',
  },
  chapterBtnIntelTextActive: {
    color: '#C2185B',
  },

  slideWrapper: {
    width: '100%',
  },
});
