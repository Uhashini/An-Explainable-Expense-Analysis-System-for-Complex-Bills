import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';

export default function PreferenceChip({ label, selected, onPress, hasCheckmark = true }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected]}
    >
      <Text style={[styles.text, selected ? styles.textSelected : styles.textUnselected]}>
        {label}
      </Text>
      {hasCheckmark && (
        <View style={[styles.indicator, selected ? styles.indicatorSelected : styles.indicatorUnselected]}>
          {selected && <Text style={styles.checkIcon}>✓</Text>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  chipUnselected: {
    backgroundColor: '#F5F1EB',
    borderColor: '#E2DAD0',
  },
  chipSelected: {
    backgroundColor: '#7A3525',
    borderColor: '#7A3525',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
  textUnselected: {
    color: '#4A3B36',
  },
  textSelected: {
    color: '#FFFFFF',
  },
  indicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicatorUnselected: {
    borderWidth: 1.5,
    borderColor: '#C8BEB6',
  },
  indicatorSelected: {
    backgroundColor: '#FFFFFF',
  },
  checkIcon: {
    color: '#7A3525',
    fontSize: 11,
    fontWeight: '800',
  },
});
