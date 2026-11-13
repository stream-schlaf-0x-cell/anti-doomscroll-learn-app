import {
  FeedItem,
  TopicTag,
  HivemindCardArchetype,
  HivemindEscalationStage,
  HivemindSimulatedReply
} from '../domain/types';
import { AtemStorage, appStorage } from '../data/storage';
import {
  AiCredentials,
  callAiModel,
  hasAiConfiguration,
  loadAiCredentials
} from '../ai/atmenAiClient';
import {
  defaultUsageLedger,
  getEffectiveBudgetCeilingEur
} from '../enrichment/ledger';

export const HIVEMIND_TRACKS_STORAGE_KEY = '@atem:hivemind_tracks:v1';
export const DELETED_HIVEMIND_TRACK_IDS_KEY = '@atem:deleted_hivemind_tracks:v1';

export interface HivemindChapterSpec {
  chapterIndex: number;
  title: string;
  focusPromptOrChunk: string;
  isGenerated: boolean;
}

export interface HivemindLearningTrack {
  id: string;
  title: string;
  subtitle: string;
  iconEmoji: string;
  sourceType: 'topic' | 'book' | 'pdf_document' | 'url';
  sourceLabel: string;
  createdAt: string;
  updatedAt: string;
  mixIntoMainFeed: boolean; // Mode 2 toggle (Ambient Drip in main stream)
  completedItemIds: string[]; // Tracks which cards the user has read/solved
  totalItemsCount: number;
  progressPercent: number; // 0 to 100
  items: FeedItem[];
  chapters?: HivemindChapterSpec[];
  currentChapterIndex?: number;
  usedAi?: boolean;
  fallbackReason?: string;
}

export interface GenerateHivemindTrackOptions {
  titleOrTopic: string;
  sourceType?: 'topic' | 'book' | 'pdf_document' | 'url';
  sourceLabel?: string;
  rawDocumentText?: string;
  rawText?: string;
  sourceUrl?: string;
  targetCardCount?: number; // 12 to 16
  cardCount?: number;
  mixIntoMainFeed?: boolean;
  credentials?: AiCredentials;
  storage?: AtemStorage;
  skipNetworkFetch?: boolean;
  onProgress?: (percent: number, stageLabel: string) => void;
}

// ---------------------------------------------------------------------------
// Topic & Emoji Inference
// ---------------------------------------------------------------------------

export function inferTrackTopicAndEmoji(titleOrText: string): { topic: TopicTag; emoji: string } {
  const lower = (titleOrText || '').toLowerCase();
  if (/\b(quant|physik|kosmos|relativität|biolog|evolution|wissenschaft|chemie|klima|geolog|astronomie)\b/.test(lower)) {
    return { topic: 'science_synthesis' as any in {} ? 'science_society' : 'science_society', emoji: '⚛️' };
  }
  if (/\b(rom|römisch|marius|caesar|augustus|geschichte|antike|mittelalter|imperium|republik)\b/.test(lower)) {
    return { topic: 'science_society', emoji: '🏛️' };
  }
  if (/\b(kant|platon|sokrates|aristoteles|nietzsche|hegel|ethik|moral|erkenntnis|philosoph|wittgenstein|freiheit)\b/.test(lower)) {
    return { topic: 'philosophy_ethics', emoji: '🦉' };
  }
  if (/\b(didaktik|unterricht|schule|lernen|deutschunterricht|pädagogik|lehrer|bildung|erec|faust|kafka|goethe|literatur)\b/.test(lower)) {
    return { topic: 'german_didactics', emoji: '📚' };
  }
  if (/\b(ki|ai|llm|agent|apple|transformer|algorithmus|informatik|code|software|maschine)\b/.test(lower)) {
    return { topic: 'ai_apple', emoji: '🤖' };
  }
  if (/\b(achtsamkeit|meditation|buddh|geist|atem|bewusstsein|kontemplation|zen)\b/.test(lower)) {
    return { topic: 'contemplation_mind', emoji: '🧘' };
  }
  if (/\b(klang|musik|synth|ableton|modular|frequenz|audio|komposition|sound)\b/.test(lower)) {
    return { topic: 'sound_synthesis', emoji: '🎛️' };
  }
  if (/\b(schlaf|neuro|dopamin|fokus|gesundheit|longevity|stoffwechsel)\b/.test(lower)) {
    return { topic: 'health_biohacking', emoji: '🧬' };
  }
  if (/\b(kunst|ästhetik|malerei|architektur|design|museum|fotografie)\b/.test(lower)) {
    return { topic: 'art_aesthetics', emoji: '🎨' };
  }
  return { topic: 'book_mastery', emoji: '🧠' };
}

// ---------------------------------------------------------------------------
// Zero-Crash Client-Side PDF / Text / Book Extractor
// ---------------------------------------------------------------------------

function decodePdfLiteralEscapes(raw: string): string {
  return raw
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_m, oct) => {
      const code = parseInt(oct, 8);
      return code >= 32 && code <= 255 ? String.fromCharCode(code) : ' ';
    });
}

function decodePdfHexString(hex: string): string {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
  if (!clean) return '';
  // Check UTF-16BE BOM (FEFF)
  if (clean.toUpperCase().startsWith('FEFF') && clean.length >= 8) {
    let out = '';
    for (let i = 4; i + 3 < clean.length; i += 4) {
      const code = parseInt(clean.slice(i, i + 4), 16);
      if (code >= 32) out += String.fromCharCode(code);
    }
    return out;
  }
  let out = '';
  for (let i = 0; i + 1 < clean.length; i += 2) {
    const code = parseInt(clean.slice(i, i + 2), 16);
    if (code >= 32 && code <= 255) {
      out += String.fromCharCode(code);
    }
  }
  return out;
}

function bytesToLatin1(bytes: Uint8Array, maxBytes = 12_000_000): string {
  const len = Math.min(bytes.length, maxBytes);
  let out = '';
  // Process in 16KB chunks to avoid slow character concatenation and argument overflow
  for (let i = 0; i < len; i += 16384) {
    const end = Math.min(len, i + 16384);
    out += String.fromCharCode(...bytes.subarray(i, end));
  }
  return out;
}

function decodeHexToCodePoints(hex: string): string {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
  if (!clean) return '';
  if (clean.length === 4 || (clean.length % 4 === 0 && clean.length >= 4)) {
    let out = '';
    for (let i = 0; i + 3 < clean.length; i += 4) {
      const cp = parseInt(clean.slice(i, i + 4), 16);
      if (cp >= 32) out += String.fromCodePoint(cp);
    }
    return out;
  }
  const val = parseInt(clean, 16);
  return val >= 32 ? String.fromCodePoint(val) : '';
}

function buildToUnicodeCMap(streamsText: string): Map<string, string> {
  const map = new Map<string, string>();
  const bfCharRegex = /beginbfchar([\s\S]*?)endbfchar/g;
  let m: RegExpExecArray | null;
  while ((m = bfCharRegex.exec(streamsText)) !== null) {
    const pairRegex = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let p: RegExpExecArray | null;
    while ((p = pairRegex.exec(m[1])) !== null) {
      const unicode = decodeHexToCodePoints(p[2]);
      if (unicode) map.set(p[1].toUpperCase(), unicode);
    }
  }
  const bfRangeRegex = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = bfRangeRegex.exec(streamsText)) !== null) {
    const rangeRegex = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let r: RegExpExecArray | null;
    while ((r = rangeRegex.exec(m[1])) !== null) {
      const start = parseInt(r[1], 16);
      const end = parseInt(r[2], 16);
      let dst = parseInt(r[3], 16);
      const width = r[1].length;
      if (end >= start && end - start <= 256) {
        for (let code = start; code <= end; code++) {
          const hexKey = code.toString(16).toUpperCase().padStart(width, '0');
          if (dst >= 32) map.set(hexKey, String.fromCodePoint(dst));
          dst++;
        }
      }
    }
  }
  return map;
}

function decodePdfHexWithCMap(hex: string, cmap?: Map<string, string>): string {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
  if (!clean) return '';
  if (cmap && cmap.size > 0) {
    if (clean.length >= 4 && clean.length % 4 === 0) {
      let out = '';
      let matched = 0;
      for (let i = 0; i + 3 < clean.length; i += 4) {
        const key4 = clean.slice(i, i + 4).toUpperCase();
        const mapped = cmap.get(key4);
        if (mapped) {
          out += mapped;
          matched++;
        }
      }
      if (matched > 0) return out;
    }
    if (clean.length % 2 === 0) {
      let out = '';
      let matched = 0;
      for (let i = 0; i + 1 < clean.length; i += 2) {
        const key2 = clean.slice(i, i + 2).toUpperCase();
        const mapped = cmap.get(key2);
        if (mapped) {
          out += mapped;
          matched++;
        }
      }
      if (matched > 0) return out;
    }
  }
  return decodePdfHexString(clean);
}

