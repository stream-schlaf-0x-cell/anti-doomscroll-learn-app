export type ExternalBrowserPreference = 'safari' | 'firefox' | 'chrome' | 'in_app';

let cachedExternalBrowserPref: ExternalBrowserPreference = 'safari';

/**
 * Updates the synchronous in-memory browser preference cache used by link handlers.
 */
export function setCachedExternalBrowserPref(pref?: ExternalBrowserPreference): void {
  if (pref === 'safari' || pref === 'firefox' || pref === 'chrome' || pref === 'in_app') {
    cachedExternalBrowserPref = pref;
  } else {
    cachedExternalBrowserPref = 'safari';
  }
}

/**
 * Returns the currently cached external browser preference.
 */
export function getCachedExternalBrowserPref(): ExternalBrowserPreference {
  return cachedExternalBrowserPref;
}

/**
 * Detects whether the app is running inside an iOS/iPadOS Home-Screen standalone PWA.
 */
export function isIosStandalonePwa(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const nav = navigator as Navigator & { standalone?: boolean };
  const isAppleTouchDevice =
    /iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
  return (
    nav.standalone === true ||
    (isAppleTouchDevice && Boolean(window.matchMedia?.('(display-mode: standalone)').matches))
  );
}

/**
 * Builds the target URL for opening an external link, rewriting HTTP(S) URLs
 * with iOS browser URL schemes when inside an iOS standalone PWA so links open
 * directly in the chosen native browser instead of SFSafariViewController.
 */
export function buildExternalBrowserUrl(
  url: string,
  pref: ExternalBrowserPreference,
  isStandaloneIos: boolean
): string {
  if (!isStandaloneIos || !/^https?:\/\//i.test(url)) {
    return url;
  }

  switch (pref) {
    case 'safari':
      if (/^https:\/\//i.test(url)) {
        return url.replace(/^https:\/\//i, 'x-safari-https://');
      }
      return url.replace(/^http:\/\//i, 'x-safari-http://');
    case 'firefox':
      return `firefox://open-url?url=${encodeURIComponent(url)}`;
    case 'chrome':
      if (/^https:\/\//i.test(url)) {
        return url.replace(/^https:\/\//i, 'googlechromes://');
      }
      return url.replace(/^http:\/\//i, 'googlechrome://');
    case 'in_app':
    default:
      return url;
  }
}

/**
 * Opens an external URL in the user's preferred browser across web, iOS standalone PWA, and native.
 */
export function openExternalInBrowser(
  url: string,
  prefOverride?: ExternalBrowserPreference
): void {
  if (!url) return;
  const pref = prefOverride ?? cachedExternalBrowserPref;

  try {
    const isWebRuntime = typeof window !== 'undefined' && typeof document !== 'undefined';
    if (isWebRuntime) {
      const standaloneIos = isIosStandalonePwa();
      if (standaloneIos && /^https?:\/\//i.test(url)) {
        if (pref === 'in_app') {
          if (typeof window.open === 'function') {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
          return;
        }
        const target = buildExternalBrowserUrl(url, pref, true);
        try {
          window.location.href = target;
        } catch {
          const anchor = document.createElement('a');
          anchor.href = target;
          anchor.rel = 'noopener noreferrer';
          document.body?.appendChild(anchor);
          anchor.click();
          anchor.remove();
        }
        return;
      }

      if (typeof window.open === 'function') {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
    }

    void import('react-native')
      .then(({ Linking }) => Linking.openURL(url))
      .catch(() => {});
  } catch {
    // Non-fatal fallback
  }
}
