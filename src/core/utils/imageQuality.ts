/**
 * Image Quality Optimization & Upscaling Utility
 * Automatically transforms image URLs from Unsplash, iTunes, YouTube, Wikimedia,
 * and news outlets to serve crisp, high-resolution assets on retina displays.
 */

export function optimizeImageUrl(url?: string): string | undefined {
  if (!url || typeof url !== 'string') return undefined;

  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed;
  }

  try {
    // 1. Unsplash: Upgrade to high-density 1400px width with 85% quality
    if (trimmed.includes('images.unsplash.com')) {
      const u = new URL(trimmed);
      u.searchParams.set('auto', 'format');
      u.searchParams.set('fit', 'crop');
      u.searchParams.set('w', '1400');
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

    return trimmed;
  } catch {
    return trimmed;
  }
}