async function runDecompressionStream(
  compressed: Uint8Array,
  format: 'deflate' | 'deflate-raw'
): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined' || typeof Response === 'undefined') {
    return null;
  }
  try {
    const ds = new DecompressionStream(format);
    const readPromise = new Response(ds.readable).arrayBuffer();
    const writer = ds.writable.getWriter();
    const copy = compressed.slice();
    await writer.write(copy);
    await writer.close();
    const buf = await readPromise;
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

async function extractFlateDecodePdfText(bytes: Uint8Array): Promise<{
  text: string;
  sawCompressedStreams: boolean;
}> {
  const rawLatin1 = bytesToLatin1(bytes);
  const decompressedParts: string[] = [];
  let sawCompressedStreams = false;

  const streamHeaderRegex = /stream(?:\r\n|\n|\r)/g;
  let streamMatch: RegExpExecArray | null;
  while ((streamMatch = streamHeaderRegex.exec(rawLatin1)) !== null) {
    const dataStart = streamMatch.index + streamMatch[0].length;
    const endIdx = rawLatin1.indexOf('endstream', dataStart);
    if (endIdx < 0 || endIdx <= dataStart) continue;

    // Trim single trailing CR/LF before endstream per PDF spec
    let dataEnd = endIdx;
    if (dataEnd > dataStart && rawLatin1[dataEnd - 1] === '\n') dataEnd--;
    if (dataEnd > dataStart && rawLatin1[dataEnd - 1] === '\r') dataEnd--;
    if (dataEnd - dataStart <= 2 || dataEnd - dataStart > 4_000_000) continue;

    const dictWindow = rawLatin1.slice(Math.max(0, streamMatch.index - 400), streamMatch.index);
    const hasFlateFilter = /\/FlateDecode\b/.test(dictWindow);
    const firstByte = bytes[dataStart];
    const secondByte = bytes[dataStart + 1];
    const looksLikeZlib = firstByte === 0x78 && (secondByte === 0x01 || secondByte === 0x5e || secondByte === 0x9c || secondByte === 0xda);

    if (!hasFlateFilter && !looksLikeZlib) continue;
    sawCompressedStreams = true;

    const slice = bytes.subarray(dataStart, dataEnd);
    const inflated =
      (await runDecompressionStream(slice, 'deflate')) ||
      (await runDecompressionStream(slice, 'deflate-raw'));

    if (inflated && inflated.length > 0) {
      const decoded = bytesToLatin1(inflated, 2_000_000);
      if (/\bBT\b/.test(decoded) || /beginbfchar|beginbfrange/.test(decoded) || /[A-Za-z0-9]{4,}/.test(decoded)) {
        decompressedParts.push(decoded);
      }
    }
  }

  const combinedCorpus = [rawLatin1, ...decompressedParts].join('\n');
  const cmap = decompressedParts.length > 0 ? buildToUnicodeCMap(decompressedParts.join('\n')) : undefined;
  const parsed = parsePdfBufferTextFallback(combinedCorpus, cmap);
  return {
    text: parsed,
    sawCompressedStreams
  };
}

/**
 * Pure TypeScript PDF text-operator parser fallback:
 * Extracts readable text from PDF `BT ... ET` blocks, `(literal) Tj`, `[(...) ...] TJ`,
 * hex strings (with optional ToUnicode CMap), and readable text runs without any native binary dependency.
 */
export function parsePdfBufferTextFallback(
  input: string | Uint8Array | ArrayBuffer,
  cmap?: Map<string, string>
): string {
  let rawLatin1 = '';
  if (typeof input === 'string') {
    rawLatin1 = input;
  } else {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    rawLatin1 = bytesToLatin1(bytes);
  }
  const chunks: string[] = [];

  // 1. Parse BT ... ET text object blocks
  const btEtRegex = /BT\b([\s\S]*?)\bET/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = btEtRegex.exec(rawLatin1)) !== null) {
    const block = blockMatch[1];
    const lineParts: string[] = [];

    // Match TJ arrays: [(Hello) -20 (World)] TJ
    const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
    let arrMatch: RegExpExecArray | null;
    while ((arrMatch = tjArrayRegex.exec(block)) !== null) {
      const inner = arrMatch[1];
      const tokenRegex = /\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>/g;
      let tok: RegExpExecArray | null;
      let wordBuf = '';
      while ((tok = tokenRegex.exec(inner)) !== null) {
        const t = tok[0];
        if (t.startsWith('(') && t.endsWith(')')) {
          wordBuf += decodePdfLiteralEscapes(t.slice(1, -1));
        } else if (t.startsWith('<') && t.endsWith('>')) {
          wordBuf += decodePdfHexWithCMap(t.slice(1, -1), cmap);
        }
      }
      if (wordBuf.trim()) lineParts.push(wordBuf.trim());
    }

    // Match single (text) Tj or ' or "
    const singleTjRegex = /\(((?:\\.|[^\\)])*)\)\s*(?:Tj|'|")/g;
    let singleMatch: RegExpExecArray | null;
    while ((singleMatch = singleTjRegex.exec(block)) !== null) {
      const decoded = decodePdfLiteralEscapes(singleMatch[1]).trim();
      if (decoded) lineParts.push(decoded);
    }

    // Match single <hex> Tj
    const singleHexTjRegex = /<([0-9A-Fa-f\s]+)>\s*(?:Tj|'|")/g;
    let hexMatch: RegExpExecArray | null;
    while ((hexMatch = singleHexTjRegex.exec(block)) !== null) {
      const decoded = decodePdfHexWithCMap(hexMatch[1], cmap).trim();
      if (decoded) lineParts.push(decoded);
    }

    if (lineParts.length > 0) {
      chunks.push(lineParts.join(' '));
    }
  }

  // 2. If no BT..ET markers were matched, scan all parenthesized text literals `( ... )`
  if (chunks.join(' ').trim().length < 60) {
    const literalRegex = /\(((?:\\.|[^\\()\r\n]){4,240})\)/g;
    let litMatch: RegExpExecArray | null;
    while ((litMatch = literalRegex.exec(rawLatin1)) !== null) {
      const candidate = decodePdfLiteralEscapes(litMatch[1]).trim();
      // Filter out PDF metadata noise (e.g. /Type /Font /Page /Filter)
      if (
        candidate.length >= 4 &&
        /[a-zA-ZäöüÄÖÜß]{3,}/.test(candidate) &&
        !/^(Identity-H|Adobe|MacRomanEncoding|WinAnsiEncoding|PDF|FlateDecode)$/i.test(candidate)
      ) {
        chunks.push(candidate);
      }
    }
  }

  return chunks
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extracts clean text from an uploaded `.pdf`, `.txt`, `.md`, `.json`, or raw buffer/string.
 */
export async function extractTextFromUploadedFile(
  input: ArrayBuffer | Uint8Array | string | { text?: () => Promise<string>; arrayBuffer?: () => Promise<ArrayBuffer>; name?: string },
  fileName?: string
): Promise<string> {
  if (!input) return '';

  const lowerName = (fileName || (typeof input === 'object' && 'name' in input && input.name ? input.name : '')).toLowerCase();

  // Case 1: String input
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('%PDF-')) {
      return parsePdfBufferTextFallback(trimmed);
    }
    return trimmed;
  }

  // Case 2: Browser File / Blob-like object
  if (typeof input === 'object' && !(input instanceof ArrayBuffer) && !(input instanceof Uint8Array)) {
    if (lowerName.endsWith('.pdf') && typeof input.arrayBuffer === 'function') {
      const buf = await input.arrayBuffer();
      return extractTextFromUploadedFile(buf, lowerName);
    }
    if (typeof input.text === 'function') {
      const rawText = await input.text();
      if (rawText.trim().startsWith('%PDF-')) {
        return parsePdfBufferTextFallback(rawText);
      }
      return rawText.trim();
    }
    if (typeof input.arrayBuffer === 'function') {
      const buf = await input.arrayBuffer();
      return extractTextFromUploadedFile(buf, lowerName);
    }
  }

  // Case 3: ArrayBuffer or Uint8Array
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input as ArrayBuffer);

  // Check if PDF magic header `%PDF-` is present
  const headerAscii = String.fromCharCode(...bytes.slice(0, Math.min(8, bytes.length)));
  const isPdf = headerAscii.startsWith('%PDF-') || lowerName.endsWith('.pdf');

  if (isPdf) {
    // Optional Web PDF.js CDN support if loaded in window
    if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
      try {
        const pdfjsLib = (window as any).pdfjsLib;
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        const pageTexts: string[] = [];
        const maxPages = Math.min(pdf.numPages || 1, 40);
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const content = await page.getTextContent();
          const strings = (content.items || []).map((it: any) => it.str || '').join(' ');
          if (strings.trim()) pageTexts.push(strings.trim());
        }
        const combined = pageTexts.join('\n\n').trim();
        if (combined.length >= 60) {
          return combined;
        }
      } catch {
        // Fall through to pure TS PDF stream parser
      }
    }

    // Pure TypeScript PDF parser + FlateDecode stream decompression
    const extractedFlate = await extractFlateDecodePdfText(bytes);
    if (extractedFlate.text.length >= 40) return extractedFlate.text;

    const rawParsed = parsePdfBufferTextFallback(bytes);
    if (rawParsed.length >= 40) return rawParsed;

    if (extractedFlate.text.length > 0) return extractedFlate.text;
    if (rawParsed.length > 0) return rawParsed;

    throw new Error(
      extractedFlate.sawCompressedStreams
        ? 'Aus diesem PDF konnte kein auslesbarer Text extrahiert werden (vermutlich ein gescanntes Bild-PDF ohne Textebene oder geschützte Schriftkodierung). Bitte füge den Text manuell unten ein.'
        : 'Dieses PDF enthält keinen auslesbaren Text. Bitte kopiere den gewünschten Abschnitt direkt in das Textfeld.'
    );
  }

  // Plain UTF-8 text decode
  try {
    const decoded = new TextDecoder('utf-8').decode(bytes).trim();
    if (decoded.startsWith('%PDF-')) {
      return parsePdfBufferTextFallback(decoded);
    }
    return decoded;
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Helper to Build a Valid FeedItem Card for a Hivemind Track
// ---------------------------------------------------------------------------

interface HivemindCardBlueprint {
  title: string;
  subtitle: string;
  feedText: string;
  body: string;
  keyInsight: string;
  cardArchetype: HivemindCardArchetype;
  escalationStages?: HivemindEscalationStage[];
  simulatedReplies?: HivemindSimulatedReply[];
  quiz?: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

function buildHivemindFeedItem(params: {
  trackId: string;
  trackTitle: string;
  stepIndex: number;
  totalSteps: number;
  topic: TopicTag;
  sourceLabel: string;
  sourceUrl?: string;
  blueprint: HivemindCardBlueprint;
  aiAssisted: boolean;
}): FeedItem {
  const {
    trackId,
    trackTitle,
    stepIndex,
    totalSteps,
    topic,
    sourceLabel,
    sourceUrl,
    blueprint,
    aiAssisted
  } = params;

  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const itemId = `hivemind-${trackId}-step-${stepIndex}`;

  const archetypeBadgeLabel: Record<HivemindCardArchetype, string> = {
    story_thread: 'Erkenntnis-Thread',
    expanding_brain_meme: '4-Stufen Konzept-Meme',
    contrast_meme: 'Kontrast-Modell',
    discourse_replies: 'Diskurs & Einwände',
    milestone_quiz: 'Meilenstein-Quiz'
  };

  const fullBody = blueprint.body && blueprint.body.trim().length >= 140
    ? blueprint.body.trim()
    : `${blueprint.feedText}\n\n### Vertiefende Einordnung (${trackTitle} · Schritt ${stepIndex}/${totalSteps})\n\n${blueprint.keyInsight}`;

  return {
    id: itemId,
    type: blueprint.cardArchetype === 'milestone_quiz' ? 'quick_insight' : 'deep_dive',
    format: blueprint.cardArchetype === 'expanding_brain_meme' ? 'meme' : 'concise_insight',
    title: blueprint.title,
    subtitle: blueprint.subtitle || `${trackTitle} · Schritt ${stepIndex} von ${totalSteps}`,
    feedText: blueprint.feedText,
    body: fullBody,
    articleBody: fullBody,
    topics: [topic],
    primaryTopic: topic,
    sourceReferences: [
      {
        publisher: sourceLabel || 'Atmen Hivemind Lernpfad',
        originalUrl: sourceUrl && sourceUrl.startsWith('http')
          ? sourceUrl
          : `https://de.wikipedia.org/wiki/Spezial:Suche/${encodeURIComponent(trackTitle)}`,
        title: `${trackTitle} — Schritt ${stepIndex}/${totalSteps}: ${blueprint.title}`,
        publicationTimestamp: nowIso,
        retrievalTimestamp: nowIso,
        author: sourceLabel || 'Hivemind Curriculum',
        isVerified: true
      }
    ],
    publishedAt: nowIso,
    generatedAt: nowIso,
    estimatedReadingMinutes: Math.max(1, Math.ceil(fullBody.split(/\s+/).length / 160)),
    relevanceExplanation: `Teil deines aktiven Lernpfads „${trackTitle}“ (Schritt ${stepIndex} von ${totalSteps}).`,
    contentStatus: 'editorial_briefing',
    isDailyEdition: false,
    editionDate: today,
    isDemonstration: false,
    aiAssisted,
    factReviewStatus: 'pedagogical_concept',
    provenanceSummary: `🧠 Lernpfad: ${trackTitle} · Schritt ${stepIndex}/${totalSteps}`,
    wordCount: Math.max(40, fullBody.split(/\s+/).length),
    evidenceTier: 'multiple_sources',
    contentOrigin: aiAssisted ? 'enriched_ai' : 'live_ingested',
    contentHash: itemId,
    canonicalUrl: sourceUrl && sourceUrl.startsWith('http')
      ? `${sourceUrl}#step-${stepIndex}`
      : `https://de.wikipedia.org/wiki/Spezial:Suche/${encodeURIComponent(trackTitle)}?step=${stepIndex}`,
    space: `c/hivemind`,
    flair: `${archetypeBadgeLabel[blueprint.cardArchetype]} · ${stepIndex}/${totalSteps}`,
    keyInsight: blueprint.keyInsight,
    quiz: blueprint.quiz
      ? {
          id: `quiz-${itemId}`,
          question: blueprint.quiz.question,
          options: blueprint.quiz.options.slice(0, 4),
          correctIndex: Math.min(Math.max(0, blueprint.quiz.correctIndex), blueprint.quiz.options.length - 1),
          explanation: blueprint.quiz.explanation,
          sourceArticleId: itemId,
          sourceArticleTitle: blueprint.title
        }
      : undefined,
    hivemindMeta: {
      trackId,
      trackTitle,
      stepIndex,
      totalSteps,
      cardArchetype: blueprint.cardArchetype,
      escalationStages: blueprint.escalationStages,
      simulatedReplies: blueprint.simulatedReplies
    },
    memeMeta: blueprint.cardArchetype === 'expanding_brain_meme' && blueprint.escalationStages
      ? {
          templateName: '4-Stufen Konzept-Eskalation',
          punchline: blueprint.escalationStages[blueprint.escalationStages.length - 1]?.caption || blueprint.keyInsight,
          satireContext: `Konzept-Progression · ${trackTitle}`,
          trackId,
          stepIndex,
          totalSteps,
          cardArchetype: blueprint.cardArchetype,
          escalationStages: blueprint.escalationStages,
          simulatedReplies: blueprint.simulatedReplies
        }
      : undefined,
    upvotesCount: 18 + (stepIndex * 3),
    awardsCount: { gold: 0, brain: 1, spark: 1 },
    sourceTrustLevel: 'verified_creator',
    sourceBroadcasterName: `Lernpfad: ${trackTitle}`,
    publicationDateReliable: true,
    isTeachingRelated: true,
    isChallengingPerspective: blueprint.cardArchetype === 'discourse_replies',
    comments: []
  };
}

// ---------------------------------------------------------------------------
// Pre-Seeded Showcase Starter Tracks (Ready with 1 Tap at 0% Progress)
// ---------------------------------------------------------------------------

export const SHOWCASE_STARTER_TRACK_IDS = new Set<string>([
  'track-roman-republic-empire',
  'track-quantum-reality'
]);

/**
 * Shared detector for removed showcase starter tracks ("Aufstieg & Fall Roms", "Quantenphysik").
 * Used across migration, storage repositories, cloud sync and feed filtering.
 */
export function isDeprecatedShowcaseStarterItem(raw: Partial<FeedItem> | null | undefined): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const trackId = raw.hivemindMeta?.trackId || raw.memeMeta?.trackId;
  const idStr = String(raw.id || '').toLowerCase();
  const titleStr = String(raw.title || '').toLowerCase();
  return Boolean(
    (trackId && SHOWCASE_STARTER_TRACK_IDS.has(trackId)) ||
      idStr.startsWith('hivemind-track-roman') ||
      idStr.startsWith('hivemind-track-quantum') ||
      idStr.startsWith('track-roman-') ||
      idStr.startsWith('track-quantum-') ||
      titleStr.includes('aufstieg & fall roms') ||
      titleStr.includes('paradox der römischen republik')
  );
}

export function buildShowcaseStarterTracks(): HivemindLearningTrack[] {
  return [];
}

// ---------------------------------------------------------------------------
// Deterministic & Live AI Learning Track Generator
// ---------------------------------------------------------------------------

async function fetchWikipediaContextForTopic(topicTitle: string, skipNetwork?: boolean): Promise<{ extract: string; url?: string }> {
  if (skipNetwork) return { extract: '' };
  try {
    const cleanQuery = topicTitle.replace(/^(c\/|buch:|thema:|pdf:)/i, '').trim();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2800);
    const searchUrl = `https://de.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&utf8=&format=json&origin=*&srlimit=2`;
    const res = await fetch(searchUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { extract: '' };
    const data = await res.json();
    const firstHit = data?.query?.search?.[0];
    if (!firstHit?.title) return { extract: '' };

    const sumController = new AbortController();
    const sumTimer = setTimeout(() => sumController.abort(), 2500);
    const sumRes = await fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstHit.title)}`, {
      signal: sumController.signal
    });
    clearTimeout(sumTimer);
    if (!sumRes.ok) return { extract: '' };
    const summary = await sumRes.json();
    return {
      extract: typeof summary?.extract === 'string' ? summary.extract.trim() : '',
      url: summary?.content_urls?.desktop?.page
    };
  } catch {
    return { extract: '' };
  }
}

function splitTextIntoMeaningfulSegments(rawText: string, targetSegments: number): string[] {
  const cleaned = rawText
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  if (!cleaned) return [];

  // Split by paragraphs or sentences
  const rawParagraphs = cleaned
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZÄÖÜ])/)
    .map(p => p.trim())
    .filter(p => p.length >= 35);

  if (rawParagraphs.length === 0) {
    return [cleaned];
  }

  const segments: string[] = [];
  const chunkSize = Math.max(1, Math.ceil(rawParagraphs.length / targetSegments));
  for (let i = 0; i < rawParagraphs.length; i += chunkSize) {
    const chunk = rawParagraphs.slice(i, i + chunkSize).join('\n\n').trim();
    if (chunk) segments.push(chunk);
  }

  return segments;
}

function buildDeterministicBlueprintsFromSubject(
  title: string,
  rawContextText: string,
  targetCount: number = 12
): HivemindCardBlueprint[] {
  const count = Math.max(10, Math.min(16, targetCount));
  const segments = splitTextIntoMeaningfulSegments(rawContextText, count);

  const stageThemes = [
    { aspect: 'Ausgangspunkt & Kernfrage', focus: 'Was ist das grundlegende Problem oder Phänomen hinter diesem Thema?' },
    { aspect: 'Konzeptuelle Eskalation', focus: 'Die 4 Entwicklungsstufen vom Oberflächenwissen zur Systemtiefe' },
    { aspect: 'Kontext & kritische Gegenrede', focus: 'Welche Einwände, blinden Flecken und Transferbeispiele sind entscheidend?' },
    { aspect: 'Erster Wissens-Meilenstein', focus: 'Sicherung der Grundbegriffe und Kausalmechanismen' },
    { aspect: 'Innere Mechanik & Struktur', focus: 'Wie greifen die zentralen Faktoren und Triebkräfte ineinander?' },
    { aspect: 'Paradigmenwechsel im 4-Stufen-Modell', focus: 'Wie sich die Perspektive von der naiven Annahme zur Meisterschaft wandelt' },
    { aspect: 'Spannungsfeld & Kontroverse', focus: 'Wo widersprechen sich klassische Schulen und moderne Analysen?' },
    { aspect: 'Zweiter Wissens-Meilenstein', focus: 'Überprüfung der Struktur- und Systemzusammenhänge' },
    { aspect: 'Wendepunkt & Konsequenzen', focus: 'Welche langfristigen Folgen ergeben sich aus dieser Dynamik?' },
    { aspect: 'Synthese-Progression in 4 Stufen', focus: 'Vom Einzelphänomen zum universellen Denkmodell' },
    { aspect: 'Praxis-Transfer & Anwendung', focus: 'Wie lässt sich diese Erkenntnis konkret im Denken und Handeln verankern?' },
    { aspect: 'Abschluss-Meilenstein & Gesamtsynthese', focus: 'Meisterung des gesamten Lernpfads' }
  ];

  const archetypesCycle: HivemindCardArchetype[] = [
    'story_thread',
    'expanding_brain_meme',
    'discourse_replies',
    'milestone_quiz'
  ];

  const blueprints: HivemindCardBlueprint[] = [];

  for (let i = 0; i < count; i++) {
    const stepNum = i + 1;
    const archetype = archetypesCycle[i % archetypesCycle.length];
    const themeMeta = stageThemes[i % stageThemes.length];
    const segmentText = segments[i % Math.max(1, segments.length)] || '';

    const sentences = segmentText
      ? (segmentText.match(/[^.!?]+[.!?]+/g) || [segmentText]).map(s => s.trim()).filter(Boolean)
      : [];

    const firstSentence = sentences[0] || `Bei „${title}“ steht im Schritt ${stepNum} die systematische Durchdringung von ${themeMeta.aspect} im Zentrum.`;
    const secondSentence = sentences[1] || `Entscheidend ist dabei, nicht bei isolierten Einzeldaten stehenzubleiben, sondern die zugrundeliegende Struktur und Wirkungskette nachzuvollziehen.`;
    const thirdSentence = sentences[2] || `${themeMeta.focus}.`;

    const cardTitle = sentences[0] && sentences[0].length <= 88 && sentences[0].length >= 18
      ? `${stepNum}/${count}: ${sentences[0].replace(/[.!?]+$/, '')}`
      : `${title} (${stepNum}/${count}): ${themeMeta.aspect}`;

    const feedText = segmentText.length >= 140
      ? segmentText.slice(0, 460)
      : `${firstSentence}\n\n${secondSentence} ${thirdSentence}`;

    const fullBody = segmentText.length >= 220
      ? `${segmentText}\n\n### Systematische Einordnung (${themeMeta.aspect})\n\n${secondSentence} ${thirdSentence}`
      : `${firstSentence}\n\n${secondSentence}\n\n${thirdSentence}\n\nIm Gesamtzusammenhang von „${title}“ bildet dieser Baustein (Schritt ${stepNum} von ${count}) das Bindeglied zwischen Ausgangsbeobachtung und vertieftem Systemverständnis.`;

    const keyInsight = sentences.length > 1
      ? sentences[sentences.length - 1]
      : `${title} – ${themeMeta.aspect}: Strukturverständnis schlägt isoliertes Faktenwissen.`;

    if (archetype === 'expanding_brain_meme') {
      blueprints.push({
        cardArchetype: 'expanding_brain_meme',
        title: cardTitle,
        subtitle: `4-Stufen Konzept-Progression · ${title}`,
        feedText,
        body: fullBody,
        keyInsight,
        escalationStages: [
          {
            stageLabel: 'Stufe 1 · Oberflächen-Blick',
            caption: `ISOLIERTE SCHLAGWORTE UND EINZELFAKTEN ZU „${title.toUpperCase()}“ AUSWENDIG LERNEN`,
            visualLevel: 1
          },
          {
            stageLabel: 'Stufe 2 · Ursachen-Verständnis',
            caption: firstSentence.toUpperCase().slice(0, 125),
            visualLevel: 2
          },
          {
            stageLabel: 'Stufe 3 · System-Mechanik',
            caption: secondSentence.toUpperCase().slice(0, 125),
            visualLevel: 3
          },
          {
            stageLabel: 'Stufe 4 · Souveräner Transfer',
            caption: keyInsight.toUpperCase().slice(0, 135),
            visualLevel: 4
          }
        ]
      });
    } else if (archetype === 'discourse_replies') {
      blueprints.push({
        cardArchetype: 'discourse_replies',
        title: cardTitle,
        subtitle: `Diskurs & Perspektiven · ${title}`,
        feedText,
        body: fullBody,
        keyInsight,
        simulatedReplies: [
          {
            handle: 'u/kontext_lupe',
            roleBadge: '🔍 Kontext',
            text: `Hintergrund zu Schritt ${stepNum}: ${firstSentence} Erst im Zusammenspiel mit den vorangehenden Stufen wird die volle Tragweite sichtbar.`,
            upvotes: 34 + stepNum
          },
          {
            handle: 'u/kritischer_fokus',
            roleBadge: '⚡ Einwand',
            text: `Wichtige Differenzierung: Man darf dieses Prinzip nicht schematisch verallgemeinern – die Randbedingungen bestimmen, wann der Effekt kippt.`,
            upvotes: 27 + stepNum
          },
          {
            handle: 'u/praxis_anker',
            roleBadge: '🛠️ Transfer',
            text: `Merksatz für die Praxis: ${keyInsight}`,
            upvotes: 41 + stepNum
          }
        ]
      });
    } else if (archetype === 'milestone_quiz') {
      blueprints.push({
        cardArchetype: 'milestone_quiz',
        title: `Meilenstein-Quiz (${stepNum}/${count}): ${themeMeta.aspect}`,
        subtitle: `Aktiver Wissens-Check zu „${title}“`,
        feedText,
        body: fullBody,
        keyInsight,
        quiz: {
          question: `Welche Kernaussage trifft im Lernpfad „${title}“ auf den Abschnitt „${themeMeta.aspect}“ zu?`,
          options: [
            keyInsight.slice(0, 150),
            `Das Thema lässt sich vollständig ohne Berücksichtigung struktureller Ursachen oder Kontextfaktoren erklären.`,
            `Alle historischen und wissenschaftlichen Quellen widersprechen jeglicher systematischen Gesetzmäßigkeit.`,
            `Es handelt sich um ein rein zufälliges Randphänomen ohne praktische Relevanz.`
          ],
          correctIndex: 0,
          explanation: `Richtig! ${firstSentence} ${keyInsight}`
        }
      });
    } else {
      blueprints.push({
        cardArchetype: 'story_thread',
        title: cardTitle,
        subtitle: `${themeMeta.aspect} · Schritt ${stepNum} von ${count}`,
        feedText,
        body: fullBody,
        keyInsight
      });
    }
  }

  return blueprints;
}

