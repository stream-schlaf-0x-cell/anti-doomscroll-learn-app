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
    name: 'Nordic Slate',
    subtitle: 'Kühler Schiefer, Stahlblau & ruhige Klarheit',
    accent: '#5282B8',
    icon: 'water-outline'
  },
  mosspulse: {
    name: 'Fjord Sage',
    subtitle: 'Kühler Salbei, nordische Kiefer & Mineralgrün',
    accent: '#4B9B7E',
    icon: 'leaf-outline'
  },
  oxford: {
    name: 'Archiv & Zinn',
    subtitle: 'Kühles Archivpapier, Zinn & gedämpftes Ocker',
    accent: '#B58952',
    icon: 'book-outline'
  },
  cyberpunk: {
    name: 'Graphit & Kupfer',
    subtitle: 'Dunkles Anthrazit & gedämpftes Terrakotta',
    accent: '#C86D51',
    icon: 'layers-outline'
  },
  monochrome: {
    name: 'Minimalist Indigo',
    subtitle: 'Kühles Schiefergrau & gedämpftes Mineral-Indigo',
    accent: '#6272A4',
    icon: 'grid-outline'
  }
};

export function getThemeColors(mode: ThemeMode = 'dark', palette: ThemePalette = 'tidalglass'): ThemeColors {
  if (palette === 'mosspulse') {
    return mode === 'dark'
      ? {
          background: '#0B100F',
          surface: '#121A18',
          surfaceSecondary: '#192421',
          surfaceSubtle: '#22302C',
          textPrimary: '#E2ECE9',
          textSecondary: '#94ABA4',
          textMuted: '#637A73',
          accent: '#4B9B7E',
          accentSubtle: 'rgba(75, 155, 126, 0.14)',
          border: '#21302C',
          borderSubtle: '#17221F',
          danger: '#C96A75',
          success: '#56A88A',
          badgeBg: '#192421',
          badgeText: '#B8DCD0',
          cardHighlight: '#15201D'
        }
      : {
          background: '#EFF4F2',
          surface: '#FAFCFB',
          surfaceSecondary: '#E3ECE9',
          surfaceSubtle: '#D5E2DE',
          textPrimary: '#12201C',
          textSecondary: '#455A53',
          textMuted: '#6E857D',
          accent: '#34785F',
          accentSubtle: 'rgba(52, 120, 95, 0.10)',
          border: '#CCDAD5',
          borderSubtle: '#DCE7E3',
          danger: '#A64452',
          success: '#2E7D62',
          badgeBg: '#E0ECE8',
          badgeText: '#235342',
          cardHighlight: '#F3F8F6'
        };
  }

  if (palette === 'oxford') {
    return mode === 'dark'
      ? {
          background: '#0E1014',
          surface: '#161920',
          surfaceSecondary: '#1F232C',
          surfaceSubtle: '#292E3A',
          textPrimary: '#E6E8EC',
          textSecondary: '#9EA4B0',
          textMuted: '#6C7280',
          accent: '#B58952',
          accentSubtle: 'rgba(181, 137, 82, 0.14)',
          border: '#272C37',
          borderSubtle: '#1C2029',
          danger: '#C96A75',
          success: '#4B9B7E',
          badgeBg: '#20242E',
          badgeText: '#DFC7A7',
          cardHighlight: '#1A1E26'
        }
      : {
          background: '#F2F3F5',
          surface: '#FAFAFC',
          surfaceSecondary: '#E7E9EE',
          surfaceSubtle: '#DBDDE4',
          textPrimary: '#181B22',
          textSecondary: '#4E5462',
          textMuted: '#767D8C',
          accent: '#8C6536',
          accentSubtle: 'rgba(140, 101, 54, 0.10)',
          border: '#D2D6E0',
          borderSubtle: '#E2E5EC',
          danger: '#A64452',
          success: '#2E7D62',
          badgeBg: '#EAE7E1',
          badgeText: '#664822',
          cardHighlight: '#F5F6F8'
        };
  }

  if (palette === 'cyberpunk') {
    return mode === 'dark'
      ? {
          background: '#0B0D11',
          surface: '#13161C',
          surfaceSecondary: '#1B1F28',
          surfaceSubtle: '#252A36',
          textPrimary: '#E5E7EB',
          textSecondary: '#98A1B0',
          textMuted: '#667080',
          accent: '#C86D51',
          accentSubtle: 'rgba(200, 109, 81, 0.14)',
          border: '#242936',
          borderSubtle: '#191D26',
          danger: '#C96A75',
          success: '#4B9B7E',
          badgeBg: '#1E222C',
          badgeText: '#E6B8A8',
          cardHighlight: '#171B23'
        }
      : {
          background: '#F1F3F6',
          surface: '#FAFBFC',
          surfaceSecondary: '#E6E9EF',
          surfaceSubtle: '#D8DDE6',
          textPrimary: '#141821',
          textSecondary: '#4B5363',
          textMuted: '#717A8B',
          accent: '#A85238',
          accentSubtle: 'rgba(168, 82, 56, 0.10)',
          border: '#CFD5E0',
          borderSubtle: '#DFE4EC',
          danger: '#A64452',
          success: '#2E7D62',
          badgeBg: '#EFE6E2',
          badgeText: '#7D3924',
          cardHighlight: '#F5F7FA'
        };
  }

  if (palette === 'monochrome') {
    return mode === 'dark'
      ? {
          background: '#0B0E14',
          surface: '#131822',
          surfaceSecondary: '#1C2331',
          surfaceSubtle: '#262F42',
          textPrimary: '#E6ECF5',
          textSecondary: '#94A3B8',
          textMuted: '#64748B',
          accent: '#6272A4',
          accentSubtle: 'rgba(98, 114, 164, 0.15)',
          border: '#232C3D',
          borderSubtle: '#181F2C',
          danger: '#C96A75',
          success: '#4B9B7E',
          badgeBg: '#1D2433',
          badgeText: '#C5CEE8',
          cardHighlight: '#161C28'
        }
      : {
          background: '#F1F4F9',
          surface: '#FAFCFF',
          surfaceSecondary: '#E6ECF5',
          surfaceSubtle: '#D8E1EE',
          textPrimary: '#0F172A',
          textSecondary: '#475569',
          textMuted: '#64748B',
          accent: '#4C5B8A',
          accentSubtle: 'rgba(76, 91, 138, 0.10)',
          border: '#CBD5E1',
          borderSubtle: '#DCE4EE',
          danger: '#A64452',
          success: '#2E7D62',
          badgeBg: '#E6EAF4',
          badgeText: '#364269',
          cardHighlight: '#F4F7FB'
        };
  }

  // Default: Nordic Slate ('tidalglass' — Kühler Schiefer & Stahlblau)
  return mode === 'dark'
    ? {
        background: '#0A0E14',
        surface: '#111722',
        surfaceSecondary: '#18202F',
        surfaceSubtle: '#202B3D',
        textPrimary: '#E4EBF3',
        textSecondary: '#94A3B8',
        textMuted: '#64748B',
        accent: '#5282B8',
        accentSubtle: 'rgba(82, 130, 184, 0.14)',
        border: '#222E42',
        borderSubtle: '#182232',
        danger: '#C96A75',
        success: '#4B9B7E',
        badgeBg: '#172233',
        badgeText: '#B8D0EB',
        cardHighlight: '#141D2B'
      }
    : {
        background: '#EFF3F8',
        surface: '#FAFCFF',
        surfaceSecondary: '#E4EBF3',
        surfaceSubtle: '#D6E0EC',
        textPrimary: '#111927',
        textSecondary: '#475569',
        textMuted: '#64748B',
        accent: '#3B6998',
        accentSubtle: 'rgba(59, 105, 152, 0.10)',
        border: '#CBD5E1',
        borderSubtle: '#DCE4EE',
        danger: '#A64452',
        success: '#2E7D62',
        badgeBg: '#E3ECF5',
        badgeText: '#2A4F75',
        cardHighlight: '#F3F7FB'
      };
}

export const lightColors = getThemeColors('light', 'tidalglass');
export const darkColors = getThemeColors('dark', 'tidalglass');

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
  xs: 4,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  pill: 999,
  full: 9999
};
