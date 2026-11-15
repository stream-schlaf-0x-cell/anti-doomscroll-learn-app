/**
 * Image Quality Optimization, High-Res Gate & Upscaling Utility
 * Automatically transforms image URLs from Unsplash, iTunes, YouTube, Wikimedia,
 * and news CDNs to serve crisp, high-resolution assets on retina displays,
 * while rejecting publisher logos, favicons, tracking pixels, and placeholder SVGs.
 */

const REJECTED_IMAGE_PATTERNS = [
  'feedburner.com',
  '1x1',
  'pixel.wp.com',
  'pixel.gif',
  '-pixel.',
  'tracking',
  'beacon',
  '/avatar/',
  'gravatar.com',
  'favicon',
  'apple-touch-icon',
  'logo',
  'site-logo',
  'brand-logo',
  'placeholder',
  'default-thumb',
  'spacer.gif',
  'blank.gif',
  'images.unsplash.com',
  's.w.org/images/core/emoji',
  'wp-includes/images/smilies',
  'techpresso',
  'wordmark',
  'masthead',
  'email-header',
  'email_header',
  'newsletter-header',
  'newsletter_header',
  'top-banner',
  'header-banner',
  '404bild',
  '/404.jpg',
  '/404.png',
  '/no-image.',
  '/noimage.',
  '/default-image.',
  'static.dupplemedia.com'
];

/** Minimum real pixel size for editorial photos; anything smaller looks pixelated on retina screens. */
export const MIN_EDITORIAL_IMAGE_WIDTH = 380;
export const MIN_EDITORIAL_IMAGE_HEIGHT = 200;

/**
 * Reads the decoded pixel size of a loaded image from an `<Image onLoad>` event on every platform.
 * - Native (iOS/Android): `nativeEvent.source.width/height`
 * - react-native-web: `nativeEvent` is the DOM load event, so the size lives on `target.naturalWidth/naturalHeight`
 */
export function extractLoadedImageDimensions(event: unknown): { width: number; height: number } | null {
  if (!event || typeof event !== 'object') return null;
  const nativeEvent = (event as { nativeEvent?: unknown }).nativeEvent;
  if (!nativeEvent || typeof nativeEvent !== 'object') return null;

  const source = (nativeEvent as { source?: { width?: unknown; height?: unknown } }).source;
  if (source && typeof source.width === 'number' && typeof source.height === 'number' && source.width > 0 && source.height > 0) {
    return { width: source.width, height: source.height };
  }

  const candidates: unknown[] = [
    (nativeEvent as { target?: unknown }).target,
    (nativeEvent as { currentTarget?: unknown }).currentTarget,
    (nativeEvent as { srcElement?: unknown }).srcElement
  ];
  for (const cand of candidates) {
    if (cand && typeof cand === 'object') {
      const w = (cand as { naturalWidth?: unknown }).naturalWidth;
      const h = (cand as { naturalHeight?: unknown }).naturalHeight;
      if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
        return { width: w, height: h };
      }
    }
  }
  return null;
}

/** True when a decoded editorial photo is too small to be shown crisply in a full-width card. */
export function isLowResolutionEditorialImage(width: number, height: number): boolean {
  if (!(width > 0) || !(height > 0)) return false;
  return width < MIN_EDITORIAL_IMAGE_WIDTH || height < MIN_EDITORIAL_IMAGE_HEIGHT;
}

const TRUSTED_MUSEUM_OR_ART_DOMAINS = [
  'artic.edu',
  'wikimedia.org',
  'wikipedia.org',
  'metmuseum.org',
  'rijksmuseum.nl',
  'nga.gov',
  'guggenheim.org',
  'moma.org',
  'hamburger-kunsthalle.de',
  'bauhaus-dessau.de',
  'thisiscolossal.com',
  'hyperallergic.com'
];

export function isTrustedMuseumOrArtDomain(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  return TRUSTED_MUSEUM_OR_ART_DOMAINS.some(d => clean.includes(d));
}