/**
 * Generates a full 12–16 card Hivemind Learning Track from any topic, book title, URL, or uploaded PDF/text.
 */
export async function generateHivemindLearningTrack(
  options: GenerateHivemindTrackOptions
): Promise<HivemindLearningTrack> {
  const cleanTitle = (options.titleOrTopic || '').trim() || 'Wissens-Expedition';
  const docText = options.rawDocumentText ?? options.rawText;
  const sourceType = options.sourceType || (docText ? 'pdf_document' : 'topic');
  const targetCount = Math.max(10, Math.min(16, options.targetCardCount || options.cardCount || 12));
  const { topic, emoji } = inferTrackTopicAndEmoji(`${cleanTitle} ${(docText || '').slice(0, 400)}`);

  options.onProgress?.(15, `Analysiere Material zu „${cleanTitle}“…`);

  let contextText = (docText || '').trim();
  let resolvedUrl = options.sourceUrl;

  if (!contextText && !options.skipNetworkFetch) {
    options.onProgress?.(30, 'Frage Enzyklopädie & Primärquellen ab…');
    const wiki = await fetchWikipediaContextForTopic(cleanTitle, options.skipNetworkFetch);
    if (wiki.extract) {
      contextText = wiki.extract;
      if (!resolvedUrl && wiki.url) resolvedUrl = wiki.url;
    }
  }

  const creds = options.credentials ?? (await loadAiCredentials(options.storage).catch(() => undefined));
  const hasCreds = Boolean(creds && hasAiConfiguration(creds));
  const budgetCeilingEur = getEffectiveBudgetCeilingEur(Boolean(creds?.apiKey?.trim()));
  const canSpend = hasCreds
    ? await defaultUsageLedger.canSpend(0.01, undefined, budgetCeilingEur).catch(() => true)
    : false;
  const canUseAi = hasCreds && canSpend;

  const trackId = `track-${cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'custom'}-${Date.now()}`;
  let blueprints: HivemindCardBlueprint[] = [];
  let usedAi = false;
  let fallbackReason: string | undefined = !hasCreds
    ? 'Kein aktiver KI-Schlüssel konfiguriert (lokaler Lernpfad erstellt).'
    : !canSpend
    ? `Monatliches KI-Budgetlimit (${budgetCeilingEur.toFixed(2)} €) erreicht (lokaler Lernpfad erstellt).`
    : undefined;

  if (canUseAi && creds) {
    options.onProgress?.(55, 'KI strukturiert 12-teiligen Lern-Feed (Story, 4-Stufen-Memes & Quiz)…');
    try {
      const docExcerpt = contextText ? `\n\nQUELLTEXT / DOKUMENT-AUSZUG:\n${contextText.slice(0, 7500)}` : '';
      const prompt = `Du bist der didaktische Chef-Architekt von "Atmen Hivemind — Scroll to Study".
Zerlege das Thema / Buch / Dokument "${cleanTitle}" in genau ${targetCount} aufeinander aufbauende, hochgradig fesselnde Lern-Karten auf Deutsch.
${docExcerpt}

WICHTIGE FORMAT-REGELN:
Wechsle im Rhythmus durch diese 4 Archetypen (cardArchetype):
1. "story_thread": Pointierter, erzählerischer Erklär-Post (3-5 prägnante Sätze in feedText + ausführlicher Hintergrund in body).
2. "expanding_brain_meme": Ein 4-stufiges Konzept-Eskalations-Meme (escalationStages mit exakt 4 Stufen: visualLevel 1, 2, 3, 4), das eine Entwicklung, historische Verschiebung oder Erkenntnis-Steigerung unvergesslich macht.
3. "discourse_replies": Eine scharfe Kernthese mit genau 3 kurzen Community-Antworten in simulatedReplies (🔍 Kontext, ⚡ Einwand, 🛠️ Praxis-Beispiel).
4. "milestone_quiz": Ein Verständnis-Check mit einer präzisen Multiple-Choice-Frage (quiz mit 4 Optionen, correctIndex 0..3 und Erklärung).

Antworte AUSSCHLIESSLICH mit validem JSON:
{
  "subtitle": "Kurzer Untertitel des Lernpfads",
  "cards": [
    {
      "cardArchetype": "story_thread" | "expanding_brain_meme" | "discourse_replies" | "milestone_quiz",
      "title": "Prägnanter Kartentitel",
      "subtitle": "Kurzer Kontext-Untertitel",
      "feedText": "Direkt auf der Karte lesbarer, substanzieller Kerntext (mindestens 160 Zeichen, keine Floskeln!)",
      "body": "Vertiefender Volltext für den Reader (mindestens 280 Zeichen)",
      "keyInsight": "Ein prägnanter Merksatz (1 Satz)",
      "escalationStages": [
        { "stageLabel": "Stufe 1 · ...", "caption": "AUSSAGE 1", "visualLevel": 1 },
        { "stageLabel": "Stufe 2 · ...", "caption": "AUSSAGE 2", "visualLevel": 2 },
        { "stageLabel": "Stufe 3 · ...", "caption": "AUSSAGE 3", "visualLevel": 3 },
        { "stageLabel": "Stufe 4 · ...", "caption": "AUSSAGE 4", "visualLevel": 4 }
      ],
      "simulatedReplies": [
        { "handle": "u/historiker", "roleBadge": "🔍 Kontext", "text": "...", "upvotes": 42 },
        { "handle": "u/kritiker", "roleBadge": "⚡ Einwand", "text": "...", "upvotes": 31 },
        { "handle": "u/praxis", "roleBadge": "🛠️ Transfer", "text": "...", "upvotes": 28 }
      ],
      "quiz": {
        "question": "Frage?",
        "options": ["Richtige Antwort", "Falsch B", "Falsch C", "Falsch D"],
        "correctIndex": 0,
        "explanation": "Warum Option A stimmt."
      }
    }
  ]
}`;

      const aiRes = await callAiModel(prompt, {
        credentials: creds,
        jsonMode: true,
        maxTokens: 4000,
        timeoutMs: 45_000,
        itemId: `hivemind-track-${trackId}`
      });

      const cleanedJson = aiRes.text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleanedJson);
      if (parsed && Array.isArray(parsed.cards) && parsed.cards.length >= 8) {
        blueprints = parsed.cards.slice(0, 16).map((c: any, idx: number): HivemindCardBlueprint => {
          const fallbackArch: HivemindCardArchetype = (['story_thread', 'expanding_brain_meme', 'discourse_replies', 'milestone_quiz'] as const)[idx % 4];
          const arch: HivemindCardArchetype = c.cardArchetype || fallbackArch;
          return {
            cardArchetype: arch,
            title: String(c.title || `${cleanTitle} · Schritt ${idx + 1}`).trim(),
            subtitle: String(c.subtitle || `${cleanTitle} · Schritt ${idx + 1}`).trim(),
            feedText: String(c.feedText || c.body || '').trim(),
            body: String(c.body || c.feedText || '').trim(),
            keyInsight: String(c.keyInsight || c.title || cleanTitle).trim(),
            escalationStages: Array.isArray(c.escalationStages) && c.escalationStages.length >= 3
              ? c.escalationStages.slice(0, 4).map((st: any, sIdx: number) => ({
                  stageLabel: String(st.stageLabel || `Stufe ${sIdx + 1}`),
                  caption: String(st.caption || ''),
                  visualLevel: (Math.min(4, Math.max(1, sIdx + 1)) as 1 | 2 | 3 | 4)
                }))
              : undefined,
            simulatedReplies: Array.isArray(c.simulatedReplies) && c.simulatedReplies.length >= 2
              ? c.simulatedReplies.slice(0, 3).map((rep: any) => ({
                  handle: String(rep.handle || 'u/seminar_salon'),
                  roleBadge: String(rep.roleBadge || '🔍 Impuls'),
                  text: String(rep.text || ''),
                  upvotes: Number(rep.upvotes) || 24
                }))
              : undefined,
            quiz: c.quiz && typeof c.quiz.question === 'string' && Array.isArray(c.quiz.options)
              ? {
                  question: String(c.quiz.question),
                  options: c.quiz.options.map(String),
                  correctIndex: Number(c.quiz.correctIndex) || 0,
                  explanation: String(c.quiz.explanation || '')
                }
              : undefined
          };
        });
        usedAi = true;
        fallbackReason = undefined;
      } else {
        fallbackReason = 'KI-Antwort war unvollständig; strukturiertes lokales Grundgerüst genutzt.';
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('zeitüberschreitung')) {
        fallbackReason = 'KI-Zeitüberschreitung nach 45 s; lokales Lern-Gerüst genutzt.';
      } else if (msg.toLowerCase().includes('budget')) {
        fallbackReason = msg;
      } else {
        fallbackReason = `KI nicht erreichbar (${msg}); lokales Lern-Gerüst genutzt.`;
      }
    }
  }

  if (blueprints.length === 0) {
    options.onProgress?.(75, 'Erstelle strukturierten 12-Karten-Lernpfad…');
    blueprints = buildDeterministicBlueprintsFromSubject(cleanTitle, contextText, targetCount);
  }

  const sourceLabel = options.sourceLabel || (
    sourceType === 'pdf_document'
      ? `PDF / Dokument: ${cleanTitle}`
      : sourceType === 'book'
      ? `Buch-Synthese: ${cleanTitle}`
      : sourceType === 'url'
      ? `Web-Quelle: ${cleanTitle}`
      : `Lernpfad: ${cleanTitle}`
  );

  const items: FeedItem[] = blueprints.map((bp, idx) =>
    buildHivemindFeedItem({
      trackId,
      trackTitle: cleanTitle,
      stepIndex: idx + 1,
      totalSteps: blueprints.length,
      topic,
      sourceLabel,
      sourceUrl: resolvedUrl,
      blueprint: bp,
      aiAssisted: usedAi
    })
  );

  const nowIso = new Date().toISOString();
  const sourceTypeLabel =
    sourceType === 'pdf_document'
      ? 'PDF / Dokument'
      : sourceType === 'book'
      ? 'Buch-Curriculum'
      : sourceType === 'url'
      ? 'Web-Quelle'
      : 'Themen-Pfad';

  const chapters = buildChaptersForTrack(cleanTitle, contextText);

  const track: HivemindLearningTrack = {
    id: trackId,
    title: cleanTitle,
    subtitle: `${items.length} Karten · ${sourceTypeLabel}`,
    iconEmoji: emoji,
    sourceType,
    sourceLabel,
    createdAt: nowIso,
    updatedAt: nowIso,
    mixIntoMainFeed: options.mixIntoMainFeed ?? true,
    completedItemIds: [],
    totalItemsCount: items.length,
    progressPercent: 0,
    items,
    chapters,
    currentChapterIndex: 1,
    usedAi,
    ...(fallbackReason ? { fallbackReason } : {})
  };

  await hivemindLearningService.saveTrack(track, options.storage);
  options.onProgress?.(100, 'Lernpfad erfolgreich erstellt!');
  return track;
}

