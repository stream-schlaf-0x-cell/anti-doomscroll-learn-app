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

export function buildShowcaseStarterTracks(): HivemindLearningTrack[] {
  const createdAt = '2026-11-07T08:00:00.000Z';

  // Track 1: Aufstieg & Fall der Römischen Republik (Marius bis Augustus) — 12 Cards
  const romanTrackId = 'track-roman-republic-empire';
  const romanTitle = 'Aufstieg & Fall Roms (Marius bis Augustus)';
  const romanBlueprints: HivemindCardBlueprint[] = [
    {
      cardArchetype: 'story_thread',
      title: 'Das Paradox der Römischen Republik: Sieg nach außen, Zerfall im Inneren',
      subtitle: 'Wie Rom die Mittelmeerwelt eroberte und daran seine republikanische Verfassung verlor',
      feedText: 'Nach dem Sieg über Karthago (146 v. Chr.) beherrscht Rom das gesamte Mittelmeer.\n\nDoch genau dieser Triumph zerstört das Fundament der Republik: Während römische Bauern jahrelang in Übersee kämpfen, verfallen ihre Höfe in Italien. Reiche Senatoren kaufen das Land auf und bewirtschaften riesige Latifundien mit Kriegssklaven.',
      body: 'Nach dem Sieg über Karthago (146 v. Chr.) und der Zerstörung Korinths stand Rom ohne äußeren Rivalen da. Doch die Verfassung der Republik war für einen überschaubaren Stadtstaat konzipiert, nicht für ein Weltreich.\n\nDas Rückgrat der frühen Republik war der besitzende Bauernsoldat: Er bewirtschaftete sein Land und rüstete sich im Kriegsfall selbst aus. Durch jahrzehntelange Feldzüge in Spanien, Griechenland und Nordafrika verarmten diese Kleinbauern, während die Senatsaristokratie unermessliche Reichtümer und Landgüter (Latifundien) anhäufte. Die Heimkehrer strömten als besitzloses Proletariat nach Rom – die soziale Bombe der späten Republik war gelegt.',
      keyInsight: 'Roms militärische Expansion ruinierte genau jenen Bauernstand, auf dem das Milizheer und die politische Stabilität der Republik ruhten.'
    },
    {
      cardArchetype: 'expanding_brain_meme',
      title: 'Die Evolution der militärischen Loyalität in Rom',
      subtitle: '4-Stufen Konzept-Meme: Vom Bürgersoldaten zum Kaisertum',
      feedText: 'Warum marschierten römische Legionen plötzlich auf ihre eigene Hauptstadt? Die Antwort liegt in der strukturellen Verschiebung der Soldaten-Loyalität von 107 v. Chr. bis 27 v. Chr.',
      body: 'Die Heeresreform des Gaius Marius (107 v. Chr.) löste ein akutes Rekrutierungsproblem, schuf aber ein tödliches politisches Anreizsystem: Da der Senat sich weigerte, für die Altersversorgung der besitzlosen Veteranen aufzukommen, hing das Überleben jedes Soldaten nach Dienstende allein davon ab, dass sein Feldherr ihm per Gesetz Land erkämpfte. Damit wurden aus Armeen des Staates private Hausmächte ehrgeiziger Imperatoren.',
      keyInsight: 'Wer die Altersversorgung der Legionäre garantiert, besitzt ihre politische Loyalität – nicht mehr der Senat, sondern der Feldherr.',
      escalationStages: [
        {
          stageLabel: 'Stufe 1 · Frühe Republik',
          caption: 'RÖMISCHE BÜRGER-SOLDATEN SIND LOYAL GEGENÜBER ROM',
          visualLevel: 1
        },
        {
          stageLabel: 'Stufe 2 · Heeresreform 107 v. Chr.',
          caption: 'BERUFSSOLDATEN SIND FORMAL LOYAL GEGENÜBER ROM',
          visualLevel: 2
        },
        {
          stageLabel: 'Stufe 3 · Klientel-Armeen (Sulla & Caesar)',
          caption: 'BERUFSSOLDATEN SIND LOYAL GEGENÜBER IHREN FELDHERREN',
          visualLevel: 3
        },
        {
          stageLabel: 'Stufe 4 · Prinzipat & Imperium',
          caption: 'FELDHERREN SIND NUR SICH SELBST LOYAL UND WERDEN KAISER',
          visualLevel: 4
        }
      ]
    },
    {
      cardArchetype: 'discourse_replies',
      title: 'Die Reformen der Gracchen (133–121 v. Chr.): Beginn der politischen Gewalt',
      subtitle: 'Tiberius und Gaius Gracchus versuchen die Bodenreform – und sterben durch Senatsgewalt',
      feedText: 'Volkstribun Tiberius Gracchus will öffentliches Staatsland (ager publicus), das Großgrundbesitzer illegal besetzen, an verarmte Bürger verteilen. Als der Senat blockiert, bricht Tiberius ungeschriebene Verfassungsnormen – und wird von Senatoren erschlagen.',
      body: '133 v. Chr. brachte Tiberius Sempronius Gracchus die Lex Sempronia agraria ein: Kein Bürger sollte mehr als 500 Joch Staatsland nutzen; der Überschuss sollte an landlose Römer gehen. Um die Blockade des Senats zu umgehen, ließ er seinen amtierenden Mittribunen Octavius absetzen und kandidierte für eine zweite Amtszeit.\n\nUnter Führung des Pontifex Maximus Scipio Nasica stürmten Senatoren auf das Kapitol und erschlugen Tiberius und 300 seiner Anhänger mit Stuhlbeinen. Zum ersten Mal seit Jahrhunderten wurde ein politischer Konflikt in Rom durch offenen Mord entschieden.',
      keyInsight: 'Mit dem Mord an Tiberius Gracchus 133 v. Chr. zerbrach der Grundkonsens (concordia) der römischen Politik.',
      simulatedReplies: [
        {
          handle: 'u/verfassungs_analyse',
          roleBadge: '🔍 Kontext',
          text: 'Entscheidend: Tiberius brach zuerst das ungeschriebene Gewohnheitsrecht (mos maiorum), indem er einen Mittribunen absetzte. Der Senat antwortete darauf mit tödlicher Gewalt – beide Seiten eskalierten.',
          upvotes: 64
        },
        {
          handle: 'u/sokratischer_einwand',
          roleBadge: '⚡ Einwand',
          text: 'War Tiberius wirklich ein Revolutionär? Eigentlich war sein Ziel erzkonservativ: Er wollte den alten römischen Bauernstand wiederherstellen, um die Wehrkraft der Legionen zu retten.',
          upvotes: 51
        },
        {
          handle: 'u/gegenwarts_transfer',
          roleBadge: '🛠️ Transfer',
          text: 'Lehre für moderne Demokratien: Wenn informelle Normen der Zurückhaltung erodieren, verwandelt sich das Verfassungsrecht in eine reine Waffe des Machtkampfes.',
          upvotes: 43
        }
      ]
    },
    {
      cardArchetype: 'milestone_quiz',
      title: 'Meilenstein-Check: Heeresreform & Krise der Republik',
      subtitle: 'Überprüfe dein Verständnis der strukturellen Ursachen',
      feedText: 'Gaius Marius öffnete 107 v. Chr. die römischen Legionen für die capite censi (Besitzlose). Die Soldaten erhielten standardisierte Ausrüstung („Maultiere des Marius“) – doch ihre Altersversorgung blieb ungelöst.',
      body: 'Durch die Abschaffung des Vermögenszensus konnten Hunderttausende besitzlose Proletarier in die Armee eintreten. Da der römische Staat jedoch keine staatliche Pensionskasse schuf, mussten erfolgreiche Generäle nach jedem Feldzug Landverteilungsgesetze gegen den Widerstand des Senats durchboxen.',
      keyInsight: 'Die Privatisierung der Veteranenversorgung verwandelte das römische Staatsheer in persönliche Gefolgschaften der Imperatoren.',
      quiz: {
        question: 'Warum führte die Marianische Heeresreform (107 v. Chr.) langfristig zur Entmachtung des römischen Senats?',
        options: [
          'Weil besitzlose Berufssoldaten für ihre Landversorgung nach dem Krieg wirtschaftlich direkt von ihrem Feldherrn abhingen.',
          'Weil Gaius Marius den Senat per Gesetz auflöste und sich selbst zum Kaiser krönte.',
          'Weil nur noch ausländische Söldner ohne römisches Bürgerrecht in den Legionen dienen durften.',
          'Weil die römische Flotte die Getreideversorgung Italiens blockierte.'
        ],
        correctIndex: 0,
        explanation: 'Da der Senat keine staatliche Altersversorgung bereitstellte, waren die Veteranen auf Landzuweisungen angewiesen, die ihr jeweiliger Feldherr politisch oder militärisch für sie erkämpfte.'
      }
    },
    {
      cardArchetype: 'story_thread',
      title: 'Sullas Tabubruch (88 v. Chr.): Der erste Marsch auf Rom',
      subtitle: 'Als ein römischer Konsul zum ersten Mal seine eigenen Legionen gegen die Hauptstadt führte',
      feedText: '88 v. Chr. entzieht die Volksversammlung dem Konsul Cornelius Sulla das lukrative Kommando gegen König Mithridates und überträgt es seinem Rivalen Marius.\n\nSulla tut das Undenkbare: Er wendet sich an seine sechs Legionen in Kampanien und befiehlt den Marsch auf Rom. Fast alle Offiziere verweigern den Befehl – doch die einfachen Soldaten folgen ihm.',
      body: 'Warum folgten die einfachen Legionäre Sulla gegen ihre eigene Heimatstadt, während die adligen Offiziere desertierten? Für die Soldaten bedeutete der Verlust des Ost-Kommandos den Verlust von Kriegsbeute und Landversorgung.\n\nNach seinem Sieg im Bürgerkrieg errichtete Sulla 82 v. Chr. eine Diktatur zur „Wiederherstellung der Republik“: Mit den berüchtigten Proskriptionslisten ließ er Tausende politische Gegner für vogelfrei erklären, ihr Vermögen einziehen und die Macht des Senats per Gesetz zementieren. Doch Sullas eigenes Beispiel bewies jedem künftigen General: Wer die stärksten Legionen hat, kann den Staat mit dem Schwert diktieren.',
      keyInsight: 'Sulla wollte die Senatsherrschaft mit dem Schwert retten – und bewies damit unfreiwillig, dass das Schwert stärker war als der Senat.'
    },
    {
      cardArchetype: 'expanding_brain_meme',
      title: 'Die Eskalation der Ausnahmezustände in der späten Republik',
      subtitle: '4-Stufen Konzept-Meme: Wie Notstandsmaßnahmen zur Normalität wurden',
      feedText: 'In der frühen Republik war die Diktatur ein streng auf 6 Monate begrenztes Notstandsamt zur Abwehr äußerer Feinde. Innerhalb von zwei Generationen wurde daraus die lebenslange Alleinherrschaft.',
      body: 'Die römische Verfassung kannte Sicherheitsventile für existenzielle Krisen. Doch in den Bürgerkriegen des 1. Jahrhunderts v. Chr. wurden diese Notstandsinstrumente schrittweise entgrenzt: vom Senatus consultum ultimum über Sullas unbefristete Verfassungsdiktatur bis zu Caesars Dictator perpetuo (44 v. Chr.).',
      keyInsight: 'Jeder verfassungsrechtliche Ausnahmezustand schuf den Präzedenzfall für die nächste, noch radikalere Machtkonzentration.',
      escalationStages: [
        {
          stageLabel: 'Stufe 1 · Klassische Republik',
          caption: 'DIKTATUR AUF 6 MONATE BEGRENZT NUR BEI ÄUSSERER GEFAHR',
          visualLevel: 1
        },
        {
          stageLabel: 'Stufe 2 · Senatus Consultum Ultimum',
          caption: 'NOTSTANDSDEKRET ERLAUBT TÖTUNG RÖMISCHER BÜRGER OHNE PROZESS',
          visualLevel: 2
        },
        {
          stageLabel: 'Stufe 3 · Sulla (82 v. Chr.)',
          caption: 'UNBEFRISTETE DIKTATUR MIT TODESLISTEN ZUR „RETTUNG DER VERFASSUNG“',
          visualLevel: 3
        },
        {
          stageLabel: 'Stufe 4 · Julius Caesar (44 v. Chr.)',
          caption: 'DICTATOR PERPETUO: DIKTATOR AUF LEBENSZEIT',
          visualLevel: 4
        }
      ]
    },
    {
      cardArchetype: 'discourse_replies',
      title: 'Das Erste Triumvirat (60 v. Chr.): Das geheime Kartell der Mächtigen',
      subtitle: 'Pompeius, Crassus und Caesar schalten das republikanische Gleichgewicht aus',
      feedText: 'Der Senat unter Führung Catos blockiert gleichzeitig Pompeius (Land für seine Veteranen), Crassus (Steuerpächter-Erlass) und Caesar (Konsulatsbewerbung).\n\nDie Folge: Die drei mächtigsten Männer Roms schließen 60 v. Chr. ein informelles Bündnis, das den Senat komplett aushebelt.',
      body: 'Obwohl der kompromisslose Optimat Cato der Jüngere glaubte, die Republik durch totale Blockade aller Sonderwünsche zu schützen, trieb genau diese Unnachgiebigkeit seine drei mächtigsten Rivalen in eine Koalition: Pompeius brachte das militärische Prestige und die Veteranen ein, Crassus das Finanzkapital, und Caesar als Konsul des Jahres 59 v. Chr. die skrupellose Exekutivgewalt.',
      keyInsight: 'Catos dogmatische Totalblockade verhinderte nicht den Machtverlust des Senats, sondern erzwang den Zusammenschluss seiner mächtigsten Gegner.',
      simulatedReplies: [
        {
          handle: 'u/cicero_beobachter',
          roleBadge: '🔍 Historisches Urteil',
          text: 'Cicero formulierte es treffend über Cato: „Er spricht, als lebten wir in Platons idealem Staat, und nicht im Bodensatz des Romulus.“ Dogmatismus ohne Kompromissfähigkeit zerstörte die Handlungsfähigkeit des Senats.',
          upvotes: 78
        },
        {
          handle: 'u/cato_verteidiger',
          roleBadge: '⚡ Gegenrede',
          text: 'Hätte der Senat den Forderungen von Pompeius und Caesar kampflos nachgegeben, wäre die Republik schon 60 v. Chr. zur bloßen Fassade verkommen. Cato verteidigte das Prinzip der Annuität und Kollegialität.',
          upvotes: 49
        },
        {
          handle: 'u/spieltheorie_rom',
          roleBadge: '🛠️ Mechanik',
          text: 'Ein Dreierbündnis ist nur stabil, solange alle drei leben. Als Crassus 53 v. Chr. bei Carrhae fiel, war der direkte Kollisionskurs zwischen Pompeius und Caesar unvermeidlich.',
          upvotes: 62
        }
      ]
    },
    {
      cardArchetype: 'milestone_quiz',
      title: 'Meilenstein-Check: Vom Triumvirat zum Rubikon',
      subtitle: 'Teste dein Wissen zur politischen Dynamik um 60–49 v. Chr.',
      feedText: 'Als Julius Caesar 49 v. Chr. mit der 13. Legion den Grenzfluss Rubikon überschritt („Alea iacta est – Der Würfel ist gefallen“), begann der Bürgerkrieg gegen Pompeius und die Senatsmehrheit.',
      body: 'Caesar wusste: Sobald er sein prokonsularisches Imperium niederlegte und als Privatmann nach Rom zurückkehrte, würden ihn seine Feinde vor Gericht stellen und politisch vernichten. Deshalb wählte er die Flucht nach vorn in den Bürgerkrieg.',
      keyInsight: 'Das Fehlen einer verfassungsmäßigen Exit-Option für übermächtige Feldherren machte den Bürgerkrieg 49 v. Chr. nahezu unausweichlich.',
      quiz: {
        question: 'Welche unbeabsichtigte Folge hatte die kompromisslose Blockadepolitik der Senatsmehrheit (Optimaten) im Jahr 60 v. Chr.?',
        options: [
          'Sie trieb Pompeius, Crassus und Caesar dazu, ihre Ressourcen im Ersten Triumvirat gegen den Senat zu bündeln.',
          'Sie führte zur sofortigen Abdankung von Julius Caesar und seinem Rückzug nach Griechenland.',
          'Sie stärkte die Macht der Volkstribunen dauerhaft gegenüber den Militärbefehlshabern.',
          'Sie beendete die römischen Eroberungen in Gallien auf friedlichem Weg.'
        ],
        correctIndex: 0,
        explanation: 'Indem der Senat gleichzeitig die Anliegen von Pompeius, Crassus und Caesar ablehnte, schuf er den Anreiz für deren informelles Machtkartell (60 v. Chr.).'
      }
    },
    {
      cardArchetype: 'story_thread',
      title: 'Die Iden des März (44 v. Chr.): Warum die Mörder Caesars keinen Plan für den Tag danach hatten',
      subtitle: '23 Dolchstiche im Theater des Pompeius – doch die Republik kehrte nicht zurück',
      feedText: 'Am 15. März 44 v. Chr. töten rund 60 Senatoren unter Brutus und Cassius den Diktator Julius Caesar.\n\nBrutus glaubt: Sobald der Tyrann tot ist, tritt die freie Republik von selbst wieder in Kraft. Doch das Volk von Rom jubelt den Befreiern nicht zu – es fürchtet um Caesars Landgesetze und Testamentsspenden.',
      body: 'Der fundamentale Irrtum der Verschwörer um Marcus Iunius Brutus lag darin, die Krise der Republik als reines Personenproblem („Tyrannis Caesars“) misszuverstehen, statt als Strukturproblem eines Weltreiches.\n\nDie Institutionen der Stadt-Republik konnten 40 Legionen und Dutzende Provinzen nicht mehr steuern. Caesars Offiziere und Veteranen – angeführt von Marcus Antonius und dem erst 18-jährigen Adoptivsohn Octavian – übernahmen das Machtvakuum. Statt der erhofften Freiheit folgten 13 weitere Jahre blutiger Bürgerkriege.',
      keyInsight: 'Man kann einen Alleinherrscher mit Dolchen beseitigen, aber nicht die strukturellen Bedingungen, die nach einer Zentralgewalt verlangen.'
    },
    {
      cardArchetype: 'expanding_brain_meme',
      title: 'Die Kunst der Machtverschleierung: Caesar vs. Augustus',
      subtitle: '4-Stufen Konzept-Meme: Warum Caesar ermordet wurde und Augustus 41 Jahre regierte',
      feedText: 'Caesar zeigte seine Alleinherrschaft offen und demütigte den Senat. Sein Adoptivsohn Octavian (Augustus) zog daraus die entscheidende Lehre für die Gründung des Prinzipats (27 v. Chr.).',
      body: 'Im Januar 27 v. Chr. gab Octavian in einem meisterhaften politischen Schauspiel formal alle außerordentlichen Gewalten an Senat und Volk von Rom zurück („res publica restituta“). Gleichzeitig behielt er die tribunizische Gewalt (Veto- & Initiativrecht) sowie das Oberkommando über fast alle Grenzprovinzen mit den dort stationierten Legionen.',
      keyInsight: 'Augustus herrschte absolut, indem er sich niemals König oder Diktator nannte, sondern „Princeps“ (Erster Bürger) unter Wahrung republikanischer Fassaden.',
      escalationStages: [
        {
          stageLabel: 'Stufe 1 · Offene Monarchie',
          caption: 'SICH ZUM KÖNIG KRÖNEN LASSEN → SOFORTIGER STURZ',
          visualLevel: 1
        },
        {
          stageLabel: 'Stufe 2 · Julius Caesar (44 v. Chr.)',
          caption: 'OFFEN „DIKTATOR AUF LEBENSZEIT“ NENNEN → 23 DOLCHSTICHE IM SENAT',
          visualLevel: 2
        },
        {
          stageLabel: 'Stufe 3 · Octavian (27 v. Chr.)',
          caption: 'FORMAL „DIE REPUBLIK WIEDERHERSTELLEN“ UND SICH NUR „ERSTER BÜRGER“ NENNEN',
          visualLevel: 3
        },
        {
          stageLabel: 'Stufe 4 · Das Prinzipat des Augustus',
          caption: 'ALLE LEGIONEN + DAS TRIBUNIZISCHE VETO KONTROLLIEREN UND 41 JAHRE FRIEDLICH ALS KAISER REGIEREN',
          visualLevel: 4
        }
      ]
    },
    {
      cardArchetype: 'discourse_replies',
      title: 'Pax Augusta: Friedensordnung oder Friedhofsruhe der Freiheit?',
      subtitle: 'Die historische Bilanz des augusteischen Prinzipats im Urteil von Tacitus',
      feedText: 'Nach 100 Jahren Bürgerkrieg bringt Augustus dem Reich Frieden, Rechtssicherheit in den Provinzen und kulturelle Blüte (Vergil, Horaz, Ovid).\n\nDoch der Historiker Tacitus urteilt kühl: Augustus habe „alle mit der Süße des Friedens geködert“, während die politische Freiheit der Republik erlosch.',
      body: 'Für die Bewohner der Provinzen war das Ende der Republik oft ein Segen: Statt jährlich wechselnder Statthalter, die ihre Provinz in einem Jahr maximal ausplünderten, um ihre Wahlschulden in Rom zu bezahlen, schuf Augustus eine langfristig kontrollierte Reichsverwaltung und eine Berufsarmee mit fester staatlicher Pensionskasse (aerarium militare, 6 n. Chr.). Für die römische Senatselite hingegen bedeutete das Prinzipat das Ende freier politischer Selbstbestimmung.',
      keyInsight: 'Das Prinzipat löste das Strukturproblem der Veteranenversorgung und Provinzausbeutung – um den Preis der republikanischen Freiheit.',
      simulatedReplies: [
        {
          handle: 'u/tacitus_leser',
          roleBadge: '🔍 Quellen-Blick',
          text: 'Tacitus (Annalen 1,2) bringt die Psychologie auf den Punkt: Niemand widersetzte sich, weil die Kühnsten in den Schlachten gefallen waren und die Übrigen merkten, dass Gehorsam schneller zu Reichtum und Ämtern führte als Freiheit.',
          upvotes: 84
        },
        {
          handle: 'u/provinz_perspektive',
          roleBadge: '⚡ Perspektivwechsel',
          text: 'Die „Freiheit der Republik“ war im 1. Jh. v. Chr. vor allem die Freiheit von 300 Senatorenfamilien, die Mittelmeerwelt ungestraft auszuplündern. Für Millionen Provinzbewohner brachte erst das Kaisertum Rechtsschutz.',
          upvotes: 71
        },
        {
          handle: 'u/system_synthese',
          roleBadge: '🛠️ Struktur-Lösung',
          text: 'Erst mit dem aerarium militare (6 n. Chr.) beendete Augustus die Wurzel des Übels: Die Staatskasse zahlte Veteranenabfindungen direkt aus Steuergeldern, sodass Legionäre nicht mehr von Beutefeldzügen ihrer Generäle abhingen.',
          upvotes: 66
        }
      ]
    },
    {
      cardArchetype: 'milestone_quiz',
      title: 'Abschluss-Synthese: Das Geheimnis der augusteischen Verfassung',
      subtitle: 'Meilenstein 12/12 · Meistere den gesamten Lernpfad',
      feedText: 'Du hast alle Etappen von der Krise der Gracchen über Marius, Sulla und Caesar bis zum Prinzipat des Augustus durchdrungen. Teste zum Abschluss die zentrale Verfassungsmechanik.',
      body: 'Augustus verband traditionelle republikanische Ämterbegriffe mit faktischer militärischer und gesetzgeberischer Alleinherrschaft. Durch die Trennung von Ehrenrang (auctoritas) und konkreten Einzelvollmachten (tribunicia potestas + imperium proconsulare maius) vermied er die Provokation einer offenen Diktatur.',
      keyInsight: 'Dauerhafte institutionelle Transformationen gelingen oft dann, wenn radikaler Wandel im Gewand vertrauter Tradition auftritt.',
      quiz: {
        question: 'Durch welche strukturelle Maßnahme entschärfte Augustus langfristig das Problem der rebellierenden Klientel-Armeen?',
        options: [
          'Er richtete eine feste staatliche Militärpensionskasse (aerarium militare) ein und behielt das Oberkommando über die Grenzprovinzen.',
          'Er schaffte das stehende Berufsheer komplett ab und kehrte zum Bauernmilizheer zurück.',
          'Er übertrug dem Senat die alleinige Befehlsgewalt über alle 28 Legionen.',
          'Er verlegte die Hauptstadt des Reiches sofort von Rom nach Konstantinopel.'
        ],
        correctIndex: 0,
        explanation: 'Durch das Oberkommando über die kaiserlichen Grenzprovinzen und die staatliche Pensionskasse (aerarium militare, 6 n. Chr.) waren Soldaten wieder direkt an den Princeps und den Staat gebunden statt an konkurrierende Senatsgeneräle.'
      }
    }
  ];

  const romanItems = romanBlueprints.map((bp, idx) =>
    buildHivemindFeedItem({
      trackId: romanTrackId,
      trackTitle: romanTitle,
      stepIndex: idx + 1,
      totalSteps: romanBlueprints.length,
      topic: 'science_society',
      sourceLabel: 'Alte Geschichte · Römische Republik',
      sourceUrl: 'https://de.wikipedia.org/wiki/R%C3%B6mische_Republik',
      blueprint: bp,
      aiAssisted: false
    })
  );

  // Track 2: Quantenphysik & Realität — 12 Cards
  const quantumTrackId = 'track-quantum-reality';
  const quantumTitle = 'Quantenphysik & Realität (Von Planck bis Bell)';
  const quantumBlueprints: HivemindCardBlueprint[] = [
    {
      cardArchetype: 'story_thread',
      title: 'Max Plancks Akt der Verzweiflung (1900): Energie ist gequantelt',
      subtitle: 'Wie ein Rechentrick gegen die Ultraviolett-Katastrophe die klassische Physik sprengte',
      feedText: 'Ende des 19. Jahrhunderts scheitert die klassische Physik an einer scheinbar simplen Frage: Warum strahlt ein glühender Ofen bei hohen Frequenzen nicht unendlich viel Energie ab („Ultraviolett-Katastrophe“)?\n\nMax Planck findet 1900 die Formel – aber nur unter einer radikalen Annahme: Energie wird nicht kontinuierlich wie ein Wasserstrahl abgegeben, sondern in unteilbaren Paketen (Quanten) $E = h \\cdot f$.',
      body: 'Max Planck hielt seine eigene Quantenhypothese zunächst für einen rein mathematischen Kunstgriff. Doch Albert Einstein nahm Plancks Wirkungsquantum $h$ 1905 beim Wort: Beim photoelektrischen Effekt zeigte Einstein, dass Licht selbst aus diskreten Energiepaketen (Photonen) besteht. Selbst extrem intensives rotes Licht kann kein einziges Elektron aus einer Metallplatte lösen, während schwaches ultraviolettes Licht es sofort schafft – weil die Energie jedes einzelnen Photons nur von seiner Frequenz abhängt.',
      keyInsight: 'Auf der fundamentalen Ebene der Natur ist Energie nicht stetig, sondern in diskrete Portionen ($E = h \\cdot f$) gestückelt.'
    },
    {
      cardArchetype: 'expanding_brain_meme',
      title: 'Vom Uhrwerk-Universum zur Quanten-Verschränkung',
      subtitle: '4-Stufen Konzept-Meme: Unser Verständnis physikalischer Realität',
      feedText: 'Jede Generation der Physik musste eine noch tiefere Intuition der Alltagswelt aufgeben: von Newtons absolutem Raum bis zum Sturz des lokalen Realismus.',
      body: 'Während die klassische Mechanik davon ausging, dass jedes Teilchen zu jedem Zeitpunkt einen exakt bestimmten Ort und Impuls besitzt (Laplacescher Dämon), zeigt die Quantenmechanik, dass Eigenschaften vor einer Wechselwirkung in einer Überlagerung (Superposition) existieren und über beliebige Distanzen korreliert sein können.',
      keyInsight: 'Die Natur ist auf fundamentaler Ebene weder ein deterministisches Uhrwerk noch lokal isoliert.',
      escalationStages: [
        {
          stageLabel: 'Stufe 1 · Klassische Mechanik (Newton)',
          caption: 'TEILCHEN SIND KLEINE BILLARDKUGELN MIT FESTEM ORT UND FESTER BAHN',
          visualLevel: 1
        },
        {
          stageLabel: 'Stufe 2 · Welle-Teilchen-Dualismus (De Broglie)',
          caption: 'ELEKTRONEN UND PHOTONEN VERHALTEN SICH GLEICHZEITIG WIE WELLEN UND TEILCHEN',
          visualLevel: 2
        },
        {
          stageLabel: 'Stufe 3 · Superposition (Schrödinger & Born)',
          caption: 'EIN QUANTENSYSTEM EXISTIERT IN EINER ÜBERLAGERUNG ALLER MÖGLICHEN ZUSTÄNDE BIS ZUR MESSUNG',
          visualLevel: 3
        },
        {
          stageLabel: 'Stufe 4 · Bell-Tests & Verschränkung (Aspect / Zeilinger)',
          caption: 'VERSCHRÄNKTE QUANTEN HABEN KEINE LOKAL VORAB FESTGELEGTEN EIGENSCHAFTEN – LOKALER REALISMUS IST WIDERLEGT',
          visualLevel: 4
        }
      ]
    },
    {
      cardArchetype: 'discourse_replies',
      title: 'Das Doppelspalt-Experiment mit einzelnen Elektronen',
      subtitle: 'Warum interferiert ein einzelnes Elektron mit sich selbst – und hört sofort auf, wenn man hinschaut?',
      feedText: 'Schießt man Elektronen einzeln nacheinander durch einen Doppelspalt, landet jedes Elektron als einzelner Punkt auf dem Schirm.\n\nDoch nach tausenden einzelnen Elektronen entsteht ein Streifenmuster (Interferenz) – als wäre jedes Elektron durch beide Spalte gleichzeitig gegangen! Sobald man jedoch am Spalt misst, welchen Weg das Elektron nimmt, verschwindet das Interferenzmuster komplett.',
      body: 'Das Doppelspalt-Experiment (Richard Feynman nannte es „das einzige Mysterium der Quantenmechanik“) zeigt die Komplementarität von Welcher-Weg-Information und Interferenzfähigkeit. Solange keine Wechselwirkung verrät, durch welchen Spalt das Quantenobjekt tritt, addieren sich die komplexen Wahrscheinlichkeitsamplituden beider Wege.',
      keyInsight: 'Sobald Information über den Weg eines Quantenobjekts in der Umgebung gespeichert wird, bricht die Interferenz der Möglichkeiten zusammen.',
      simulatedReplies: [
        {
          handle: 'u/quanten_didaktik',
          roleBadge: '🔍 Präzisierung',
          text: 'Wichtig gegen Esoterik-Mythen: Nicht das „menschliche Bewusstsein“ des Beobachters lässt die Wellenfunktion kollabieren, sondern jede physikalische Wechselwirkung (z. B. ein gestreutes Photon am Spalt), die Weginformation hinterlässt.',
          upvotes: 92
        },
        {
          handle: 'u/feynman_pfad',
          roleBadge: '⚡ Pfadintegral-Sicht',
          text: 'In Feynmans Pfadintegral-Formulierung erkundet das Quantenobjekt simultan alle denkbaren Pfade von der Quelle zum Detektor; nur dort, wo sich die Phasen konstruktiv überlagern, entsteht hohe Nachweiswahrscheinlichkeit.',
          upvotes: 67
        },
        {
          handle: 'u/experiment_praxis',
          roleBadge: '🛠️ Quantenradierer',
          text: 'Noch verblüffender beim Quantenradierer: Löscht man die Welcher-Weg-Information nachträglich unumkehrbar aus, taucht das Interferenzmuster in den korrelierten Daten wieder auf!',
          upvotes: 58
        }
      ]
    },
    {
      cardArchetype: 'milestone_quiz',
      title: 'Meilenstein-Check: Photoeffekt & Doppelspalt',
      subtitle: 'Überprüfe die Grundlagen der Quantenmechanik',
      feedText: 'Teste dein Verständnis zu Plancks Quantenhypothese und dem Verhalten von Quantenobjekten am Doppelspalt.',
      body: 'Die Entdeckung, dass sowohl Strahlung (Photonen) als auch Materie (Elektronen, Atome, sogar Fulleren-Moleküle) Welleneigenschaften bei der Ausbreitung und Teilcheneigenschaften bei der Absorption zeigen, bildet das Fundament der modernen Physik.',
      keyInsight: 'Ausbreitung erfolgt nach Wellengesetzen (Schrödinger-Gleichung), Wechselwirkung und Detektion erfolgen lokalisiert in Quantenpaketen.',
      quiz: {
        question: 'Was passiert beim Doppelspalt-Experiment mit einzelnen Elektronen, sobald ein Detektor am Spalt misst, durch welchen der beiden Spalte jedes Elektron fliegt?',
        options: [
          'Das Interferenzmuster verschwindet und es entstehen zwei klassische Häufungsstreifen hinter den beiden Spalten.',
          'Das Interferenzmuster wird doppelt so scharf und kontrastreich.',
          'Die Elektronen bleiben im Spalt stecken und erreichen den Schirm nicht mehr.',
          'Die Elektronen verwandeln sich vollständig in sichtbares grünes Laserlicht.'
        ],
        correctIndex: 0,
        explanation: 'Welcher-Weg-Information und Interferenzmuster schließen sich komplementär aus: Sobald durch Wechselwirkung feststeht, welchen Spalt das Elektron passiert hat, überlagern sich die beiden Teilwellen nicht mehr kohärent.'
      }
    },
    {
      cardArchetype: 'story_thread',
      title: 'Heisenbergs Unschärferelation (1927): Keine Messungenauigkeit, sondern eine Eigenschaft der Natur',
      subtitle: 'Warum Ort und Impuls eines Teilchens prinzipiell niemals gleichzeitig scharf existieren',
      feedText: 'Ein häufiges Missverständnis lautet: „Wir können Ort und Geschwindigkeit eines Elektrons nur deshalb nicht gleichzeitig messen, weil unser Messgerät das Elektron anstößt.“\n\nDie Wahrheit ist viel radikaler: Ein Quantenobjekt *besitzt* schlicht keinen gleichzeitig scharf definierten Ort $x$ und Impuls $p$. Es gilt fundamental $\\Delta x \\cdot \\Delta p \\ge \\frac{\\hbar}{2}$.',
      body: 'Mathematisch folgt die Heisenbergsche Unschärferelation direkt aus den Eigenschaften von Wellenpaketen (Fourier-Transformation): Eine Welle mit exakt einer einzigen Wellenlänge (also exakt definiertem Impuls $p = h / \\lambda$) ist unendlich weit im Raum ausgedehnt – ihr Ort ist völlig unbestimmt. Will man das Wellenpaket hingegen auf einen winzigen Raumpunkt schnüren, muss man unendlich viele verschiedene Wellenlängen (Impulse) überlagern.',
      keyInsight: 'Die Unschärferelation ist keine technische Grenze unserer Messinstrumente, sondern eine ontologische Eigenschaft von Quantenzuständen.'
    },
    {
      cardArchetype: 'expanding_brain_meme',
      title: 'Schrödingers Katze & das Messproblem',
      subtitle: '4-Stufen Konzept-Meme: Wie aus Quanten-Überlagerung unsere eindeutige Alltagswelt wird',
      feedText: 'Erwin Schrödinger erfand sein Gedankenexperiment 1935 nicht, um die Quantenmechanik zu feiern, sondern um zu zeigen, wie absurd es wäre, wenn mikroskopische Superposition auf makroskopische Katzen übertragen würde.',
      body: 'Heute erklärt die Dekohärenztheorie (H. Dieter Zeh, Wojciech Zurek), warum wir im Alltag niemals gleichzeitig lebende und tote Katzen sehen: Ein makroskopisches Objekt steht in jeder Billiardstel Sekunde mit Milliarden Luftmolekülen und Wärmephotonen in Wechselwirkung. Dadurch verschränkt sich der Zustand blitzschnell mit der Umwelt und verliert seine Interferenzfähigkeit.',
      keyInsight: 'Dekohärenz durch Umweltwechselwirkung zerstört makroskopische Überlagerungszustände in unmessbar kurzer Zeit.',
      escalationStages: [
        {
          stageLabel: 'Stufe 1 · Populärer Mythos',
          caption: 'DIE KATZE IST SOLANGE GLEICHZEITIG TOT UND LEBENDIG, BIS EIN MENSCH DIE KISTE ÖFFNET',
          visualLevel: 1
        },
        {
          stageLabel: 'Stufe 2 · Schrödingers eigentliche Absicht (1935)',
          caption: 'DAS GEDANKENEXPERIMENT SOLLTE ZEIGEN, DASS DIE KOPENHAGENER DEUTUNG UNVOLLSTÄNDIG WIRKT',
          visualLevel: 2
        },
        {
          stageLabel: 'Stufe 3 · Umwelt-Dekohärenz (Zeh & Zurek)',
          caption: 'LUFTMOLEKÜLE UND WÄRMESTRAHLUNG „MESSEN“ DIE KATZE IN 10⁻²⁰ SEKUNDEN LANG VOR DEM ÖFFNEN DER KISTE',
          visualLevel: 3
        },
        {
          stageLabel: 'Stufe 4 · Moderne Quanten-Technologie',
          caption: 'QUANTENCOMPUTER MÜSSEN BEI NAHEZU 0 KELVIN IM ULTRAHOCHVAKUUM GEGEN DEKOHÄRENZ ABGESCHIRMT WERDEN',
          visualLevel: 4
        }
      ]
    },
    {
      cardArchetype: 'discourse_replies',
      title: 'Einsteins Angriff (EPR-Paradoxon 1935): „Gott würfelt nicht“',
      subtitle: 'Einstein, Podolsky und Rosen fordern „verborgene Variablen“ hinter der Quantenmechanik',
      feedText: 'Einstein akzeptiert die Vorhersagekraft der Quantenmechanik, hält sie aber für unvollständig.\n\nSein Argument mit zwei verschränkten Teilchen: Wenn eine Messung an Teilchen A auf der Erde sofort den Zustand von Teilchen B auf dem Mond festlegt, müsste es entweder „spukhafte Fernwirkung“ geben – oder die Eigenschaften standen schon beim Start als verborgene Variablen fest.',
      body: '1935 veröffentlichten Albert Einstein, Boris Podolsky und Nathan Rosen (EPR) ihre berühmte Arbeit: Unter der Annahme des „lokalen Realismus“ (1. Lokalität: Keine Wirkung breitet sich schneller als das Licht aus; 2. Realismus: Physikalische Eigenschaften existieren unabhängig von der Messung) schlossen sie, dass den Teilchen schon bei ihrer Erzeugung ein geheimer „Laufzettel“ (verborgene Variablen) mitgegeben worden sein müsse.',
      keyInsight: 'Einstein stellte die Physik vor die Wahl: Entweder gibt es lokale verborgene Variablen, oder der lokale Realismus fällt.',
      simulatedReplies: [
        {
          handle: 'u/bohr_antwort',
          roleBadge: '🔍 Niels Bohrs Replik',
          text: 'Bohr erwiderte: Zwei verschränkte Teilchen sind kein Paar unabhängiger Dinge, sondern ein einziges unteilbares Quantensystem, das durch eine gemeinsame Wellenfunktion beschrieben wird – egal wie weit sie räumlich getrennt sind.',
          upvotes: 74
        },
        {
          handle: 'u/relativitaets_check',
          roleBadge: '⚡ Kein Überlicht-Telefon',
          text: 'Verletzt Verschränkung Einsteins Relativitätstheorie? Nein (No-Communication-Theorem)! Da das einzelne Messergebnis bei A rein zufällig ist, kann man damit keine Nachrichten schneller als das Licht übertragen; erst beim Vergleich beider Messprotokolle zeigt sich die Korrelation.',
          upvotes: 89
        },
        {
          handle: 'u/bell_wendepunkt',
          roleBadge: '🛠️ Von Philosophie zu Physik',
          text: 'Fast 30 Jahre lang galt der Streit zwischen Einstein und Bohr als unentscheidbare Philosophie – bis John Stewart Bell 1964 eine mathematische Ungleichung fand, die das Experiment entscheiden ließ.',
          upvotes: 63
        }
      ]
    },
    {
      cardArchetype: 'milestone_quiz',
      title: 'Meilenstein-Check: Unschärfe, Dekohärenz & EPR',
      subtitle: 'Überprüfe dein Wissen zu den Grundlagen-Debatten',
      feedText: 'Teste dein Verständnis zur Dekohärenz und zum EPR-Gedankenexperiment.',
      body: 'Die Dekohärenz erklärt das Verschwinden von Interferenztermen durch Kopplung an die Umgebung, während das EPR-Paradoxon die Nichtlokalität verschränkter Zustände ins Zentrum rückte.',
      keyInsight: 'Dekohärenz macht Quantensysteme klassisch erscheinend; Verschränkung verbindet Teilzustände über räumliche Distanzen.',
      quiz: {
        question: 'Warum lassen sich mit quantenverschränkten Teilchen trotz sofortiger Korrelation keine Nachrichten schneller als das Licht übertragen?',
        options: [
          'Weil das einzelne Messergebnis auf jeder Seite vollkommen zufällig ausfällt und die Korrelation erst beim nachträglichen Vergleich der Messreihen über einen klassischen Kanal sichtbar wird.',
          'Weil verschränkte Photonen sich im Vakuum nur mit halber Lichtgeschwindigkeit bewegen.',
          'Weil die Verschränkung nach maximal 10 Metern Entfernung automatisch abbricht.',
          'Weil man verschränkte Teilchen prinzipiell nicht messen kann.'
        ],
        correctIndex: 0,
        explanation: 'Gemäß dem No-Communication-Theorem sieht jeder Beobachter für sich genommen ein Zufallsrauschen (50/50). Erst wenn beide ihre Ergebnisse auf klassischem Weg (maximal mit Lichtgeschwindigkeit) abgleichen, wird die Quantenkorrelation erkennbar.'
      }
    },
    {
      cardArchetype: 'story_thread',
      title: 'John Bells Ungleichung (1964) & der Nobelpreis 2022: Einstein hatte unrecht',
      subtitle: 'Wie Clauser, Aspect und Zeilinger bewiesen, dass die Natur keine geheimen Spickzettel nutzt',
      feedText: '1964 beweist der Physiker John Stewart Bell mathematisch: Wenn Teilchen tatsächlich vorab festgelegte „verborgene Eigenschaften“ mit sich tragen (wie Einstein glaubte), dürfen ihre Messkorrelationen bei schrägen Detektorwinkeln eine strikte Obergrenze niemals überschreiten (Bellsche Ungleichung).\n\nDie Quantenmechanik sagt jedoch voraus: Verschränkte Teilchen durchbrechen diese Grenze!',
      body: 'Ab den 1970er Jahren führten John Clauser, Alain Aspect und Anton Zeilinger immer präzisere Experimente mit verschränkten Photonen durch – selbst unter Schließung aller Schlupflöcher (Wahl der Messeinstellungen während die Photonen schon im Flug sind). Das Ergebnis war eindeutig: Die Bellsche Ungleichung wird verletzt, exakt wie von der Quantenmechanik vorhergesagt. 2022 erhielten Clauser, Aspect und Zeilinger dafür den Physik-Nobelpreis. Die Konsequenz: Lokale verborgene Variablen sind experimentell widerlegt.',
      keyInsight: 'Die Verletzung der Bellschen Ungleichung beweist experimentell: Verschränkte Teilchen tragen keine lokal vorab festgelegten Messwerte in sich.'
    },
    {
      cardArchetype: 'expanding_brain_meme',
      title: 'Die großen Interpretationen der Quantenmechanik im Vergleich',
      subtitle: '4-Stufen Konzept-Meme: Was bedeutet der mathematische Formalismus für die Wirklichkeit?',
      feedText: 'Alle Physiker rechnen mit exakt derselben Schrödinger-Gleichung. Doch was die Gleichung über die Realität aussagt, spaltet die Grundlagenphysik bis heute in faszinierende Lager.',
      body: 'Von der pragmatischen Kopenhagener Deutung über Hugh Everetts Viele-Welten-Interpretation (keine Kollaps-Postulate, sondern Verzweigung des Gesamtzustands) bis zu Bohms nichtlokaler Führungswelle und Carlo Rovellis Relationaler Quantenmechanik RQM: Jede Interpretation zahlt an einer anderen Stelle einen philosophischen Preis.',
      keyInsight: 'Jede Interpretation der Quantenmechanik muss mindestens eine klassische Alltagsannahme (Lokalität, Eindeutigkeit oder Beobachterunabhängigkeit) opfern.',
      escalationStages: [
        {
          stageLabel: 'Stufe 1 · Instrumentalistisch',
          caption: '„SHUT UP AND CALCULATE!“ – DIE GLEICHUNGEN FUNKTIONIEREN, FRAG NICHT WAS DAHINTER STECKT',
          visualLevel: 1
        },
        {
          stageLabel: 'Stufe 2 · Kopenhagener Deutung (Bohr / Heisenberg)',
          caption: 'VOR DER MESSUNG GIBT ES NUR WAHRSCHEINLICHKEITEN; DIE MESSUNG ERZEUGT DAS FAKKTISCHE ERGEBNIS',
          visualLevel: 2
        },
        {
          stageLabel: 'Stufe 3 · Relationale Quantenmechanik (Rovelli)',
          caption: 'EIGENSCHAFTEN EXISTIEREN NICHT ABSOLUT, SONDERN IMMER NUR RELATIV ZU EINEM WECHSELWIRKENDEN SYSTEM',
          visualLevel: 3
        },
        {
          stageLabel: 'Stufe 4 · Viele-Welten-Theorie (Everett)',
          caption: 'DIE WELLENFUNKTION KOLLABIERT NIE – BEI JEDER QUANTENENTSCHEIDUNG REALISIEREN SICH ALLE ZWEIGE DES MULTIVERSUMS',
          visualLevel: 4
        }
      ]
    },
    {
      cardArchetype: 'discourse_replies',
      title: 'Vom Gedankenexperiment zur Technologie: Quantencomputer & Quantenkryptographie',
      subtitle: 'Wie Qubits Superposition und Verschränkung als Rechenressource nutzen',
      feedText: 'Während ein klassisches Bit entweder $0$ oder $1$ ist, befindet sich ein Qubit in einer komplexen Superposition $\\alpha|0\\rangle + \\beta|1\\rangle$.\n\nBei $n$ verschränkten Qubits wächst der Zustandsraum mit $2^n$: Schon 300 verschränkte Qubits spannen mehr Zustandsdimensionen auf, als es Atome im sichtbaren Universum gibt.',
      body: 'Ein Quantencomputer probiert nicht einfach „alle Lösungen gleichzeitig durch und liest sie aus“ – denn beim Auslesen kollabiert der Zustand zu einem einzigen Ergebnis. Stattdessen nutzen Quantenalgorithmen (wie Shors Faktorisierungsalgorithmus oder Grovers Suchalgorithmus) gezielte Quanteninterferenz: Falsche Rechenpfade löschen sich durch destruktive Interferenz gegenseitig aus, während sich die korrekte Lösung konstruktiv verstärkt.',
      keyInsight: 'Quantencomputer rechnen durch gesteuerte Interferenz: Falsche Pfade löschen sich aus, richtige verstärken sich.',
      simulatedReplies: [
        {
          handle: 'u/algorithmus_klarheit',
          roleBadge: '🔍 Häufiger Irrtum',
          text: 'Viele populäre Artikel behaupten, ein Quantencomputer rechne einfach alle Möglichkeiten parallel und gebe sofort das Ergebnis aus. In Wahrheit ist die Kunst das Interferenz-Design vor der Messung!',
          upvotes: 81
        },
        {
          handle: 'u/krypto_sicherheit',
          roleBadge: '⚡ RSA vs. Post-Quantum',
          text: 'Mit genügend fehlertoleranten Qubits knackt Shors Algorithmus klassische RSA-Verschlüsselung. Umgekehrt ermöglicht Quantenschlüsselaustausch (QKD) physikalisch abhörsichere Kommunikation, weil jedes Lauschen die Verschränkung stört.',
          upvotes: 69
        },
        {
          handle: 'u/physik_anwendung',
          roleBadge: '🛠️ Der wahre Hebel',
          text: 'Richard Feynmans ursprüngliche Vision (1981): Die Natur ist quantenmechanisch – also brauchen wir Quantensimulatoren, um komplexe Moleküle, Katalysatoren und neue Medikamente exakt zu berechnen.',
          upvotes: 75
        }
      ]
    },
    {
      cardArchetype: 'milestone_quiz',
      title: 'Abschluss-Synthese: Bellsche Ungleichung & Quanteninformatik',
      subtitle: 'Meilenstein 12/12 · Meistere den gesamten Quantenphysik-Pfad',
      feedText: 'Du hast den Bogen von Plancks Wirkungsquantum über Doppelspalt, Unschärfe und Dekohärenz bis zu Bells Theorem und Quantencomputern gespannt. Teste dein Abschlusswissen!',
      body: 'Die experimentelle Verletzung der Bellschen Ungleichungen hat gezeigt, dass Quantenkorrelationen stärker sind als alles, was klassische lokale Theorien erlauben. Genau diese Verschränkung und Interferenz bilden heute die Grundlage der zweiten Quantenrevolution.',
      keyInsight: 'Was Einstein 1935 noch als „spukhaft“ ablehnte, ist heute das experimentell bestbestätigte Fundament moderner Quantentechnologie.',
      quiz: {
        question: 'Was wurde durch die Experimente zur Verletzung der Bellschen Ungleichung (Clauser, Aspect, Zeilinger – Nobelpreis 2022) widerlegt?',
        options: [
          'Die Annahme des lokalen Realismus, wonach Teilchen bereits vor der Messung lokal festgelegte „verborgene Variablen“ für alle Messausgänge in sich tragen.',
          'Die Gültigkeit der Energieerhaltung bei Lichtquanten.',
          'Die Existenz von Elektronen und Photonen.',
          'Dass Licht im Vakuum eine endliche Geschwindigkeit besitzt.'
        ],
        correctIndex: 0,
        explanation: 'Die Verletzung der Bellschen Ungleichung zeigt, dass keine Theorie lokaler verborgener Variablen die Vorhersagen der Quantenmechanik und die experimentellen Messdaten reproduzieren kann.'
      }
    }
  ];

  const quantumItems = quantumBlueprints.map((bp, idx) =>
    buildHivemindFeedItem({
      trackId: quantumTrackId,
      trackTitle: quantumTitle,
      stepIndex: idx + 1,
      totalSteps: quantumBlueprints.length,
      topic: 'science_society',
      sourceLabel: 'Quantenphysik & Erkenntnistheorie',
      sourceUrl: 'https://de.wikipedia.org/wiki/Quantenmechanik',
      blueprint: bp,
      aiAssisted: false
    })
  );

  return [
    {
      id: romanTrackId,
      title: romanTitle,
      subtitle: `${romanItems.length} Karten · Geschichte & Staatsphilosophie`,
      iconEmoji: '🏛️',
      sourceType: 'topic',
      sourceLabel: 'Themen-Curriculum: Römische Republik & Prinzipat',
      createdAt,
      updatedAt: createdAt,
      mixIntoMainFeed: true,
      completedItemIds: [],
      totalItemsCount: romanItems.length,
      progressPercent: 0,
      items: romanItems,
      currentChapterIndex: 1,
      chapters: [
        {
          chapterIndex: 1,
          title: 'Kapitel 1: Von den Gracchen bis Augustus (Krise der Republik)',
          focusPromptOrChunk: 'Agrarkrise der Gracchen, Heeresreform des Marius, Sullas Diktatur, Caesar am Rubikon und der Prinzipat des Augustus.',
          isGenerated: true
        },
        {
          chapterIndex: 2,
          title: 'Kapitel 2: Pax Romana, Julisch-Claudische Dynastie & Stoische Staatsethik',
          focusPromptOrChunk: 'Tiberius bis Nero, Senatsopposition, Seneca und Marc Aurel, Reichsverwaltung, Limes und Urbanisierung der Provinzen.',
          isGenerated: false
        },
        {
          chapterIndex: 3,
          title: 'Kapitel 3: Soldatenkaiser, Spätantike & Erbe des Römischen Rechts',
          focusPromptOrChunk: 'Reichskrise des 3. Jahrhunderts, Diokletians Tetrarchie, Konstantinische Wende, Corpus Iuris Civilis und republikanisches Erbe in der Moderne.',
          isGenerated: false
        },
        {
          chapterIndex: 4,
          title: 'Kapitel 4: Verfassungsvergleich — Rom, Weimar & moderne Gewaltenteilung',
          focusPromptOrChunk: 'Polybius’ Mischverfassung, Notstandsrecht, Populismus, Institutionenerosion und Lehren für demokratische Resilienz.',
          isGenerated: false
        }
      ]
    },
    {
      id: quantumTrackId,
      title: quantumTitle,
      subtitle: `${quantumItems.length} Karten · Physik & Erkenntnistheorie`,
      iconEmoji: '⚛️',
      sourceType: 'book',
      sourceLabel: 'Buch- & Konzept-Pfad: Quantenmechanik',
      createdAt,
      updatedAt: createdAt,
      mixIntoMainFeed: false,
      completedItemIds: [],
      totalItemsCount: quantumItems.length,
      progressPercent: 0,
      items: quantumItems,
      currentChapterIndex: 1,
      chapters: [
        {
          chapterIndex: 1,
          title: 'Kapitel 1: Von Plancks Wirkungsquantum bis zu Bells Theorem',
          focusPromptOrChunk: 'Welle-Teilchen-Dualismus, Doppelspalt, Heisenbergs Unschärferelation, Schrödingers Katze, Dekohärenz und Verletzung der Bellschen Ungleichung.',
          isGenerated: true
        },
        {
          chapterIndex: 2,
          title: 'Kapitel 2: Quantenfeldtheorie, Standardmodell & Symmetriebrechung',
          focusPromptOrChunk: 'Dirac-Gleichung, Antimaterie, Quantenelektrodynamik (Feynman-Pfadintegrale), Eichsymmetrien und Higgs-Mechanismus.',
          isGenerated: false
        },
        {
          chapterIndex: 3,
          title: 'Kapitel 3: Quanteninformation, Fehlerkorrektur & Topologische Qubits',
          focusPromptOrChunk: 'Bloch-Kugel, Quantengatter, Shor- und Grover-Algorithmus, Oberflächen-Codes zur Quantenfehlerkorrektur und Quantenkryptographie.',
          isGenerated: false
        },
        {
          chapterIndex: 4,
          title: 'Kapitel 4: Interpretationen der Quantenmechanik & Naturphilosophie',
          focusPromptOrChunk: 'Kopenhagener Deutung vs. Everett-Viele-Welten, De-Broglie-Bohm-Führungswellen, QBismus und das Messproblem aus erkenntnistheoretischer Sicht.',
          isGenerated: false
        }
      ]
    }
  ];
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
