import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildExternalBrowserUrl,
  getCachedExternalBrowserPref,
  setCachedExternalBrowserPref,
  isIosStandalonePwa
} from '../src/core/utils/externalBrowser';
import { getThemeColors, ThemePalette } from '../src/ui/theme';
import { UserProfileSchema, applyOptimisticReadingPreference } from '../src/core/domain/types';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

test('External Browser Launch, Dark Mode Contrast & Optimistic Prefs (v18)', async (t) => {
  await t.test('1. buildExternalBrowserUrl rewrites iOS standalone PWA URLs per preference', () => {
    const httpsUrl = 'https://example.com/artikel?id=42&lang=de';
    const httpUrl = 'http://example.com/archiv';

    // iOS Standalone PWA
    assert.equal(
      buildExternalBrowserUrl(httpsUrl, 'safari', true),
      'x-safari-https://example.com/artikel?id=42&lang=de'
    );
    assert.equal(
      buildExternalBrowserUrl(httpUrl, 'safari', true),
      'x-safari-http://example.com/archiv'
    );
    assert.equal(
      buildExternalBrowserUrl(httpsUrl, 'firefox', true),
      `firefox://open-url?url=${encodeURIComponent(httpsUrl)}`
    );
    assert.equal(
      buildExternalBrowserUrl(httpsUrl, 'chrome', true),
      'googlechromes://example.com/artikel?id=42&lang=de'
    );
    assert.equal(
      buildExternalBrowserUrl(httpUrl, 'chrome', true),
      'googlechrome://example.com/archiv'
    );
    assert.equal(
      buildExternalBrowserUrl(httpsUrl, 'in_app', true),
      httpsUrl
    );

    // Non-HTTP(S) schemes remain untouched even in standalone iOS
    assert.equal(
      buildExternalBrowserUrl('mailto:info@example.com', 'safari', true),
      'mailto:info@example.com'
    );

    // Non-DOM Node environment reports false for isIosStandalonePwa
    assert.equal(isIosStandalonePwa(), false);

    // Desktop / non-standalone web preserves original URLs across all preferences
    for (const pref of ['safari', 'firefox', 'chrome', 'in_app'] as const) {
      assert.equal(buildExternalBrowserUrl(httpsUrl, pref, false), httpsUrl);
      assert.equal(buildExternalBrowserUrl(httpUrl, pref, false), httpUrl);
    }
  });

  await t.test('2. Cached external browser preference sync & UserProfileSchema backwards compatibility', () => {
    setCachedExternalBrowserPref('firefox');
    assert.equal(getCachedExternalBrowserPref(), 'firefox');
    setCachedExternalBrowserPref('chrome');
    assert.equal(getCachedExternalBrowserPref(), 'chrome');
    setCachedExternalBrowserPref(undefined);
    assert.equal(getCachedExternalBrowserPref(), 'safari');

    // Legacy profile without externalBrowser parses cleanly and defaults to 'safari'
    const legacyParsed = UserProfileSchema.parse(DEFAULT_USER_PROFILE);
    assert.equal(legacyParsed.readingPreferences.externalBrowser, 'safari');

    const withChrome = UserProfileSchema.parse({
      ...DEFAULT_USER_PROFILE,
      readingPreferences: {
        ...DEFAULT_USER_PROFILE.readingPreferences,
        externalBrowser: 'chrome'
      }
    });
    assert.equal(withChrome.readingPreferences.externalBrowser, 'chrome');
  });

  await t.test('3. Dark mode palettes achieve crisp WCAG contrast across all 5 palettes', () => {
    const expectedDark: Record<ThemePalette, { textPrimary: string; textSecondary: string; textMuted: string }> = {
      mosspulse: { textPrimary: '#F3F7F5', textSecondary: '#C5D5CF', textMuted: '#92AAA2' },
      oxford: { textPrimary: '#F4F5F8', textSecondary: '#C9CED9', textMuted: '#98A0B0' },
      cyberpunk: { textPrimary: '#F4F6F9', textSecondary: '#C7CFD9', textMuted: '#95A0B2' },
      monochrome: { textPrimary: '#F3F6FC', textSecondary: '#C6D1E2', textMuted: '#94A4BE' },
      tidalglass: { textPrimary: '#F4F7FB', textSecondary: '#C8D4E3', textMuted: '#95A7BE' }
    };

    (Object.keys(expectedDark) as ThemePalette[]).forEach(palette => {
      const c = getThemeColors('dark', palette);
      assert.equal(c.textPrimary, expectedDark[palette].textPrimary);
      assert.equal(c.textSecondary, expectedDark[palette].textSecondary);
      assert.equal(c.textMuted, expectedDark[palette].textMuted);

      assert.ok(
        contrastRatio(c.textPrimary, c.surface) >= 12,
        `${palette} dark textPrimary contrast on surface should be >= 12`
      );
      assert.ok(
        contrastRatio(c.textSecondary, c.surface) >= 8,
        `${palette} dark textSecondary contrast on surface should be >= 8`
      );
      assert.ok(
        contrastRatio(c.textMuted, c.surface) >= 4.5,
        `${palette} dark textMuted contrast on surface should be >= 4.5`
      );
    });
  });

  await t.test('4. 0ms optimistic theme/palette/font/browser updates & guarded goHome', () => {
    const base = UserProfileSchema.parse(DEFAULT_USER_PROFILE);
    const updatedTheme = applyOptimisticReadingPreference(base, { theme: 'light' });
    assert.equal(updatedTheme.readingPreferences.theme, 'light');
    assert.equal(base.readingPreferences.theme, 'dark', 'Pure helper must not mutate previous profile');

    const updatedPalette = applyOptimisticReadingPreference(updatedTheme, { palette: 'oxford' });
    assert.equal(updatedPalette.readingPreferences.palette, 'oxford');
    assert.equal(updatedPalette.readingPreferences.theme, 'light');

    const updatedBrowser = applyOptimisticReadingPreference(updatedPalette, {
      fontSize: 'lg',
      externalBrowser: 'firefox'
    });
    assert.equal(updatedBrowser.readingPreferences.fontSize, 'lg');
    assert.equal(updatedBrowser.readingPreferences.externalBrowser, 'firefox');

    const appContextSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/core/context/AppContext.tsx'),
      'utf8'
    );
    assert.ok(
      appContextSrc.includes('latestProfileRef.current = optimistic;') &&
        appContextSrc.includes('setProfile(optimistic);') &&
        appContextSrc.includes('latestProfileRef.current = prevProfile;'),
      'AppContext must commit optimistic profile synchronously and roll back on persistence failure'
    );
    assert.ok(
      appContextSrc.includes('const needsEditionSwitch = autoEdition !== selectedEditionTypeRef.current;') &&
        appContextSrc.includes('const needsRecompute = needsEditionSwitch || latestDailyEditionRef.current.length === 0;') &&
        appContextSrc.includes('if (needsRecompute)'),
      'goHome must only recompute feed when edition changes or dailyEdition is empty'
    );

    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'App.tsx'), 'utf8');
    assert.ok(
      !appSrc.includes("setActiveTab('feed');\n                goHome();"),
      'App.tsx desktop brand button must call goHome() directly without redundant setActiveTab'
    );
  });
});
