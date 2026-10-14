export type ThemeMode = 'light' | 'dark';
export type ThemePalette = 'tidalglass' | 'mosspulse' | 'oxford' | 'cyberpunk' | 'monochrome';

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

export const PALETTE_METADATA: Record<ThemePalette, {
  name: string;
  subtitle: string;
  accent: string;
  icon: string;
}> = {
  tidalglass: {
    name: 'Tidal Glass',
    subtitle: 'Ozeanisches Cyan, Tiefsee-Glanz & Klarheit',
    accent: '#06B6D4',
    icon: 'water-outline'
  },
  mosspulse: {
    name: 'Moss Pulse',
    subtitle: 'Nordischer Wald, lebendiges Moos & Salbei',
    accent: '#4ADE80',
    icon: 'leaf-outline'
  },
  oxford: {
    name: 'Oxford Editorial',
    subtitle: 'Klassisches Buchpapier, Bernstein & Burgunder',
    accent: '#F59E0B',
    icon: 'book-outline'
  },
  cyberpunk: {
    name: 'Obsidian Ember',
    subtitle: 'Stealth-Anthrazit & Reddit Glutrot',
    accent: '#FF5722',
    icon: 'flame-outline'
  },
  monochrome: {
    name: 'Minimalist Slate',
    subtitle: 'Bauhaus Ästhetik, Schiefer & Elektro-Indigo',
    accent: '#6366F1',
    icon: 'hardware-chip-outline'
  }
};

