// Shared theme constants for Pantrix app
// Brand palette: Red #990808 | Blue #94B6EF | White/Bg #F4F2EF | Yellow #E6E279

export const COLORS = {
  // Core brand
  primary:      '#990808',   // Red — primary actions, headers, key text
  secondary:    '#94B6EF',   // Blue — accents, borders, dividers
  background:   '#F4F2EF',   // Off-white — screen backgrounds
  surface:      '#F4F2EF',   // Off-white — card surfaces
  accent:       '#E6E279',   // Yellow — highlights, badges, active states

  // Derived — still strictly from the 4 brand colors
  primaryLight: '#94B6EF',   // Blue alias
  primaryFaint: 'rgba(153, 8, 8, 0.07)',  // Red tint for input bg
  divider:      '#94B6EF',
  inputBorder:  '#94B6EF',
  placeholder:  '#94B6EF',
  inputText:    '#990808',
  mutedText:    'rgba(153, 8, 8, 0.55)', // Muted red
  white:        '#F4F2EF',
};

export const FONTS = {
  bold:     'PlusJakartaSans_700Bold',
  semiBold: 'PlusJakartaSans_600SemiBold',
  regular:  'PlusJakartaSans_400Regular',
};
