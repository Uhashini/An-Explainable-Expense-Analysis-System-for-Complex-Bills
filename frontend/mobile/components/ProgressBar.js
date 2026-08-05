import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../theme';

/**
 * @param {number} step  - current step (1-based)
 * @param {number} total - total number of steps
 */
export default function ProgressBar({ step, total }) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Step {step} of {total}</Text>
      <View style={styles.track}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              i < step ? styles.filled : styles.empty,
              i < total - 1 && { marginRight: 5 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.mutedText,
    letterSpacing: 1,
    marginBottom: 8,
    textAlign: 'right',
  },
  track: {
    flexDirection: 'row',
    width: '100%',
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  filled: {
    backgroundColor: COLORS.primary,
  },
  empty: {
    backgroundColor: COLORS.divider,
  },
});
