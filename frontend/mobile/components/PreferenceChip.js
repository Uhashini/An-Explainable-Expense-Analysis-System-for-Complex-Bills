import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../theme';
export default function PreferenceChip({ label, selected, onPress }) { return <TouchableOpacity onPress={onPress} style={[styles.chip, selected && styles.selected]}><Text style={[styles.text, selected && styles.selectedText]}>{selected ? '✓  ' : ''}{label}</Text></TouchableOpacity>; }
const styles = StyleSheet.create({ chip: { borderWidth: 1, borderColor: COLORS.inputBorder, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' }, selected: { borderColor: COLORS.primary, backgroundColor: '#dcfce7' }, text: { color: COLORS.mutedText, fontFamily: FONTS.regular, fontSize: 12 }, selectedText: { color: COLORS.primary, fontFamily: FONTS.bold } });