export function isRejectedLowResOrLogoUrl(url?: string, allowMemeSvg = false): boolean {
  if (!url || typeof url !== 'string') return true;
  const clean = url.trim().toLowerCase();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    return true;
  }

  if (clean.endsWith('.ico')) return true;
  if (clean.endsWith('.svg') && !allowMemeSvg) return true;

  if (isTrustedMuseumOrArtDomain(clean)) {
    return false;
  }

  for (const pattern of REJECTED_IMAGE_PATTERNS) {
    if (clean.includes(pattern)) {
      return true;
    }
  }

  // Amazon product thumbnails (_SL160_, _AC_US200_ …) are tiny shop icons, never editorial photos
  if (clean.includes('media-amazon.com') || clean.includes('images-amazon.com')) {
    const amazonSize = clean.match(/_(?:sl|ac_us|ac_sl|sx|sy|us)(\d{2,4})_/);
    if (!amazonSize || parseInt(amazonSize[1], 10) < 600) {
      return true;
    }
  }

  // Reject explicit tiny dimension patterns in path like /50x50/ or /100x100/ (unless iTunes mzstatic which can be upgraded)
  if (!clean.includes('mzstatic.com')) {
    const dimMatch = clean.match(/[/-](\d{2,3})x(\d{2,3})[/_.-]/);
    if (dimMatch) {
      const w = parseInt(dimMatch[1], 10);
      const h = parseInt(dimMatch[2], 10);
      if (w < 240 && h < 240) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Detects generic newsletter masthead banners, Beehiiv/Substack logos, or wide header graphics
 * that crop poorly inside standard editorial card frames.
 */
export function isLikelyBannerOrLogoUrl(url?: string, publisher?: string, allowMemeSvg = false): boolean {
  if (!url || typeof url !== 'string') return true;
  if (isRejectedLowResOrLogoUrl(url, allowMemeSvg)) return true;

  const clean = url.trim().toLowerCase();
  if (isTrustedMuseumOrArtDomain(clean)) return false;

  if (
    publisher &&
    /techpresso/i.test(publisher) &&
    (clean.includes('media.beehiiv.com') || clean.includes('beehiiv.com') || clean.includes('webflow.com'))
  ) {
    return true;
  }

  if (/(?:header|banner|masthead|wordmark|logo)[-_.]|(?:[-_.]banner\b)/i.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Rewrites known low-res CDN thumbnail patterns to high resolution (1080p / 800px+)
 * and returns undefined if the URL is invalid, a logo, favicon, tracking pixel, or placeholder SVG.
 */
export function upgradeImageResolutionUrl(url?: string, targetWidth = 1080): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (isRejectedLowResOrLogoUrl(trimmed)) {
    return undefined;
  }

  try {
    let upgraded = trimmed;

    // 1. Wikimedia / Wikipedia: upgrade /thumb/.../200px-... to standard /800px-... step width
    if (
      (upgraded.includes('upload.wikimedia.org') || upgraded.includes('wikipedia.org')) &&
      upgraded.includes('/thumb/')
    ) {
      upgraded = upgraded.replace(/\/(\d+)px-/g, (_match, pxStr) => {
        const px = parseInt(pxStr, 10);
        return px < 800 || px === 960 ? '/800px-' : `/${px}px-`;
      });
    }

    // 2. Apple / iTunes artwork: upgrade 100x100 to 1200x1200bb
    if (upgraded.includes('mzstatic.com')) {
      upgraded = upgraded
        .replace(/\/\d+x\d+bb\.jpg/i, '/1200x1200bb.jpg')
        .replace(/\/\d+x\d+bb\.png/i, '/1200x1200bb.png');
    }

    // 3. YouTube thumbnails: prefer maxresdefault.jpg over hqdefault/mqdefault/default
    if (upgraded.includes('i.ytimg.com') || upgraded.includes('img.youtube.com')) {
      if (upgraded.endsWith('default.jpg') && !upgraded.endsWith('maxresdefault.jpg')) {
        upgraded = upgraded
          .replace(/\/default\.jpg$/i, '/maxresdefault.jpg')
          .replace(/\/hqdefault\.jpg$/i, '/maxresdefault.jpg')
          .replace(/\/mqdefault\.jpg$/i, '/maxresdefault.jpg');
      }
    }

    // 4. Deutschlandfunk & Deutschlandradio: upgrade square/small crops to 1920x1080 master
    if (upgraded.includes('bilder.deutschlandfunk.de')) {
      upgraded = upgraded
        .replace(/-(1920x1920|768x768|512x512|640x640|320x180|480x270)\.jpg$/i, '-1920x1080.jpg')
        .replace(/-(1920x1920|768x768|512x512|640x640|320x180|480x270)\.png$/i, '-1920x1080.png');
    }

    // 5. ARD Tagesschau: upgrade 1x1 / klein / mittelgross to grossgalerie16x9
    if (upgraded.includes('tagesschau.de')) {
      upgraded = upgraded
        .replace(/\/format-1x1\//g, '/format-16x9/')
        .replace(/\/grossgalerie1x1\//g, '/grossgalerie16x9/')
        .replace(/\/mittelgross1x1\//g, '/grossgalerie16x9/')
        .replace(/\/klein1x1\//g, '/grossgalerie16x9/')
        .replace(/\/klein16x9\//g, '/grossgalerie16x9/')
        .replace(/\/mittelgross16x9\//g, '/grossgalerie16x9/');
    }

    // 6. ZDF & ZDFheute: upgrade downsampled thumbnails to 1920x1080
    if (/zdf(?:heute)?\.de/.test(upgraded)) {
      upgraded = upgraded.replace(/-(768x768|1280x1280|512x512|384x216|640x360)\.jpg$/i, '-1920x1080.jpg');
      // zdfheute asset URLs use a tilde size suffix: .../bild-100~384x216?cb=...
      upgraded = upgraded.replace(/~(\d{2,4})x(\d{2,4})(?=$|[?#])/, (match, wStr) => {
        return parseInt(wStr, 10) < 1280 ? '~1280x720' : match;
      });
    }

    // 6b. Phys.org / TechXplore / MedicalXpress (b-cdn): /csz/news/tmb/ is a ~90px thumbnail, /800a/ is the 800px master
    if (upgraded.includes('scx1.b-cdn.net') || upgraded.includes('scx2.b-cdn.net')) {
      upgraded = upgraded.replace(/\/csz\/news\/(?:tmb|thumbnails|200|400)\//, '/csz/news/800a/');
    }

    // 6c. ArchDaily (adsttc): newsletter / thumb / medium crops → large_jpg master
    if (upgraded.includes('images.adsttc.com')) {
      upgraded = upgraded.replace(/\/(?:newsletter|thumb_jpg|medium_jpg|small_jpg|slideshow)\//, '/large_jpg/');
    }

    // 6d. Atlas Obscura uses signed imgproxy URLs (resizing them yields 403), so small thumbnails are
    //     filtered by the decoded-size gate in FeedCard/Reader instead of being upscaled here.

    // 6e. WordPress intermediate sizes (-300x220.webp, -360x270.png, -500x500.jpeg) → original upload.
    //     FeedCard / Reader fall back to the raw URL automatically if a site removed its original file.
    if (upgraded.includes('/wp-content/uploads/')) {
      upgraded = upgraded.replace(
        /-(\d{2,4})x(\d{2,4})(\.(?:jpe?g|png|webp|gif|avif))(?=$|[?#])/i,
        (match, wStr, hStr, ext) => {
          const w = parseInt(wStr, 10);
          const h = parseInt(hStr, 10);
          return w < 700 && h < 700 ? ext : match;
        }
      );
    }

    // 7. Generic URL query parameter upscaling (w=150, width=240, size=small, quality=50, etc.)
    const parsedUrl = new URL(upgraded);

    if (parsedUrl.hostname.includes('.wp.com')) {
      parsedUrl.searchParams.delete('fit');
      parsedUrl.searchParams.delete('resize');
    }

    for (const widthParam of ['w', 'width', 'maxwidth', 'imwidth']) {
      if (parsedUrl.searchParams.has(widthParam)) {
        const val = parseInt(parsedUrl.searchParams.get(widthParam) || '0', 10);
        if (!isNaN(val) && val > 0 && val < targetWidth) {
          parsedUrl.searchParams.set(widthParam, String(targetWidth));
        }
      }
    }

    for (const heightParam of ['h', 'height', 'maxheight']) {
      if (parsedUrl.searchParams.has(heightParam)) {
        const val = parseInt(parsedUrl.searchParams.get(heightParam) || '0', 10);
        if (!isNaN(val) && val > 0 && val < 600) {
          parsedUrl.searchParams.delete(heightParam);
        }
      }
    }

    if (parsedUrl.searchParams.has('size')) {
      const sizeVal = (parsedUrl.searchParams.get('size') || '').toLowerCase();
      if (['small', 'thumb', 'thumbnail', 'tiny', 'xs', 'sm', 'medium'].includes(sizeVal)) {
        parsedUrl.searchParams.set('size', 'large');
      }
    }

    for (const qParam of ['q', 'quality']) {
      if (parsedUrl.searchParams.has(qParam)) {
        const qVal = parseInt(parsedUrl.searchParams.get(qParam) || '0', 10);
        if (!isNaN(qVal) && qVal > 0 && qVal < 80) {
          parsedUrl.searchParams.set(qParam, '85');
        }
      }
    }

    return parsedUrl.toString();
  } catch {
    return trimmed;
  }
}

export function optimizeImageUrl(url?: string, targetWidth = 1080): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Keep Unsplash optimization only for explicit artwork showcase calls
  if (trimmed.includes('images.unsplash.com')) {
    try {
      const u = new URL(trimmed);
      u.searchParams.set('auto', 'format');
      u.searchParams.set('fit', 'crop');
      u.searchParams.set('w', String(targetWidth));
      u.searchParams.set('q', '85');
      return u.toString();
    } catch {
      return trimmed;
    }
  }

  return upgradeImageResolutionUrl(trimmed, targetWidth);
}

export type EditorialVisualCategory = 'comic' | 'square_photo' | 'landscape_photo' | 'suppressed';

export interface EditorialImageAssessment {
  isValid: boolean;
  category: EditorialVisualCategory;
  objectPosition: string; // e.g. 'top center'
  recommendedAspectRatio?: number;
  reason?: string;
}

/**
 * Bildredaktion (Editorial Image Desk)
 * Inspects image provenance, format and aspect ratios to prevent surreal chopped faces,
 * blurry tracking pixels or warped banners from reaching the reader.
 */
export function assessEditorialImage(
  url?: string,
  meta?: { format?: string; title?: string; isMeme?: boolean }
): EditorialImageAssessment {
  if (!url || typeof url !== 'string') {
    return { isValid: false, category: 'suppressed', objectPosition: 'center center', reason: 'Keine URL vorhanden' };
  }

  const isComicOrMeme = Boolean(
    meta?.isMeme ||
    meta?.format === 'meme' ||
    url.toLowerCase().includes('xkcd.com') ||
    url.toLowerCase().includes('smbc-comics.com')
  );

  if (isRejectedLowResOrLogoUrl(url, isComicOrMeme) || (!isComicOrMeme && isLikelyBannerOrLogoUrl(url, undefined, isComicOrMeme))) {
    return {
      isValid: false,
      category: 'suppressed',
      objectPosition: 'center center',
      reason: 'Logo, Newsletter-Banner, Platzhalter-SVG oder Tracking-Pixel verworfen'
    };
  }

  const clean = url.trim().toLowerCase();

  // 1. Comics & Visual Humor (xkcd, SMBC, PBF, Futility Closet)
  if (isComicOrMeme) {
    return {
      isValid: true,
      category: 'comic',
      objectPosition: 'center center',
      reason: 'Comic-Zeichnung: Vollständige unbeschnittene Einpassung'
    };
  }

  // 2. Square format (Artworks, Album Art, Book Covers, Square Portraits)
  if (
    clean.includes('cover') ||
    clean.includes('album') ||
    clean.includes('artwork') ||
    clean.includes('1920x1920') ||
    clean.includes('1000x1000') ||
    clean.includes('mzstatic.com')
  ) {
    return {
      isValid: true,
      category: 'square_photo',
      objectPosition: 'top center',
      recommendedAspectRatio: 1.0,
      reason: 'Quadratisches Kunstwerk / Cover: Zentriert gerahmt, Stirnhöhe geschützt'
    };
  }

  // 3. Editorial Landscape Press Photos (16:9 / 3:2)
  return {
    isValid: true,
    category: 'landscape_photo',
    objectPosition: 'top center',
    recommendedAspectRatio: 16 / 9,
    reason: 'Redaktionelles Pressefoto: 16:9 Master mit Kopfraum-Priorität'
  };
}
