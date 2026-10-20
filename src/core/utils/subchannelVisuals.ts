export interface SubchannelVisualInfo {
  badgeColor: string;
  textColor: string;
  iconName: string;
}

const SUBCHANNEL_PALETTE = [
  '#2563EB', // Vibrant Blue
  '#059669', // Emerald Green
  '#7C3AED', // Vivid Purple
  '#D97706', // Warm Amber
  '#DC2626', // Crimson Red
  '#0891B2', // Deep Cyan
  '#4F46E5', // Indigo
  '#BE185D', // Pink / Rose
  '#475569', // Slate
  '#0D9488'  // Teal
];

export function getSubchannelVisual(channel?: {
  handle?: string;
  title?: string;
  accentColor?: string;
}): SubchannelVisualInfo {
  const handle = (channel?.handle || '').toLowerCase().trim();
  const explicitColor = channel?.accentColor;

  if (explicitColor && /^#[0-9A-Fa-f]{6}$/.test(explicitColor)) {
    return {
      badgeColor: explicitColor,
      textColor: '#FFFFFF',
      iconName: getChannelIconName(handle)
    };
  }

  let hash = 0;
  for (let i = 0; i < handle.length; i++) {
    hash = (hash << 5) - hash + handle.charCodeAt(i);
    hash |= 0;
  }
  const colorIndex = Math.abs(hash) % SUBCHANNEL_PALETTE.length;
  const badgeColor = SUBCHANNEL_PALETTE[colorIndex];

  return {
    badgeColor,
    textColor: '#FFFFFF',
    iconName: getChannelIconName(handle)
  };
}

export function getChannelIconName(handle: string): string {
  const h = handle.toLowerCase();
  if (h.includes('politik') || h.includes('state') || h.includes('staat')) return 'globe-outline';
  if (h.includes('lern') || h.includes('schul') || h.includes('didaktik')) return 'school-outline';
  if (h.includes('tech') || h.includes('ki') || h.includes('ai') || h.includes('code')) return 'hardware-chip-outline';
  if (h.includes('phil') || h.includes('ethik') || h.includes('mind')) return 'sparkles-outline';
  if (h.includes('art') || h.includes('kunst') || h.includes('musik')) return 'color-palette-outline';
  if (h.includes('news') || h.includes('nachricht') || h.includes('aktuell')) return 'newspaper-outline';
  if (h.includes('bio') || h.includes('natur') || h.includes('umwelt')) return 'leaf-outline';
  return 'planet-outline';
}