export function getThemeColors(mode: ThemeMode = 'dark', palette: ThemePalette = 'tidalglass'): ThemeColors {
  if (palette === 'mosspulse') {
    return mode === 'dark'
      ? {
          background: '#0F1410',
          surface: '#182019',
          surfaceSecondary: '#202B22',
          surfaceSubtle: '#28362B',
          textPrimary: '#EAF2EB',
          textSecondary: '#A7B9A9',
          textMuted: '#6C806F',
          accent: '#4ADE80',
          accentSubtle: 'rgba(74, 222, 128, 0.15)',
          border: '#263428',
          borderSubtle: '#1C271E',
          danger: '#CF6679',
          success: '#81C784',
          badgeBg: '#202B22',
          badgeText: '#D2EAD6',
          cardHighlight: '#1E2B20'
        }
      : {
          background: '#F4F8F4',
          surface: '#FFFFFF',
          surfaceSecondary: '#EAF2EB',
          surfaceSubtle: '#DFECE1',
          textPrimary: '#132216',
          textSecondary: '#425A47',
          textMuted: '#758D7A',
          accent: '#15803D',
          accentSubtle: 'rgba(21, 128, 61, 0.12)',
          border: '#D5E4D8',
          borderSubtle: '#E4EFE6',
          danger: '#A83232',
          success: '#2E7D32',
          badgeBg: '#E2EFE4',
          badgeText: '#1B3D22',
          cardHighlight: '#EDF6EF'
        };
  }

  if (palette === 'oxford') {
    return mode === 'dark'
      ? {
          background: '#151214',
          surface: '#211C20',
          surfaceSecondary: '#2D262C',
          surfaceSubtle: '#3B323A',
          textPrimary: '#F5ECE8',
          textSecondary: '#C4B2B0',
          textMuted: '#847372',
          accent: '#F59E0B',
          accentSubtle: 'rgba(245, 158, 11, 0.15)',
          border: '#382D36',
          borderSubtle: '#292027',
          danger: '#CF6679',
          success: '#81C784',
          badgeBg: '#2D262C',
          badgeText: '#FDE68A',
          cardHighlight: '#261F24'
        }
      : {
          background: '#FBF8F3',
          surface: '#FFFFFF',
          surfaceSecondary: '#F3ECE2',
          surfaceSubtle: '#E9DFD2',
          textPrimary: '#2A1A1E',
          textSecondary: '#614B50',
          textMuted: '#8F797E',
          accent: '#991B1B',
          accentSubtle: 'rgba(153, 27, 27, 0.10)',
          border: '#E4D7C8',
          borderSubtle: '#F0E6D8',
          danger: '#A83232',
          success: '#2E7D32',
          badgeBg: '#F5EBE6',
          badgeText: '#781515',
          cardHighlight: '#FDF6ED'
        };
  }

  if (palette === 'cyberpunk') {
    return mode === 'dark'
      ? {
          background: '#0D0E11',
          surface: '#16181D',
          surfaceSecondary: '#20232B',
          surfaceSubtle: '#2A2F3A',
          textPrimary: '#F3F4F6',
          textSecondary: '#9CA3AF',
          textMuted: '#6B7280',
          accent: '#FF5722',
          accentSubtle: 'rgba(255, 87, 34, 0.15)',
          border: '#2D323E',
          borderSubtle: '#1F232B',
          danger: '#EF4444',
          success: '#10B981',
          badgeBg: '#222631',
          badgeText: '#FFCCBC',
          cardHighlight: '#1F222A'
        }
      : {
          background: '#F8F9FA',
          surface: '#FFFFFF',
          surfaceSecondary: '#F1F3F5',
          surfaceSubtle: '#E5E7EB',
          textPrimary: '#111827',
          textSecondary: '#4B5563',
          textMuted: '#6B7280',
          accent: '#EA580C',
          accentSubtle: 'rgba(234, 88, 12, 0.12)',
          border: '#D1D5DB',
          borderSubtle: '#E5E7EB',
          danger: '#DC2626',
          success: '#059669',
          badgeBg: '#FFEDD5',
          badgeText: '#9A3412',
          cardHighlight: '#FFF7ED'
        };
  }

  if (palette === 'monochrome') {
    return mode === 'dark'
      ? {
          background: '#0F172A',
          surface: '#1E293B',
          surfaceSecondary: '#334155',
          surfaceSubtle: '#475569',
          textPrimary: '#F8FAFC',
          textSecondary: '#94A3B8',
          textMuted: '#64748B',
          accent: '#6366F1',
          accentSubtle: 'rgba(99, 102, 241, 0.15)',
          border: '#334155',
          borderSubtle: '#1E293B',
          danger: '#F43F5E',
          success: '#10B981',
          badgeBg: '#334155',
          badgeText: '#C7D2FE',
          cardHighlight: '#1E293B'
        }
      : {
          background: '#F8FAFC',
          surface: '#FFFFFF',
          surfaceSecondary: '#F1F5F9',
          surfaceSubtle: '#E2E8F0',
          textPrimary: '#0F172A',
          textSecondary: '#475569',
          textMuted: '#64748B',
          accent: '#4F46E5',
          accentSubtle: 'rgba(79, 70, 229, 0.10)',
          border: '#CBD5E1',
          borderSubtle: '#E2E8F0',
          danger: '#E11D48',
          success: '#059669',
          badgeBg: '#EEF2FF',
          badgeText: '#3730A3',
          cardHighlight: '#F8FAFC'
        };
  }

  // Default: Tidal Glass (Ozeanisches Cyan)
  return mode === 'dark'
    ? {
        background: '#0B131B',
        surface: '#121E2A',
        surfaceSecondary: '#1A2A3B',
        surfaceSubtle: '#23384D',
        textPrimary: '#E1EDF7',
        textSecondary: '#8EABCA',
        textMuted: '#5A7797',
        accent: '#06B6D4',
        accentSubtle: 'rgba(6, 182, 212, 0.15)',
        border: '#20344A',
        borderSubtle: '#172737',
        danger: '#CF6679',
        success: '#10B981',
        badgeBg: '#182C3F',
        badgeText: '#CFFAFE',
        cardHighlight: '#142537'
      }
    : {
        background: '#F1F7FC',
        surface: '#FFFFFF',
        surfaceSecondary: '#E3EFF9',
        surfaceSubtle: '#D3E5F4',
        textPrimary: '#0C1E30',
        textSecondary: '#3B5B7E',
        textMuted: '#6C8CAE',
        accent: '#0891B2',
        accentSubtle: 'rgba(8, 145, 178, 0.12)',
        border: '#CBE0F2',
        borderSubtle: '#DEECF8',
        danger: '#A83232',
        success: '#2E7D32',
        badgeBg: '#E0F2FE',
        badgeText: '#075985',
        cardHighlight: '#EBF5FD'
      };
}

export const lightColors = getThemeColors('light', 'mosspulse');
export const darkColors = getThemeColors('dark', 'mosspulse');

export const typography = {
  fontFamilies: {
    serif: 'Charter, Newsreader, "Iowan Old Style", Georgia, Cambria, "Times New Roman", serif',
    editorialSerif: 'Charter, Newsreader, "Iowan Old Style", Georgia, Cambria, serif',
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
  },
  sizes: {
    magazineHero: 36,
    magazineDeck: 20,
    magazineLede: 21,
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
    magazineHero: 46,
    magazineDeck: 30,
    magazineLede: 34,
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
  pill: 999,
  full: 9999
};
