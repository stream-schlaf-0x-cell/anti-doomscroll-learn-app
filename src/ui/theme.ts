export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSecondary: string;
  surfaceSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSubtle: string;
  border: string;
  borderSubtle: string;
  danger: string;
  success: string;
  badgeBg: string;
  badgeText: string;
  cardHighlight: string;
}

export const lightColors: ThemeColors = {
  background: '#F9F8F5',       // warm editorial book paper
  surface: '#FFFFFF',          // clean card surface
  surfaceSecondary: '#F2EFE9', // subtle nested container
  surfaceSubtle: '#EAE6DC',
  textPrimary: '#1E1E1C',      // deep warm charcoal
  textSecondary: '#5C5852',    // editorial subtitle
  textMuted: '#8C877E',        // metadata & timestamps
  accent: '#264E36',           // classic deep forest sage
  accentSubtle: '#E6EFE9',
  border: '#E3DFD5',
  borderSubtle: '#EFECE5',
  danger: '#A83232',
  success: '#2E7D32',
  badgeBg: '#ECE7DD',
  badgeText: '#423E37',
  cardHighlight: '#FAF5EA'
};

export const darkColors: ThemeColors = {
  background: '#121312',       // warm deep obsidian
  surface: '#1A1C1A',          // night reading surface
  surfaceSecondary: '#222622',
  surfaceSubtle: '#2A2F2A',
  textPrimary: '#EDEAE4',      // gentle off-white
  textSecondary: '#A8A49C',    // soft grey-beige
  textMuted: '#706D67',
  accent: '#64A57E',           // soft luminous sage
  accentSubtle: '#1C2E24',
  border: '#282C28',
  borderSubtle: '#1F221F',
  danger: '#CF6679',
  success: '#81C784',
  badgeBg: '#252B25',
  badgeText: '#D0DDD4',
  cardHighlight: '#1E241E'
};

export const typography = {
  fontFamilies: {
    serif: 'Georgia',
    sans: 'System'
  },
  sizes: {
    hero: 28,
    title1: 23,
    title2: 19,
    bodyLarge: 18,
    body: 16,
    bodySmall: 14,
    caption: 12,
    micro: 11
  },
  lineHeights: {
    hero: 36,
    title1: 30,
    title2: 26,
    bodyLarge: 28,
    body: 24,
    bodySmall: 20,
    caption: 16,
    micro: 14
  }
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pageHorizontal: 18
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  pill: 999
};
