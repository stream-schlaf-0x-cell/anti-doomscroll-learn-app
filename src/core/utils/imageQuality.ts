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
  'images.unsplash.com'
];

export function isRejectedLowResOrLogoUrl(url?: string, allowMemeSvg = false): boolean {
  if (!url || typeof url !== 'string') return true;
  const clean = url.trim().toLowerCase();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    return true;
  }

  if (clean.endsWith('.ico')) return true;
  if (clean.endsWith('.svg') && !allowMemeSvg) return true;

  for (const pattern of REJECTED_IMAGE_PATTERNS) {
    if (clean.includes(pattern)) {
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

    // 1. Wikimedia / Wikipedia: upgrade /thumb/.../200px-... to /800px-...
    if (
      (upgraded.includes('upload.wikimedia.org') || upgraded.includes('wikipedia.org')) &&
      upgraded.includes('/thumb/')
    ) {
      upgraded = upgraded.replace(/\/(\d+)px-/g, (_match, pxStr) => {
        const px = parseInt(pxStr, 10);
        return px < 800 ? '/800px-' : `/${px}px-`;
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
    if (upgraded.includes('zdf.de')) {
      upgraded = upgraded.replace(/-(768x768|1280x1280|512x512|384x216|640x360)\.jpg$/i, '-1920x1080.jpg');
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

  if (isRejectedLowResOrLogoUrl(url, isComicOrMeme)) {
    return {
      isValid: false,
      category: 'suppressed',
      objectPosition: 'center center',
      reason: 'Logo, Favicon, Platzhalter-SVG oder Tracking-Pixel verworfen'
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
