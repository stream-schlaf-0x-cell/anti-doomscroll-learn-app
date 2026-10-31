#!/usr/bin/env node
/**
 * Deterministic generator for Option A Atmen App Icons (iOS/iPadOS Home Screen & PWA).
 * Design: Deep dark cosmos background (#0A0E1A to #111827 radial gradient) with a soft
 * indigo/cyan aura and a crisp, centered luminous `^` Atmen chevron.
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

// CRC32 implementation for PNG chunks
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth 8
  ihdr[9] = 6; // color type 6 (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const rawScanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    rawScanlines[rowStart] = 0; // filter type 0 (None)
    rgbaBuffer.copy(rawScanlines, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(rawScanlines, { level: 9 });
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', iend)
  ]);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - ax, py - ay);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - bx, py - by);
  const b = c1 / c2;
  const projX = ax + b * vx;
  const projY = ay + b * vy;
  return Math.hypot(px - projX, py - projY);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function renderAtmenIconRGBA(size) {
  const buf = Buffer.alloc(size * size * 4);

  // Normalized coordinates for the `^` Atmen chevron
  const apexX = 0.5;
  const apexY = 0.305;
  const leftX = 0.255;
  const leftY = 0.635;
  const rightX = 0.745;
  const rightY = 0.635;
  const strokeRadius = 0.052;
  const aaWidth = 1.35 / size;

  for (let y = 0; y < size; y++) {
    const ny = (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const nx = (x + 0.5) / size;

      // 1. Deep cosmos radial gradient (#111827 center -> #0A0E1A outer)
      const dx = nx - 0.5;
      const dy = ny - 0.48;
      const radialDist = Math.hypot(dx, dy) / 0.72;
      const bgT = clamp(radialDist, 0, 1);

      let r = 17 * (1 - bgT) + 10 * bgT;
      let g = 24 * (1 - bgT) + 14 * bgT;
      let b = 39 * (1 - bgT) + 26 * bgT;

      // 2. Soft indigo + cyan cosmos aura around the center
      const auraIndigo = Math.exp(-((dx * dx + (ny - 0.46) * (ny - 0.46)) / 0.075));
      const auraCyan = Math.exp(-((dx * dx + (ny - 0.38) * (ny - 0.38)) / 0.032));
      r += auraIndigo * 38 + auraCyan * 24;
      g += auraIndigo * 42 + auraCyan * 68;
      b += auraIndigo * 95 + auraCyan * 98;

      // 3. Subtle concentric halo ring
      const ringDist = Math.abs(Math.hypot(dx, ny - 0.5) - 0.39);
      const ringAlpha = (1 - smoothstep(0.0, 0.009 + aaWidth, ringDist)) * 0.22;
      r = r * (1 - ringAlpha) + 129 * ringAlpha;
      g = g * (1 - ringAlpha) + 140 * ringAlpha;
      b = b * (1 - ringAlpha) + 248 * ringAlpha;

      // 4. Distance to the `^` Atmen chevron segments
      const dLeft = distToSegment(nx, ny, leftX, leftY, apexX, apexY);
      const dRight = distToSegment(nx, ny, rightX, rightY, apexX, apexY);
      const dChevron = Math.min(dLeft, dRight);

      // Soft outer glow around the chevron
      const chevronGlow = Math.exp(-Math.max(0, dChevron - strokeRadius * 0.6) * 24) * 0.48;
      r = r * (1 - chevronGlow) + 99 * chevronGlow;
      g = g * (1 - chevronGlow) + 179 * chevronGlow;
      b = b * (1 - chevronGlow) + 255 * chevronGlow;

      // Crisp anti-aliased chevron core (#F8FAFC -> #E0F2FE vertical luminosity)
      const coreAlpha = 1 - smoothstep(strokeRadius - aaWidth, strokeRadius + aaWidth, dChevron);
      if (coreAlpha > 0) {
        const vertGrad = clamp((ny - apexY) / (leftY - apexY), 0, 1);
        const cr = 252 * (1 - vertGrad * 0.08) + 186 * (vertGrad * 0.08);
        const cg = 253 * (1 - vertGrad * 0.04) + 230 * (vertGrad * 0.04);
        const cb = 255;
        r = r * (1 - coreAlpha) + cr * coreAlpha;
        g = g * (1 - coreAlpha) + cg * coreAlpha;
        b = b * (1 - coreAlpha) + cb * coreAlpha;
      }

      // 5. Subtle breathing focal point below the chevron apex
      const dDot = Math.hypot(nx - 0.5, ny - 0.69);
      const dotRadius = 0.024;
      const dotGlow = Math.exp(-Math.max(0, dDot - dotRadius * 0.5) * 38) * 0.35;
      r = r * (1 - dotGlow) + 56 * dotGlow;
      g = g * (1 - dotGlow) + 189 * dotGlow;
      b = b * (1 - dotGlow) + 248 * dotGlow;

      const dotAlpha = (1 - smoothstep(dotRadius - aaWidth, dotRadius + aaWidth, dDot)) * 0.88;
      if (dotAlpha > 0) {
        r = r * (1 - dotAlpha) + 165 * dotAlpha;
        g = g * (1 - dotAlpha) + 243 * dotAlpha;
        b = b * (1 - dotAlpha) + 252 * dotAlpha;
      }

      const idx = (y * size + x) * 4;
      buf[idx] = clamp(Math.round(r), 0, 255);
      buf[idx + 1] = clamp(Math.round(g), 0, 255);
      buf[idx + 2] = clamp(Math.round(b), 0, 255);
      buf[idx + 3] = 255;
    }
  }

  return buf;
}

function generateSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="cosmos" cx="50%" cy="46%" r="72%">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="45%" stop-color="#111827" />
      <stop offset="100%" stop-color="#0A0E1A" />
    </radialGradient>
    <radialGradient id="aura" cx="50%" cy="44%" r="42%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.34" />
      <stop offset="55%" stop-color="#6366F1" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#0A0E1A" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="chevronGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#BAE6FD" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#cosmos)" />
  <circle cx="256" cy="236" r="215" fill="url(#aura)" />
  <circle cx="256" cy="256" r="198" fill="none" stroke="#818CF8" stroke-opacity="0.22" stroke-width="3.5" />
  <path d="M 131 325 L 256 156 L 381 325" fill="none" stroke="url(#chevronGrad)" stroke-width="52" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="256" cy="353" r="12" fill="#A5F3FC" fill-opacity="0.88" />
</svg>
`;
}

function main() {
  const publicDir = path.resolve(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const targets = [
    { filename: 'apple-touch-icon.png', size: 180 },
    { filename: 'icon-192.png', size: 192 },
    { filename: 'icon-512.png', size: 512 },
    { filename: 'favicon.png', size: 64 }
  ];

  for (const target of targets) {
    const rgba = renderAtmenIconRGBA(target.size);
    const png = encodePNG(target.size, target.size, rgba);
    const outPath = path.join(publicDir, target.filename);
    fs.writeFileSync(outPath, png);
    console.log(`[generate-app-icons] Wrote ${target.filename} (${target.size}x${target.size}, ${png.length} bytes)`);
  }

  const svgPath = path.join(publicDir, 'icon.svg');
  fs.writeFileSync(svgPath, generateSVG(), 'utf8');
  console.log(`[generate-app-icons] Wrote icon.svg`);

  const assetsDir = path.resolve(__dirname, '../assets');
  if (fs.existsSync(assetsDir)) {
    fs.copyFileSync(path.join(publicDir, 'icon-512.png'), path.join(assetsDir, 'icon.png'));
    fs.copyFileSync(path.join(publicDir, 'favicon.png'), path.join(assetsDir, 'favicon.png'));
    console.log(`[generate-app-icons] Synced assets/icon.png and assets/favicon.png`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { renderAtmenIconRGBA, encodePNG, generateSVG };
