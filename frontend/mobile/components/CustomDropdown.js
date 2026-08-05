import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  StyleSheet, Platform, SafeAreaView,
} from 'react-native';
import { COLORS, FONTS } from '../theme';

/**
 * @param {string}   label     - field label shown above trigger
 * @param {string[]} options   - list of selectable string options
 * @param {string}   value     - currently selected value
 * @param {Function} onChange  - called with newly selected value
 * @param {string}   placeholder
 */
export default function CustomDropdown({ label, options, value, onChange, placeholder = 'Select...' }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={[styles.triggerText, !value && styles.placeholderText]}>
          {value || placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{label || 'Select an option'}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, value === item && styles.selectedOption]}
                  onPress={() => { onChange(item); setOpen(false); }}
                >
                  <Text style={[styles.optionText, value === item && styles.selectedOptionText]}>
                    {item}
                  </Text>
                  {value === item && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginBottom: 22,
  },
  label: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: COLORS.primary,
    letterSpacing: 1.5,
    marginBottom: 7,
  },
  trigger: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.inputBorder,
    paddingVertical: 11,
    backgroundColor: COLORS.primaryFaint,
  },
  triggerText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.inputText,
  },
  placeholderText: {
    color: COLORS.placeholder,
  },
  chevron: {
    fontSize: 14,
    color: COLORS.inputBorder,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    maxHeight: 380,
    paddingHorizontal: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.primary,
    letterSpacing: 1.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0e8e8',
  },
  selectedOption: {
    backgroundColor: 'rgba(139, 26, 26, 0.05)',
    borderRadius: 8,
  },
  optionText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#3a2020',
  },
  selectedOptionText: {
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  checkmark: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