/**
 * Splits a document or topic into a progressive multi-chapter curriculum (4 to 8 chapters).
 * Chapter 1 is marked `isGenerated: true`; subsequent chapters are ready for 1-tap expansion.
 */
export function buildChaptersForTrack(
  title: string,
  rawText: string = '',
  existingChapters?: HivemindChapterSpec[]
): HivemindChapterSpec[] {
  if (Array.isArray(existingChapters) && existingChapters.length >= 2) {
    return existingChapters.map((ch, idx) => ({
      chapterIndex: Number(ch.chapterIndex) || idx + 1,
      title: String(ch.title || `Kapitel ${idx + 1}`),
      focusPromptOrChunk: String(ch.focusPromptOrChunk || title),
      isGenerated: Boolean(ch.isGenerated)
    }));
  }

  const cleanText = (rawText || '').trim();
  const chunkSize = 6000;
  if (cleanText.length > chunkSize * 1.2) {
    const chunks: string[] = [];
    for (let offset = 0; offset < cleanText.length && chunks.length < 8; offset += chunkSize) {
      chunks.push(cleanText.slice(offset, offset + chunkSize));
    }
    while (chunks.length < 4) {
      chunks.push(cleanText.slice(0, chunkSize));
    }
    return chunks.map((chunk, idx) => ({
      chapterIndex: idx + 1,
      title:
        idx === 0
          ? `Kapitel 1: Grundlagen & Ausgangsthesen (${title})`
          : idx === 1
          ? `Kapitel 2: Systematische Vertiefung & Kernmechanismen`
          : idx === 2
          ? `Kapitel 3: Kontroversen, Gegenargumente & Grenzfälle`
          : `Kapitel ${idx + 1}: Synthese & Transfer in die Praxis`,
      focusPromptOrChunk: chunk,
      isGenerated: idx === 0
    }));
  }

  return [
    {
      chapterIndex: 1,
      title: `Kapitel 1: Fundament, Begriffe & Ausgangsproblem`,
      focusPromptOrChunk: `${title} — Grundbegriffe, historischer Ursprung, zentrale Fragestellung und Schlüsselbeispiele. ${cleanText.slice(0, 2000)}`.trim(),
      isGenerated: true
    },
    {
      chapterIndex: 2,
      title: `Kapitel 2: Strukturmechanik, Methodik & Vertiefung`,
      focusPromptOrChunk: `${title} — Vertiefte Kausalketten, theoretische Modelle, formale Struktur und empirische Befunde.`,
      isGenerated: false
    },
    {
      chapterIndex: 3,
      title: `Kapitel 3: Dialektik, Einwände & Paradigmenwechsel`,
      focusPromptOrChunk: `${title} — Stärkste wissenschaftliche und philosophische Gegenpositionen, blinde Flecken und offene Streitfragen.`,
      isGenerated: false
    },
    {
      chapterIndex: 4,
      title: `Kapitel 4: Meister-Synthese & Praktischer Transfer`,
      focusPromptOrChunk: `${title} — Interdisziplinäre Verknüpfung, Gegenwartsbedeutung, didaktischer Transfer und Anwendungsfälle.`,
      isGenerated: false
    }
  ];
}

