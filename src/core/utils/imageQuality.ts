/**
 * Image Quality Optimization & Upscaling Utility
 * Automatically transforms image URLs from Unsplash, iTunes, YouTube, Wikimedia,
 * and news outlets to serve crisp, high-resolution assets on retina displays.
 */

export function optimizeImageUrl(url?: string, targetWidth = 1400): string | undefined {
  if (!url || typeof url !== 'string') return undefined;

  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed;
  }

  try {
    // 1. Unsplash: Upgrade to high-density targetWidth with 85% quality
    if (trimmed.includes('images.unsplash.com')) {
      const u = new URL(trimmed);
      u.searchParams.set('auto', 'format');
      u.searchParams.set('fit', 'crop');
      u.searchParams.set('w', String(targetWidth));
      u.searchParams.set('q', '85');
      return u.toString();
    }

    // 2. Apple / iTunes artwork: upgrade 100x100 to 1200x1200bb.jpg
    if (trimmed.includes('mzstatic.com')) {
      return trimmed
        .replace(/\/\d+x\d+bb\.jpg/, '/1200x1200bb.jpg')
        .replace(/\/\d+x\d+bb\.png/, '/1200x1200bb.png');
    }

    // 3. YouTube thumbnails: prefer maxresdefault.jpg over hqdefault or default
    if (trimmed.includes('i.ytimg.com') || trimmed.includes('img.youtube.com')) {
      if (trimmed.endsWith('default.jpg') && !trimmed.endsWith('maxresdefault.jpg')) {
        return trimmed.replace(/\/default\.jpg$/, '/maxresdefault.jpg')
          .replace(/\/hqdefault\.jpg$/, '/maxresdefault.jpg')
          .replace(/\/mqdefault\.jpg$/, '/maxresdefault.jpg');
      }
    }

    // 4. Wikimedia: upgrade low-res thumbnails to 1280px
    if (trimmed.includes('upload.wikimedia.org') && trimmed.includes('/thumb/')) {
      return trimmed.replace(/\/\d+px-/, '/1280px-');
    }

    // 5. WordPress Jetpack / Photon CDN (e.g. i0.wp.com, i1.wp.com):
    // Strip downsampling ?fit=... or ?resize=... to serve the full-resolution original asset
    if (trimmed.includes('.wp.com/')) {
      const u = new URL(trimmed);
      if (u.searchParams.has('fit')) {
        u.searchParams.delete('fit');
      }
      if (u.searchParams.has('resize')) {
        u.searchParams.delete('resize');
      }
      return u.toString();
    }

    // 6. Deutschlandfunk & Deutschlandradio (bilder.deutschlandfunk.de):
    // Mechanized square crops (-1920x1920.jpg, -768x768.jpg) chop off faces/heads in landscape press photos!
    // Upgrade to full 16:9 master frame (-1920x1080.jpg) where heads are 100% in frame.
    if (trimmed.includes('bilder.deutschlandfunk.de')) {
      return trimmed
        .replace(/-(1920x1920|768x768|512x512|640x640)\.jpg$/i, '-1920x1080.jpg')
        .replace(/-(1920x1920|768x768|512x512|640x640)\.png$/i, '-1920x1080.png');
    }

    // 7. ARD Tagesschau (images.tagesschau.de):
    // Upgrade 1:1 crops to 16:9 widescreen master photos to keep podium/faces in frame
    if (trimmed.includes('tagesschau.de') && (trimmed.includes('1x1') || trimmed.includes('/format-1x1/'))) {
      return trimmed
        .replace(/\/format-1x1\//g, '/format-16x9/')
        .replace(/\/grossgalerie1x1\//g, '/grossgalerie16x9/')
        .replace(/\/mittelgross1x1\//g, '/mittelgross16x9/')
        .replace(/\/klein1x1\//g, '/klein16x9/');
    }

    // 8. ZDF & ZDFheute (zdf.de):
    // Upgrade square downsampled thumbnails to 1920x1080 master
    if (trimmed.includes('zdf.de')) {
      return trimmed
        .replace(/-(768x768|1280x1280|512x512)\.jpg$/i, '-1920x1080.jpg');
    }

    return trimmed;
  } catch {
    return trimmed;
  }
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

  const clean = url.trim().toLowerCase();

  // Reject tracking beacons, feedly/feedburner 1x1 pixels, empty gifs
  if (
    clean.includes('feedburner.com') ||
    clean.includes('1x1.gif') ||
    clean.includes('pixel.wp.com') ||
    clean.includes('tracking') ||
    clean.includes('beacon') ||
    clean.includes('/avatar/') ||
    clean.includes('gravatar.com') ||
    clean.endsWith('.ico')
  ) {
    return { isValid: false, category: 'suppressed', objectPosition: 'center center', reason: 'Tracking-Pixel oder Profil-Avatar verworfen' };
  }

  // 1. Comics & Visual Humor (xkcd, SMBC, PBF, Futility Closet)
  if (meta?.isMeme || meta?.format === 'meme' || clean.includes('xkcd.com') || clean.includes('smbc-comics.com')) {
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
    objectPosition: 'top center', // Ensures faces and foreheads are ALWAYS in frame, cutting podium/table if necessary
    recommendedAspectRatio: 16 / 9,
    reason: 'Redaktionelles Pressefoto: 16:9 Master mit Kopfraum-Priorität'
  };
}
