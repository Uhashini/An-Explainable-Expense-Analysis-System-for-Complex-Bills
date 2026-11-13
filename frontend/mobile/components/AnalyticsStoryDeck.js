import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  PanResponder,
  ScrollView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { FONTS } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * AnalyticsStoryDeck
 * 
 * Reusable Instagram Stories-style carousel container for analytics cards.
 * Features:
 * - Segmented progress bar at top with direct jump on segment tap
 * - Active card rendered directly from existing analytics components
 * - Smooth vertical scrolling inside card for tall content (nestedScrollEnabled)
 * - Touch swipe gestures (PanResponder) & Web ArrowLeft/ArrowRight keyboard support
 * - Fixed top navigation controls (< Previous, Next Insight (X/Y))
 */
const AnalyticsStoryDeck = forwardRef(function AnalyticsStoryDeck(
  {
    cards = [],
    initialIndex = 0,
    onCardChange,
    onComplete,
    containerStyle,
  },
  ref
) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const totalCards = cards.length;

  // Animated values for smooth slide transitions
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Responsive card dimensions
  const cardWidth = Math.min(SCREEN_WIDTH - 24, 600);
  const cardMaxHeight = Math.max(480, Math.min(SCREEN_HEIGHT * 0.72, 640));

  const goToCard = useCallback((newIndex) => {
    if (newIndex < 0 || newIndex >= totalCards) return;

    const direction = newIndex > activeIndex ? 1 : -1;

    // Slide & fade animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -direction * 35,
        duration: 110,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(fadeAnim, {
        toValue: 0.35,
        duration: 110,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setActiveIndex(newIndex);
      if (onCardChange) onCardChange(newIndex);

      slideAnim.setValue(direction * 35);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 65,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 140,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    });
  }, [activeIndex, totalCards, onCardChange, slideAnim, fadeAnim]);

  useImperativeHandle(ref, () => ({
    goToCard,
    activeIndex,
  }), [goToCard, activeIndex]);

  const handleNext = useCallback(() => {
    if (activeIndex < totalCards - 1) {
      goToCard(activeIndex + 1);
    } else {
      if (onComplete) {
        onComplete();
      } else {
        // Loop back to start
        goToCard(0);
      }
    }
  }, [activeIndex, totalCards, goToCard, onComplete]);

  const handlePrev = useCallback(() => {
    if (activeIndex > 0) {
      goToCard(activeIndex - 1);
    }
  }, [activeIndex, goToCard]);

  // Touch Swipe Handling via PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 25 && Math.abs(gestureState.dy) < 30;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -40) {
          handleNext();
        } else if (gestureState.dx > 40) {
          handlePrev();
        }
      },
    })
  ).current;

  // Web Keyboard Navigation (ArrowLeft / ArrowRight)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleKeyDown = (e) => {
        if (e.key === 'ArrowRight') {
          handleNext();
        } else if (e.key === 'ArrowLeft') {
          handlePrev();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleNext, handlePrev]);

  if (totalCards === 0) {
    return null;
  }

  const currentCard = cards[activeIndex];
  const isFirstCard = activeIndex === 0;
  const isLastCard = activeIndex === totalCards - 1;

  return (
    <View style={[styles.deckContainer, containerStyle]}>
      {/* ── 1. Top Segmented Progress Bar ── */}
      <View style={styles.progressBarRow}>
        {cards.map((_, idx) => {
          const isCompleted = idx <= activeIndex;
          return (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.7}
              onPress={() => goToCard(idx)}
              style={styles.segmentTouchable}
              accessibilityLabel={`Go to Insight ${idx + 1}`}
            >
              <View
                style={[
                  styles.progressSegment,
                  isCompleted ? styles.segmentActive : styles.segmentInactive,
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── 2. Top Navigation & Position Row (Moved to top for instant access) ── */}
      <View style={[styles.topNavRow, { maxWidth: cardWidth }]}>
        {/* Left: Previous Button */}
        <TouchableOpacity
          onPress={handlePrev}
          disabled={isFirstCard}
          style={[styles.prevButton, isFirstCard && styles.prevButtonDisabled]}
          activeOpacity={0.7}
          accessibilityLabel="Previous Insight"
        >
          <Feather
            name="chevron-left"
            size={18}
            color={isFirstCard ? '#C5BEAF' : '#1A1816'}
          />
          <Text
            style={[
              styles.prevButtonText,
              isFirstCard && styles.prevButtonTextDisabled,
            ]}
          >
            Previous
          </Text>
        </TouchableOpacity>

        {/* Center: Position Indicator */}
        <View style={styles.indicatorBadge}>
          <Text style={styles.indicatorBadgeText}>
            {activeIndex + 1} / {totalCards}
          </Text>
        </View>

        {/* Right: Next Insight Primary CTA Button */}
        <TouchableOpacity
          onPress={handleNext}
          style={styles.nextButton}
          activeOpacity={0.85}
          accessibilityLabel={isLastCard ? 'Restart Story Deck' : 'Next Insight'}
        >
          <Text style={styles.nextButtonText}>
            {isLastCard
              ? 'Restart (1/' + totalCards + ')'
              : `Next Insight (${activeIndex + 2}/${totalCards})`}
          </Text>
          <Feather
            name={isLastCard ? 'rotate-ccw' : 'arrow-right'}
            size={15}
            color="#FFFFFF"
            style={{ marginLeft: 6 }}
          />
        </TouchableOpacity>
      </View>

      {/* ── 3. Carousel Active Card Viewport ── */}
      <View style={styles.carouselViewport} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.activeCardWrapper,
            {
              width: cardWidth,
              transform: [{ translateX: slideAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Scrollable Container so tall sections (e.g. 5 items, charts) never clip */}
          <ScrollView
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={false}
            style={[styles.scrollableCard, { maxHeight: cardMaxHeight }]}
            contentContainerStyle={styles.scrollableContent}
          >
            {typeof currentCard === 'function' ? (
              currentCard({
                cardNumber: activeIndex + 1,
                totalCards,
                onPressPrev: handlePrev,
                onPressNext: handleNext,
                cardWidth,
              })
            ) : React.isValidElement(currentCard) ? (
              React.cloneElement(currentCard, {
                cardNumber: activeIndex + 1,
                totalCards,
                onPressPrev: handlePrev,
                onPressNext: handleNext,
                width: cardWidth,
              })
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
});

export default AnalyticsStoryDeck;

const styles = StyleSheet.create({
  deckContainer: {
    paddingVertical: 8,
    alignItems: 'center',
    width: '100%',
  },
  // ── Progress Bar ──
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 600,
    paddingHorizontal: 8,
    marginBottom: 6,
    gap: 6,
  },
  segmentTouchable: {
    flex: 1,
    paddingVertical: 6,
  },
  progressSegment: {
    height: 5,
    borderRadius: 3,
  },
  segmentActive: {
    backgroundColor: '#8B0000', // Deep crimson
  },
  segmentInactive: {
    backgroundColor: '#DCD8CE', // Muted warm gray
  },

  // ── Top Navigation Row ──
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 6,
    marginTop: 2,
    marginBottom: 10,
  },
  prevButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  prevButtonDisabled: {
    opacity: 0.3,
  },
  prevButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#1A1816',
    marginLeft: 2,
  },
  prevButtonTextDisabled: {
    color: '#C5BEAF',
  },
  indicatorBadge: {
    backgroundColor: 'rgba(139, 0, 0, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  indicatorBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#8B0000',
    letterSpacing: 0.5,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B0000', // Deep crimson
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#8B0000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  nextButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // ── Carousel Viewport ──
  carouselViewport: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  scrollableCard: {
    width: '100%',
  },
  scrollableContent: {
    flexGrow: 1,
    paddingBottom: 4,
  },
});