/**
 * Generates and appends the next 12-card chapter for an existing Hivemind learning track.
 */
export async function generateNextHivemindChapter(
  trackId: string,
  options: {
    credentials?: AiCredentials;
    storage?: AtemStorage;
    skipNetworkFetch?: boolean;
    onProgress?: (percent: number, stageLabel: string) => void;
  } = {}
): Promise<HivemindLearningTrack> {
  const storage = options.storage ?? appStorage;
  const track = await hivemindLearningService.getTrackById(trackId, storage);
  if (!track) {
    throw new Error(`Lernpfad "${trackId}" wurde nicht gefunden.`);
  }

  const chapters = buildChaptersForTrack(track.title, '', track.chapters);
  let targetChapter = chapters.find(ch => !ch.isGenerated);
  if (!targetChapter) {
    const nextIdx = chapters.length + 1;
    targetChapter = {
      chapterIndex: nextIdx,
      title: `Kapitel ${nextIdx}: Weiterführende Vertiefung & Spezialfragen`,
      focusPromptOrChunk: `${track.title} — Fortgeschrittene Vertiefung (Kapitel ${nextIdx}), neue Perspektiven, Fallstudien und Synthese.`,
      isGenerated: false
    };
    chapters.push(targetChapter);
  }

  options.onProgress?.(20, `Generiere ${targetChapter.title} (+12 Karten)…`);

  const { topic } = inferTrackTopicAndEmoji(track.title);
  const targetCardCount = 12;
  const previousTotal = track.items.length;
  const newTotalSteps = previousTotal + targetCardCount;

  let creds = options.credentials;
  if (!creds) {
    try {
      creds = await loadAiCredentials(storage);
    } catch {
      creds = undefined;
    }
  }

  let blueprints: HivemindCardBlueprint[] = [];
  let usedAi = false;
  let fallbackReason: string | undefined;

  const hasChapterAiCreds = Boolean(creds && hasAiConfiguration(creds));
  const chapterBudgetCeiling = getEffectiveBudgetCeilingEur(Boolean(creds?.apiKey?.trim()));
  const chapterCanSpend = hasChapterAiCreds
    ? await defaultUsageLedger.canSpend(0.01, undefined, chapterBudgetCeiling).catch(() => true)
    : false;
  if (!hasChapterAiCreds) {
    fallbackReason = 'Kein aktiver KI-Schlüssel konfiguriert; Kapitel wurde lokal strukturiert.';
  } else if (!chapterCanSpend) {
    fallbackReason = `Monatliches KI-Budgetlimit (${chapterBudgetCeiling.toFixed(2)} €) erreicht; Kapitel wurde lokal strukturiert.`;
  }

  if (hasChapterAiCreds && chapterCanSpend && creds && !options.skipNetworkFetch) {
    try {
      options.onProgress?.(45, `KI-Curriculum für ${targetChapter.title} wird synthetisiert…`);
      const prompt = `Du bist der „Atmen Hivemind“-Lernarchitekt.
Erstelle das nächste aufbauende Kapitel (${targetChapter.title}) für den Lernpfad „${track.title}“ mit exakt ${targetCardCount} Karten (Schritte ${previousTotal + 1} bis ${newTotalSteps}).

FOKUS DIESES KAPITELS:
${targetChapter.title}
${targetChapter.focusPromptOrChunk}

BEREITS BEHANDELTE KARTEN (NICHT WIEDERHOLEN!):
${track.items.slice(-6).map(i => `- ${i.title}`).join('\n')}

Wechsle die 4 Archetypen ab:
- "story_thread"
- "expanding_brain_meme" (mit 4 "escalationStages")
- "discourse_replies" (mit 3 "simulatedReplies")
- "milestone_quiz" (mit 4-Optionen "quiz")

Antworte ausschließlich als valides JSON-Objekt:
{
  "cards": [
    {
      "cardArchetype": "story_thread | expanding_brain_meme | discourse_replies | milestone_quiz",
      "title": "Prägnanter Titel",
      "subtitle": "Kapitel ${targetChapter.chapterIndex} · Schritt-Einordnung",
      "feedText": "3-5 dichte, lehrreiche Sätze für den Feed.",
      "body": "Vertiefende Erklärung (2-3 Absätze) für den Reader.",
      "keyInsight": "1-Satz Kernerkenntnis",
      "escalationStages": [
        { "stageLabel": "Stufe 1: Alltags-Intuition", "caption": "...", "visualLevel": 1 },
        { "stageLabel": "Stufe 2: Struktur-Mechanik", "caption": "...", "visualLevel": 2 },
        { "stageLabel": "Stufe 3: Systemischer Hebel", "caption": "...", "visualLevel": 3 },
        { "stageLabel": "Stufe 4: Meister-Synthese", "caption": "...", "visualLevel": 4 }
      ],
      "simulatedReplies": [
        { "handle": "u/skeptiker", "roleBadge": "⚡ Gegenrede", "text": "...", "upvotes": 42 },
        { "handle": "u/historiker", "roleBadge": "🔍 Kontext", "text": "...", "upvotes": 68 },
        { "handle": "u/praxis_impuls", "roleBadge": "💡 Synthese", "text": "...", "upvotes": 51 }
      ],
      "quiz": {
        "question": "Präzise Verständnisfrage?",
        "options": ["Richtige Antwort", "Plausible Falschantwort 1", "Plausible Falschantwort 2", "Plausible Falschantwort 3"],
        "correctIndex": 0,
        "explanation": "Warum Option A stimmt."
      }
    }
  ]
}`;

      const aiRes = await callAiModel(prompt, {
        credentials: creds,
        jsonMode: true,
        maxTokens: 4000,
        timeoutMs: 45_000,
        itemId: `hivemind-chapter-${track.id}-${targetChapter.chapterIndex}`
      });

      const cleanedJson = aiRes.text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleanedJson);
      if (parsed && Array.isArray(parsed.cards) && parsed.cards.length >= 6) {
        blueprints = parsed.cards.slice(0, targetCardCount).map((c: any, idx: number): HivemindCardBlueprint => {
          const fallbackArch: HivemindCardArchetype = (
            ['story_thread', 'expanding_brain_meme', 'discourse_replies', 'milestone_quiz'] as const
          )[idx % 4];
          const arch: HivemindCardArchetype = c.cardArchetype || fallbackArch;
          return {
            cardArchetype: arch,
            title: String(c.title || `${targetChapter!.title} · Impuls ${idx + 1}`).trim(),
            subtitle: String(c.subtitle || `${targetChapter!.title} · Schritt ${previousTotal + idx + 1}`).trim(),
            feedText: String(c.feedText || c.body || '').trim(),
            body: String(c.body || c.feedText || '').trim(),
            keyInsight: String(c.keyInsight || c.title || track.title).trim(),
            escalationStages:
              Array.isArray(c.escalationStages) && c.escalationStages.length >= 3
                ? c.escalationStages.slice(0, 4).map((st: any, sIdx: number) => ({
                    stageLabel: String(st.stageLabel || `Stufe ${sIdx + 1}`),
                    caption: String(st.caption || ''),
                    visualLevel: Math.min(4, Math.max(1, sIdx + 1)) as 1 | 2 | 3 | 4
                  }))
                : undefined,
            simulatedReplies:
              Array.isArray(c.simulatedReplies) && c.simulatedReplies.length >= 2
                ? c.simulatedReplies.slice(0, 3).map((rep: any) => ({
                    handle: String(rep.handle || 'u/seminar_salon'),
                    roleBadge: String(rep.roleBadge || '🔍 Impuls'),
                    text: String(rep.text || ''),
                    upvotes: Number(rep.upvotes) || 28
                  }))
                : undefined,
            quiz:
              c.quiz && typeof c.quiz.question === 'string' && Array.isArray(c.quiz.options)
                ? {
                    question: String(c.quiz.question),
                    options: c.quiz.options.map(String),
                    correctIndex: Number(c.quiz.correctIndex) || 0,
                    explanation: String(c.quiz.explanation || '')
                  }
                : undefined
          };
        });
        usedAi = true;
        fallbackReason = undefined;
      } else {
        fallbackReason = 'KI-Antwort war unvollständig; Kapitel wurde lokal ergänzt.';
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      fallbackReason = msg.toLowerCase().includes('zeitüberschreitung')
        ? 'KI-Zeitüberschreitung nach 45 s; Kapitel wurde lokal ergänzt.'
        : `KI-Erweiterung nicht verfügbar (${msg}); Kapitel wurde lokal ergänzt.`;
    }
  }

  if (blueprints.length < targetCardCount) {
    const detBlueprints = buildDeterministicBlueprintsFromSubject(
      `${track.title} — ${targetChapter.title}`,
      targetChapter.focusPromptOrChunk,
      targetCardCount
    );
    while (blueprints.length < targetCardCount) {
      const idx = blueprints.length;
      const baseBp = detBlueprints[idx % detBlueprints.length];
      blueprints.push({
        ...baseBp,
        title: `${targetChapter.title.replace(/^Kapitel\s*\d+:\s*/i, '')} · ${baseBp.title}`,
        subtitle: `${targetChapter.title} · Schritt ${previousTotal + idx + 1} von ${newTotalSteps}`
      });
    }
  }

  // Update totalSteps on existing items so step badges reflect the expanded track
  const updatedExistingItems: FeedItem[] = track.items.map((item, idx) => ({
    ...item,
    hivemindMeta: item.hivemindMeta
      ? {
          ...item.hivemindMeta,
          stepIndex: idx + 1,
          totalSteps: newTotalSteps
        }
      : undefined
  }));

  const newChapterItems: FeedItem[] = blueprints.slice(0, targetCardCount).map((bp, idx) =>
    buildHivemindFeedItem({
      trackId: track.id,
      trackTitle: track.title,
      stepIndex: previousTotal + idx + 1,
      totalSteps: newTotalSteps,
      topic,
      sourceLabel: `${track.sourceLabel} · ${targetChapter!.title}`,
      blueprint: bp,
      aiAssisted: usedAi
    })
  );

  const combinedItems = [...updatedExistingItems, ...newChapterItems];
  const updatedChapters = chapters.map(ch =>
    ch.chapterIndex === targetChapter!.chapterIndex ? { ...ch, isGenerated: true } : ch
  );
  const generatedChaptersCount = updatedChapters.filter(ch => ch.isGenerated).length;

  const updatedTrack: HivemindLearningTrack = {
    ...track,
    subtitle: `${combinedItems.length} Karten · ${generatedChaptersCount}/${updatedChapters.length} Kapitel`,
    items: combinedItems,
    totalItemsCount: combinedItems.length,
    progressPercent: calculateTrackProgressPercent(track.completedItemIds, combinedItems.length),
    chapters: updatedChapters,
    currentChapterIndex: targetChapter.chapterIndex,
    updatedAt: new Date().toISOString(),
    usedAi,
    ...(fallbackReason ? { fallbackReason } : { fallbackReason: undefined })
  };

  const saved = await hivemindLearningService.saveTrack(updatedTrack, storage);
  options.onProgress?.(100, `${targetChapter.title} (+${targetCardCount} Karten) geladen!`);
  return saved;
}

// ---------------------------------------------------------------------------
// Persistent Repository & Ambient Drip Interleaving Engine
// ---------------------------------------------------------------------------

export function calculateTrackProgressPercent(completedItemIds: string[], totalItemsCount: number): number {
  if (totalItemsCount <= 0) return 0;
  const uniqueCompleted = new Set(completedItemIds).size;
  return Math.min(100, Math.max(0, Math.round((uniqueCompleted / totalItemsCount) * 100)));
}

type HivemindListener = (tracks: HivemindLearningTrack[]) => void;

export class HivemindLearningService {
  private listeners = new Set<HivemindListener>();
  private cachedTracks: HivemindLearningTrack[] | null = null;

  public subscribe(listener: HivemindListener): () => void {
    this.listeners.add(listener);
    if (this.cachedTracks) {
      listener(this.cachedTracks);
    } else {
      void this.getTracks().then(tracks => listener(tracks));
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async notify(storage: AtemStorage = appStorage): Promise<void> {
    const tracks = await this.getTracks(storage);
    for (const listener of this.listeners) {
      try {
        listener(tracks);
      } catch {
        // Ignore listener error
      }
    }
  }

  public async getDeletedTrackIds(storage: AtemStorage = appStorage): Promise<string[]> {
    try {
      const raw = await storage.getItem(DELETED_HIVEMIND_TRACK_IDS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  public getTracksSync(): HivemindLearningTrack[] {
    return this.cachedTracks ? [...this.cachedTracks] : [];
  }

  public async purgeShowcaseStarterTracks(storage: AtemStorage = appStorage): Promise<number> {
    let removedCount = 0;
    try {
      const deletedSet = new Set(await this.getDeletedTrackIds(storage));
      let deletedChanged = false;
      for (const starterId of SHOWCASE_STARTER_TRACK_IDS) {
        if (!deletedSet.has(starterId)) {
          deletedSet.add(starterId);
          deletedChanged = true;
        }
      }
      if (deletedChanged) {
        await storage.setItem(DELETED_HIVEMIND_TRACK_IDS_KEY, JSON.stringify(Array.from(deletedSet)));
      }

      const raw = await storage.getItem(HIVEMIND_TRACKS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const remaining = parsed.filter(
            (t: any) => t && typeof t.id === 'string' && !SHOWCASE_STARTER_TRACK_IDS.has(t.id)
          );
          removedCount = parsed.length - remaining.length;
          if (removedCount > 0) {
            await storage.setItem(HIVEMIND_TRACKS_STORAGE_KEY, JSON.stringify(remaining));
            if (storage === appStorage) {
              this.cachedTracks = remaining;
            }
          }
        }
      }
    } catch {
      // Non-fatal
    }
    return removedCount;
  }

  public async getTracks(storage: AtemStorage = appStorage): Promise<HivemindLearningTrack[]> {
    try {
      const raw = await storage.getItem(HIVEMIND_TRACKS_STORAGE_KEY);
      const deletedIds = new Set(await this.getDeletedTrackIds(storage));
      if (!raw) {
        if (storage === appStorage) {
          this.cachedTracks = [];
        }
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        if (storage === appStorage) {
          this.cachedTracks = [];
        }
        return [];
      }

      const hasShowcaseTracks = parsed.some(
        (t: any) => t && typeof t.id === 'string' && SHOWCASE_STARTER_TRACK_IDS.has(t.id)
      );

      const normalized: HivemindLearningTrack[] = parsed
        .filter(
          (t: any) =>
            t &&
            typeof t.id === 'string' &&
            !SHOWCASE_STARTER_TRACK_IDS.has(t.id) &&
            !deletedIds.has(t.id)
        )
        .map((t: any): HivemindLearningTrack => {
          const items = Array.isArray(t.items) ? t.items : [];
          const totalItemsCount = items.length || Number(t.totalItemsCount) || 0;
          const validItemIdSet = new Set(items.map((it: FeedItem) => it.id));
          const completedItemIds: string[] = Array.isArray(t.completedItemIds)
            ? Array.from(new Set(t.completedItemIds.map((v: unknown) => String(v)).filter((id: string) => validItemIdSet.size === 0 || validItemIdSet.has(id))))
            : [];
          const progressPercent = calculateTrackProgressPercent(completedItemIds, totalItemsCount);

          const titleStr = String(t.title || 'Lernpfad');
          const chapters = buildChaptersForTrack(titleStr, '', t.chapters);
          const currentChapterIndex =
            typeof t.currentChapterIndex === 'number' && t.currentChapterIndex >= 1
              ? t.currentChapterIndex
              : Math.max(1, chapters.filter(c => c.isGenerated).length);

          return {
            id: String(t.id),
            title: titleStr,
            subtitle: String(t.subtitle || `${totalItemsCount} Karten`),
            iconEmoji: String(t.iconEmoji || '🧠'),
            sourceType: t.sourceType || 'topic',
            sourceLabel: String(t.sourceLabel || t.title || 'Hivemind'),
            createdAt: String(t.createdAt || new Date().toISOString()),
            updatedAt: String(t.updatedAt || new Date().toISOString()),
            mixIntoMainFeed: Boolean(t.mixIntoMainFeed),
            completedItemIds,
            totalItemsCount,
            progressPercent,
            items,
            chapters,
            currentChapterIndex,
            ...(typeof t.usedAi === 'boolean' ? { usedAi: t.usedAi } : {}),
            ...(typeof t.fallbackReason === 'string' && t.fallbackReason.trim()
              ? { fallbackReason: t.fallbackReason }
              : {})
          };
        });

      if (hasShowcaseTracks) {
        await storage.setItem(HIVEMIND_TRACKS_STORAGE_KEY, JSON.stringify(normalized));
        for (const starterId of SHOWCASE_STARTER_TRACK_IDS) {
          deletedIds.add(starterId);
        }
        await storage.setItem(DELETED_HIVEMIND_TRACK_IDS_KEY, JSON.stringify(Array.from(deletedIds)));
      }

      if (storage === appStorage) {
        this.cachedTracks = normalized;
      }
      return normalized;
    } catch {
      if (storage === appStorage) {
        this.cachedTracks = [];
      }
      return [];
    }
  }

  public getCachedTracks(): HivemindLearningTrack[] {
    return this.cachedTracks ? [...this.cachedTracks] : [];
  }

  public async getTrackById(trackId: string, storage: AtemStorage = appStorage): Promise<HivemindLearningTrack | null> {
    const tracks = await this.getTracks(storage);
    return tracks.find(t => t.id === trackId) || null;
  }

  public async saveTrack(track: HivemindLearningTrack, storage: AtemStorage = appStorage): Promise<HivemindLearningTrack> {
    const tracks = await this.getTracks(storage);
    const totalItemsCount = track.items.length || track.totalItemsCount;
    const completedItemIds = Array.from(new Set(track.completedItemIds || []));
    const updatedTrack: HivemindLearningTrack = {
      ...track,
      totalItemsCount,
      completedItemIds,
      progressPercent: calculateTrackProgressPercent(completedItemIds, totalItemsCount),
      updatedAt: new Date().toISOString()
    };

    const existingIdx = tracks.findIndex(t => t.id === track.id);
    let nextTracks: HivemindLearningTrack[];
    if (existingIdx >= 0) {
      nextTracks = [...tracks];
      nextTracks[existingIdx] = updatedTrack;
    } else {
      nextTracks = [updatedTrack, ...tracks];
    }

    await storage.setItem(HIVEMIND_TRACKS_STORAGE_KEY, JSON.stringify(nextTracks));
    if (storage === appStorage) {
      this.cachedTracks = nextTracks;
      await this.notify(storage);
    }
    return updatedTrack;
  }

  public async deleteTrack(trackId: string, storage: AtemStorage = appStorage): Promise<void> {
    const tracks = await this.getTracks(storage);
    const nextTracks = tracks.filter(t => t.id !== trackId);
    const deletedIds = new Set(await this.getDeletedTrackIds(storage));
    deletedIds.add(trackId);
    await storage.setItem(DELETED_HIVEMIND_TRACK_IDS_KEY, JSON.stringify(Array.from(deletedIds)));
    await storage.setItem(HIVEMIND_TRACKS_STORAGE_KEY, JSON.stringify(nextTracks));
    if (storage === appStorage) {
      this.cachedTracks = nextTracks;
      await this.notify(storage);
    }
  }

  public async toggleMixIntoMainFeed(
    trackId: string,
    mix?: boolean,
    storage: AtemStorage = appStorage
  ): Promise<HivemindLearningTrack | null> {
    const track = await this.getTrackById(trackId, storage);
    if (!track) return null;
    const nextMix = typeof mix === 'boolean' ? mix : !track.mixIntoMainFeed;
    return this.saveTrack(
      {
        ...track,
        mixIntoMainFeed: nextMix
      },
      storage
    );
  }

  public async markItemCompleted(
    trackId: string,
    itemId: string,
    storage: AtemStorage = appStorage
  ): Promise<HivemindLearningTrack | null> {
    const track = await this.getTrackById(trackId, storage);
    if (!track) return null;
    if (track.completedItemIds.includes(itemId)) {
      return track;
    }
    const nextCompleted = [...track.completedItemIds, itemId];
    return this.saveTrack(
      {
        ...track,
        completedItemIds: nextCompleted
      },
      storage
    );
  }

  public async markItemCompletedByItemId(
    itemId: string,
    storage: AtemStorage = appStorage
  ): Promise<HivemindLearningTrack | null> {
    if (!itemId) return null;
    const tracks = await this.getTracks(storage);
    for (const track of tracks) {
      if (track.items.some(it => it.id === itemId)) {
        return this.markItemCompleted(track.id, itemId, storage);
      }
    }
    return null;
  }

  public async resetTrackProgress(
    trackId: string,
    storage: AtemStorage = appStorage
  ): Promise<HivemindLearningTrack | null> {
    const track = await this.getTrackById(trackId, storage);
    if (!track) return null;
    return this.saveTrack(
      {
        ...track,
        completedItemIds: [],
        progressPercent: 0
      },
      storage
    );
  }

  public async generateNextChapter(
    trackId: string,
    options: {
      credentials?: AiCredentials;
      storage?: AtemStorage;
      skipNetworkFetch?: boolean;
      onProgress?: (percent: number, stageLabel: string) => void;
    } = {}
  ): Promise<HivemindLearningTrack> {
    return generateNextHivemindChapter(trackId, options);
  }

  /**
   * Mode 2 (Ambient Drip): Returns the next 1–2 uncompleted cards from each active learning track
   * where `mixIntoMainFeed === true`.
   */
  public getAmbientDripCards(tracks: HivemindLearningTrack[], maxPerTrack: number = 2): FeedItem[] {
    const dripCards: FeedItem[] = [];
    for (const track of tracks) {
      if (!track.mixIntoMainFeed) continue;
      const completedSet = new Set(track.completedItemIds);
      const uncompleted = track.items.filter(item => !completedSet.has(item.id));
      dripCards.push(...uncompleted.slice(0, maxPerTrack));
    }
    return dripCards;
  }

  /**
   * Interleaves unread Ambient Drip cards from active `mixIntoMainFeed` tracks into a stream
   * (every `interval` cards, e.g. every 5th card), ensuring completed cards are never duplicated.
   */
  public interleaveAmbientDripCards<T extends FeedItem>(
    mainFeed: T[],
    tracks: HivemindLearningTrack[],
    scoreMapper: (item: FeedItem) => T,
    interval: number = 5
  ): T[] {
    const dripCandidates = this.getAmbientDripCards(tracks, 2);
    if (dripCandidates.length === 0) return mainFeed;

    const completedSet = new Set<string>();
    for (const t of tracks) {
      for (const cid of t.completedItemIds) {
        completedSet.add(cid);
      }
    }

    // Filter out any already-completed Hivemind cards from mainFeed
    const filteredMain = mainFeed.filter(item => !completedSet.has(item.id));
    const existingIds = new Set(filteredMain.map(i => i.id));
    const queue = dripCandidates.filter(c => !existingIds.has(c.id) && !completedSet.has(c.id));

    if (queue.length === 0) return filteredMain;

    const result: T[] = [];
    let queueIdx = 0;
    const step = Math.max(2, interval);

    for (let i = 0; i < filteredMain.length; i++) {
      // Insert first drip card after index 3 (4th position), then every `step` cards
      if (i > 0 && (i === 3 || (i > 3 && (i - 3) % step === 0)) && queueIdx < queue.length) {
        result.push(scoreMapper(queue[queueIdx]));
        queueIdx++;
      }
      result.push(filteredMain[i]);
    }

    // If mainFeed was very short and we still have 1 drip card unplaced, append it
    while (queueIdx < queue.length && result.length < 10) {
      result.push(scoreMapper(queue[queueIdx]));
      queueIdx++;
    }

    return result;
  }
}

export const hivemindLearningService = new HivemindLearningService();
