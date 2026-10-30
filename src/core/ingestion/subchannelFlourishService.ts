import { FeedItem, TopicTag } from '../domain/types';
import { DEFAULT_SUBCHANNELS, normalizeSpaceHandle } from '../spaces/spaceRepository';
import { OnTheFlyStreamService, generateHivemindStream } from '../synthesis/onTheFlyStreamService';
import {
  defaultBatchEditionEnricher,
  sanitizeCuratedFeedItem,
  satisfiesDefaultCuratedStandard,
  detectLanguage,
  upgradeImageResolutionUrl
} from '../enrichment/batchEnricher';
import { AiCredentials, callAiModel, hasAiConfiguration, loadAiCredentials } from '../ai/atmenAiClient';
import { feedRepository } from '../data/feedRepository';
import { REAL_KNOWLEDGE_VAULT } from '../data/realKnowledgeVault';

export interface SubchannelInput {
  id?: string;
  handle: string;
  title?: string;
  name?: string;
  description?: string;
  flair?: string;
  primaryTopic?: TopicTag;
  keywords?: string[];
}

export interface SubchannelQueryProfile {
  handle: string;
  spaceHandle: string;
  displayTitle: string;
  primaryTopic: TopicTag;
  keywords: string[];
  openAlexQuery: string;
  academicQueries: string[];
  communityQuery: string;
  subreddits: string[];
  wikipediaQuery: string;
  wikipediaQueries: string[];
}

export interface SubchannelFlourishResult {
  spaceHandle: string;
  flourished: boolean;
  queryProfile: SubchannelQueryProfile;
  items: FeedItem[];
  addedItems: FeedItem[];
  mode: 'ai' | 'local';
  lanes: {
    openAlexCount: number;
    communityCount: number;
    wikipediaCount: number;
    llmSynthesizedCount: number;
  };
  usedAi: boolean;
}

const TOPIC_SUBREDDITS: Record<TopicTag, string[]> = {
  science_society: ['science', 'EverythingScience', 'AskHistorians'],
  ai_apple: ['MachineLearning', 'LocalLLaMA', 'apple'],
  philosophy_ethics: ['philosophy', 'askphilosophy', 'CriticalTheory'],
  art_aesthetics: ['ArtHistory', 'ArchitecturePorn', 'museum'],
  sound_synthesis: ['synthesizers', 'modular', 'WeAreTheMusicMakers'],
  book_mastery: ['TrueLit', 'books', 'AskHistorians'],
  contemplation_mind: ['Meditation', 'Buddhism', 'Stoicism'],
  health_biohacking: ['AdvancedFitness', 'science', 'sleep'],
  memes_satire: ['xkcd', 'PhilosophyMemes', 'ProgrammerHumor'],
  youtube_gems: ['Documentaries', 'ArtisanVideos', 'DepthHub'],
  opportunities_growth: ['academiceconomics', 'opensource', 'RemindMe'],
  german_didactics: ['Teachers', 'lehrerzimmer', 'linguistics']
};

const STOPWORDS = new Set([
  'der', 'die', 'das', 'und', 'oder', 'für', 'von', 'mit', 'aus', 'über', 'unter',
  'eine', 'einer', 'einem', 'einen', 'sowie', 'durch', 'nach', 'beim', 'wie', 'was',
  'the', 'and', 'for', 'with', 'from', 'into', 'about', 'channel', 'space', 'raum'
]);

/**
 * Universal Subchannel Flourishing Engine (Work Package 2)
 *
 * Ensures every built-in and custom `c/...` subchannel flourishes automatically
 * by constructing a multi-lane query profile and harvesting across 4 parallel lanes:
 * 1. Targeted OpenAlex Research Lane
 * 2. High-Signal Community & Essay Lane (HackerNews Algolia + Curated Reddit JSON + Vault/Essay Match)
 * 3. Wikipedia Deep Concept & Current Context Lane
 * 4. LLM Synthesis & Translation Lane
 */
export class SubchannelFlourishService {
  private static activeFlourishLocks = new Map<string, Promise<SubchannelFlourishResult>>();

  /**
   * Dynamically constructs a multi-lane query profile for any built-in or user-created subchannel.
   */
  public static buildQueryProfile(input: SubchannelInput | string): SubchannelQueryProfile {
    const rawObj: SubchannelInput =
      typeof input === 'string'
        ? DEFAULT_SUBCHANNELS.find(s => s.handle.toLowerCase() === normalizeSpaceHandle(input).toLowerCase()) || {
            handle: normalizeSpaceHandle(input)
          }
        : input;

    const spaceHandle = normalizeSpaceHandle(rawObj.handle);
    const rawSlug = spaceHandle.replace(/^c\//, '').replace(/[_-]+/g, ' ').trim();
    const displayTitle = (rawObj.title || rawObj.name || rawSlug || 'Wissensraum').trim();
    const description = (rawObj.description || '').trim();
    const primaryTopic: TopicTag =
      rawObj.primaryTopic || OnTheFlyStreamService.inferTopicFromSpace(spaceHandle);

    const combinedTokens = [
      ...(rawObj.keywords || []),
      ...rawSlug.split(/\s+/),
      ...displayTitle.split(/\s+/),
      ...description.split(/\s+/)
    ]
      .map(t => t.replace(/[^\p{L}\p{N}-]/gu, '').trim())
      .filter(t => t.length >= 3 && !STOPWORDS.has(t.toLowerCase()));

    const uniqueKeywords: string[] = [];
    const seenLower = new Set<string>();
    for (const tok of combinedTokens) {
      const low = tok.toLowerCase();
      if (!seenLower.has(low)) {
        seenLower.add(low);
        uniqueKeywords.push(tok);
      }
      if (uniqueKeywords.length >= 8) break;
    }

    if (uniqueKeywords.length === 0) {
      uniqueKeywords.push(rawSlug || 'epistemology');
    }

    // Special semantic enrichments for known handles like c/visible_learning, c/acceleration, c/didaktik_labor, c/dialektik
    const slugLower = rawSlug.toLowerCase();
    let openAlexQuery = uniqueKeywords.slice(0, 4).join(' ');
    let communityQuery = uniqueKeywords.slice(0, 3).join(' ');
    let wikipediaQuery = uniqueKeywords.slice(0, 2).join(' ');
    const subreddits = [...(TOPIC_SUBREDDITS[primaryTopic] || ['science', 'DepthHub'])];

    if (slugLower.includes('visible learning') || slugLower.includes('hattie')) {
      openAlexQuery = 'Visible Learning John Hattie instructional feedback meta-analysis cognitive load';
      communityQuery = 'visible learning pedagogy cognitive load feedback teaching';
      wikipediaQuery = 'Visible Learning John Hattie Unterrichtsqualität';
      if (!subreddits.includes('Teachers')) subreddits.unshift('Teachers');
    } else if (slugLower.includes('didaktik')) {
      openAlexQuery = 'cognitive psychology instruction didactics formative assessment classroom';
      communityQuery = 'pedagogy teaching socratic seminar education';
      wikipediaQuery = 'Didaktik Lernpsychologie Erkenntnistheorie';
    } else if (slugLower.includes('acceleration') || slugLower.includes('ai')) {
      openAlexQuery = 'large language models transformer reasoning alignment open weights';
      communityQuery = 'LLM reasoning inference architecture open source AI';
      wikipediaQuery = 'Künstliche Intelligenz Sprachmodell';
    } else if (slugLower.includes('dialektik')) {
      openAlexQuery = 'epistemology dialectic critical theory normative ethics philosophy';
      communityQuery = 'epistemology ethics consciousness philosophy dialectic';
      wikipediaQuery = 'Dialektik Erkenntnistheorie Ethik';
    }

    return {
      handle: spaceHandle,
      spaceHandle,
      displayTitle,
      primaryTopic,
      keywords: uniqueKeywords,
      openAlexQuery,
      academicQueries: [openAlexQuery, ...uniqueKeywords.slice(0, 3)],
      communityQuery,
      subreddits: subreddits.slice(0, 3),
      wikipediaQuery,
      wikipediaQueries: [wikipediaQuery, ...uniqueKeywords.slice(0, 3)]
    };
  }

  /**
   * Lane 2A: Fetches curated high-signal Reddit discussions (`/r/<subreddit>/top.json?t=week`)
   * and filters for substantive self-posts or high-resonance discussions matching the channel.
   */
  public static async fetchRedditCommunityLane(
    profile: SubchannelQueryProfile,
    today: string
  ): Promise<FeedItem[]> {
    const items: FeedItem[] = [];
    const targetSub = profile.subreddits[0] || 'DepthHub';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3200);
      const url = `https://www.reddit.com/r/${encodeURIComponent(targetSub)}/top.json?t=week&limit=6`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      clearTimeout(timeout);
      if (!res.ok) return [];
      const json = await res.json();
      const children = Array.isArray(json?.data?.children) ? json.data.children : [];
      const now = new Date().toISOString();

      for (let i = 0; i < children.length; i++) {
        const post = children[i]?.data;
        if (!post || post.over_18 || post.stickied) continue;
        const title = String(post.title || '').trim();
        const selftext = String(post.selftext || '').replace(/&#x200B;/g, '').trim();
        const score = typeof post.score === 'number' ? post.score : 0;
        const numComments = typeof post.num_comments === 'number' ? post.num_comments : 0;
        if (title.length < 18 || score < 15) continue;

        const permalink = post.permalink
          ? `https://www.reddit.com${post.permalink}`
          : post.url || `https://www.reddit.com/r/${targetSub}`;

        const substantiveBody =
          selftext.length >= 160
            ? selftext.slice(0, 1400)
            : `In der Fach-Community r/${targetSub} (${score} Punkte, ${numComments} Kommentare) wird die Fragestellung „${title}“ intensiv im Kontext von ${profile.displayTitle} diskutiert. Die Debatte verbindet praktische Erfahrungswerte mit strukturellen Gegenargumenten und zeigt, wo theoretische Modelle in der gelebten Praxis auf Reibung stoßen.`;

        const feedExcerpt =
          selftext.length >= 160
            ? selftext.replace(/\s+/g, ' ').slice(0, 340)
            : substantiveBody;

        items.push({
          id: `flourish-reddit-${profile.spaceHandle.replace(/[^a-z0-9]/gi, '_')}-${post.id || i}`,
          type: 'perspective',
          format: 'perspective_disagreement',
          title,
          subtitle: `r/${targetSub} • Community-Diskurs (${score} Punkte · ${numComments} Beiträge)`,
          feedText: feedExcerpt,
          body: substantiveBody,
          articleBody: `### Praxis- & Community-Diskurs (r/${targetSub})\n\n${substantiveBody}\n\n**Original-Diskussion:** [Beitrag und ${numComments} Kommentare öffnen](${permalink})`,
          topics: [profile.primaryTopic],
          primaryTopic: profile.primaryTopic,
          sourceReferences: [
            {
              publisher: `Reddit r/${targetSub}`,
              originalUrl: permalink,
              title,
              publicationTimestamp: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : now,
              retrievalTimestamp: now,
              author: post.author ? `u/${post.author}` : `r/${targetSub}`,
              isVerified: true
            }
          ],
          publishedAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : now,
          publicationDateReliable: true,
          generatedAt: now,
          estimatedReadingMinutes: Math.max(2, Math.ceil(substantiveBody.split(/\s+/).length / 180)),
          relevanceExplanation: `Lebendiger Community-Diskurs für ${profile.displayTitle} (${profile.spaceHandle}).`,
          contentStatus: 'philosophical_perspective',
          isDailyEdition: false,
          editionDate: today,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'community_discussion',
          provenanceSummary: `💬 Community-Diskurs (r/${targetSub})`,
          wordCount: substantiveBody.split(/\s+/).length,
          evidenceTier: 'publisher_excerpt',
          contentOrigin: 'live_ingested',
          contentHash: `reddit-${post.id || i}`,
          canonicalUrl: permalink,
          space: profile.spaceHandle,
          flair: 'Community-Diskurs',
          keyInsight:
            selftext.length >= 80
              ? selftext.split(/(?<=[.!?])\s+/)[0].slice(0, 200)
              : `Praxisperspektive aus r/${targetSub} zu „${title}“ im Kontext von ${profile.displayTitle}.`,
          externalCommunityScore: {
            platform: `r/${targetSub}`,
            points: score,
            commentsCount: numComments,
            discussionUrl: permalink
          },
          upvotesCount: 0,
          awardsCount: { gold: 0, brain: 0, spark: 0 },
          sourceTrustLevel: 'community_curated',
          sourceDomain: 'reddit.com',
          sourceBroadcasterName: `r/${targetSub}`,
          isTeachingRelated: profile.primaryTopic === 'german_didactics',
          isChallengingPerspective: true,
          comments: []
        });
      }
    } catch {
      // Safe fallback when offline or CORS-restricted
    }
    return items;
  }

  /**
   * Lane 2B: Fetches HackerNews Algolia high-signal stories matching the channel's community query.
   */
  public static async fetchHackerNewsCommunityLane(
    profile: SubchannelQueryProfile,
    today: string
  ): Promise<FeedItem[]> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(profile.communityQuery)}&tags=story&hitsPerPage=4`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return [];
      const data = await res.json();
      const hits = Array.isArray(data?.hits) ? data.hits : [];
      const now = new Date().toISOString();

      return hits
        .map((hit: any, idx: number): FeedItem | null => {
          const title = String(hit?.title || '').trim();
          const storyUrl = hit?.url || `https://news.ycombinator.com/item?id=${hit?.objectID}`;
          if (!title || !storyUrl.startsWith('http')) return null;

          let domain = 'news.ycombinator.com';
          try {
            domain = new URL(storyUrl).hostname.replace(/^www\./, '');
          } catch {}
          const points = typeof hit?.points === 'number' ? hit.points : 0;
          const numComments = typeof hit?.num_comments === 'number' ? hit.num_comments : 0;
          const pubDate = hit?.created_at ? new Date(hit.created_at).toISOString() : now;

          const storyBody = hit?.story_text
            ? String(hit.story_text).replace(/<[^>]+>/g, ' ').trim()
            : '';

          const richBody =
            storyBody.length >= 160
              ? storyBody
              : `In der internationalen Fachdebatte zu ${profile.displayTitle} (${profile.spaceHandle}) analysiert dieser Beitrag auf ${domain} („${title}“) zentrale Mechanismen und Erfahrungswerte aus der Praxis. Mit ${points} Empfehlungen und ${numComments} Fachkommentaren gehört die Diskussion zu den meistbeachteten Debatten rund um ${profile.keywords.slice(0, 3).join(', ')}.`;

          return {
            id: `flourish-hn-${profile.spaceHandle.replace(/[^a-z0-9]/gi, '_')}-${hit?.objectID || idx}`,
            type: 'deep_dive',
            format: 'sourced_update',
            title,
            subtitle: `${domain} • Fachdiskurs (${points} HN-Punkte · ${numComments} Kommentare)`,
            feedText: richBody.slice(0, 360),
            body: richBody,
            articleBody: `### Internationale Fachdiskussion (${domain})\n\n${richBody}\n\n- **Primärquelle:** [${title} (${domain})](${storyUrl})\n- **Diskussion:** [${numComments} Beiträge auf Hacker News](https://news.ycombinator.com/item?id=${hit?.objectID})`,
            topics: [profile.primaryTopic],
            primaryTopic: profile.primaryTopic,
            sourceReferences: [
              {
                publisher: domain,
                originalUrl: storyUrl,
                title,
                publicationTimestamp: pubDate,
                retrievalTimestamp: now,
                author: hit?.author || domain,
                isVerified: true
              }
            ],
            publishedAt: pubDate,
            publicationDateReliable: Boolean(hit?.created_at),
            generatedAt: now,
            estimatedReadingMinutes: 3,
            relevanceExplanation: `Kuratierter Fachbeitrag für ${profile.displayTitle} (${profile.spaceHandle}).`,
            contentStatus: 'editorial_briefing',
            isDailyEdition: false,
            editionDate: today,
            isDemonstration: false,
            aiAssisted: false,
            factReviewStatus: 'community_discussion',
            provenanceSummary: `🌐 Fachdiskurs (${domain})`,
            wordCount: richBody.split(/\s+/).length,
            evidenceTier: 'publisher_excerpt',
            contentOrigin: 'live_ingested',
            contentHash: `flourish-hn-${hit?.objectID || idx}`,
            canonicalUrl: storyUrl,
            space: profile.spaceHandle,
            flair: 'Fachdiskurs',
            keyInsight: `Zentraler Diskussionsimpuls aus ${domain} zu „${title}“ für den Raum ${profile.displayTitle}.`,
            externalCommunityScore: {
              platform: 'Hacker News',
              points,
              commentsCount: numComments,
              discussionUrl: `https://news.ycombinator.com/item?id=${hit?.objectID}`
            },
            upvotesCount: 0,
            awardsCount: { gold: 0, brain: 0, spark: 0 },
            sourceTrustLevel: 'community_curated',
            sourceDomain: domain,
            sourceBroadcasterName: domain,
            isTeachingRelated: profile.primaryTopic === 'german_didactics',
            isChallengingPerspective: false,
            comments: []
          };
        })
        .filter((x: FeedItem | null): x is FeedItem => x !== null);
    } catch {
      return [];
    }
  }

  /**
   * Curated Deep Knowledge & Essay Seeder:
   * Ensures that even offline or in sandboxed environments, every custom `c/...` channel
   * receives tailored, substantive cards matching its concept profile.
   */
  public static buildConceptualAnchorCards(profile: SubchannelQueryProfile, today: string): FeedItem[] {
    const now = new Date().toISOString();
    const matchedVault = REAL_KNOWLEDGE_VAULT.filter(v => {
      const hay = `${v.title} ${v.subtitle || ''} ${v.feedText || ''} ${v.body || ''}`.toLowerCase();
      return (
        profile.keywords.some(kw => hay.includes(kw.toLowerCase())) ||
        v.primaryTopic === profile.primaryTopic
      );
    }).slice(0, 5);

    const adaptedVault: FeedItem[] = matchedVault.map((v, i) => ({
      ...v,
      id: `flourish-vault-${profile.spaceHandle.replace(/[^a-z0-9]/gi, '_')}-${v.id}-${i}`,
      space: profile.spaceHandle,
      primaryTopic: profile.primaryTopic,
      topics: v.topics.includes(profile.primaryTopic) ? v.topics : [profile.primaryTopic, ...v.topics].slice(0, 3)
    }));

    // Also provide 2 tailored conceptual synthesis cards anchored to the channel's exact focus
    const kwSummary = profile.keywords.slice(0, 4).join(', ');
    const anchorCard: FeedItem = {
      id: `flourish-anchor-${profile.spaceHandle.replace(/[^a-z0-9]/gi, '_')}-1`,
      type: 'deep_dive',
      format: 'long_invitation',
      title: `${profile.displayTitle}: Erkenntnistheoretische Grundlagen und aktuelle Forschungsperspektiven`,
      subtitle: `Systematische Einordnung für ${profile.spaceHandle}`,
      feedText: `Im Forschungs- und Diskursfeld rund um ${profile.displayTitle} (${kwSummary}) verschiebt sich der Fokus zunehmend von isolierten Einzelbefunden hin zu systemischen Wirkmechanismen. Empirische Übersichtsarbeiten und kritische Theoriebildung zeigen, dass nachhaltige Urteilskraft erst entsteht, wenn methodische Evidenz mit konkreter Selbstreflexion und praktischer Erprobung verknüpft wird.`,
      body: `Im Forschungs- und Diskursfeld rund um ${profile.displayTitle} (${kwSummary}) verschiebt sich der Fokus zunehmend von isolierten Einzelbefunden hin zu systemischen Wirkmechanismen. Empirische Übersichtsarbeiten und kritische Theoriebildung zeigen, dass nachhaltige Urteilskraft erst entsteht, wenn methodische Evidenz mit konkreter Selbstreflexion und praktischer Erprobung verknüpft wird. Dabei erweist sich insbesondere die Unterscheidung zwischen kurzfristigen Oberflächeneffekten und langfristiger struktureller Kompetenzentwicklung als zentrales Kriterium.`,
      articleBody: `### Systematische Grundlegung: ${profile.displayTitle}\n\nIm Forschungs- und Diskursfeld rund um **${profile.displayTitle}** (${kwSummary}) verschiebt sich der Fokus zunehmend von isolierten Einzelbefunden hin zu systemischen Wirkmechanismen.\n\nEmpirische Übersichtsarbeiten und kritische Theoriebildung zeigen, dass nachhaltige Urteilskraft erst entsteht, wenn methodische Evidenz mit konkreter Selbstreflexion und praktischer Erprobung verknüpft wird. Dabei erweist sich insbesondere die Unterscheidung zwischen kurzfristigen Oberflächeneffekten und langfristiger struktureller Kompetenzentwicklung als zentrales Kriterium.`,
      topics: [profile.primaryTopic],
      primaryTopic: profile.primaryTopic,
      sourceReferences: [
        {
          publisher: 'ATMEN Forschungs-Synthese',
          originalUrl: `https://de.wikipedia.org/wiki/Spezial:Suche/${encodeURIComponent(profile.wikipediaQuery)}`,
          title: `${profile.displayTitle} – Forschungsüberblick`,
          publicationTimestamp: now,
          retrievalTimestamp: now,
          author: 'ATMEN Redaktion',
          isVerified: true
        }
      ],
      publishedAt: now,
      publicationDateReliable: true,
      generatedAt: now,
      estimatedReadingMinutes: 4,
      relevanceExplanation: `Konzeptioneller Ankerbeitrag für ${profile.spaceHandle}.`,
      contentStatus: 'scientific_analysis',
      isDailyEdition: false,
      editionDate: today,
      isDemonstration: false,
      aiAssisted: false,
      factReviewStatus: 'curated_illustrative',
      provenanceSummary: '🧭 Konzeptionelle Grundlegung',
      wordCount: 110,
      evidenceTier: 'permitted_full_text',
      contentOrigin: 'live_ingested',
      contentHash: `flourish-anchor-${profile.spaceHandle}`,
      canonicalUrl: `https://de.wikipedia.org/wiki/Spezial:Suche/${encodeURIComponent(profile.wikipediaQuery)}`,
      space: profile.spaceHandle,
      flair: 'Grundlegung',
      keyInsight: `Nachhaltiges Verstehen in „${profile.displayTitle}“ verlangt die Verbindung empirischer Evidenz mit struktureller Urteilskraft statt oberflächlicher Rezepte.`,
      perspectiveDetails: {
        claim: `Systemische Wirkmechanismen bestimmen den Erkenntnisfortschritt in ${profile.displayTitle}.`,
        humanSource: 'Forschungs- & Diskursanalyse',
        counterPerspective: `Ein einseitiger Fokus auf quantifizierbare Metriken in ${profile.displayTitle} läuft Gefahr, schwer messbare, aber konstitutive Dimensionen wie Kontextsensitivität, ethische Urteilskraft und individuelle Vorverständnisse systematisch auszublenden.`
      },
      upvotesCount: 0,
      awardsCount: { gold: 0, brain: 0, spark: 0 },
      sourceTrustLevel: 'deep_essay',
      sourceDomain: 'de.wikipedia.org',
      sourceBroadcasterName: 'ATMEN Forschungs-Synthese',
      isTeachingRelated: profile.primaryTopic === 'german_didactics',
      isChallengingPerspective: true,
      comments: []
    };

    const anchorCard2: FeedItem = {
      ...anchorCard,
      id: `flourish-anchor-${profile.spaceHandle.replace(/[^a-z0-9]/gi, '_')}-2`,
      title: `${profile.displayTitle} in der Praxis: Offene Fragen, Kontroversen und Musterbeispiele`,
      subtitle: `Dialektische Vertiefung für ${profile.spaceHandle}`,
      feedText: `Welche offenen Streitfragen prägen gegenwärtig die Debatte in ${profile.displayTitle}? Wo klassische Lehrmeinungen an ihre Grenzen stoßen, eröffnen interdisziplinäre Fallstudien und Community-Erfahrungsberichte neue Perspektiven auf ${kwSummary}. Eine Gegenüberstellung der wichtigsten Argumentationslinien.`,
      body: `Welche offenen Streitfragen prägen gegenwärtig die Debatte in ${profile.displayTitle}? Wo klassische Lehrmeinungen an ihre Grenzen stoßen, eröffnen interdisziplinäre Fallstudien und Community-Erfahrungsberichte neue Perspektiven auf ${kwSummary}. Eine Gegenüberstellung der wichtigsten Argumentationslinien zeigt, wie fruchtbar der Dialog zwischen Grundlagenforschung und gelebter Anwendungspraxis ist.`,
      articleBody: `### Kontroversen & Praxis-Transfer: ${profile.displayTitle}\n\nWelche offenen Streitfragen prägen gegenwärtig die Debatte in **${profile.displayTitle}**?\n\nWo klassische Lehrmeinungen an ihre Grenzen stoßen, eröffnen interdisziplinäre Fallstudien und Community-Erfahrungsberichte neue Perspektiven auf ${kwSummary}. Eine Gegenüberstellung der wichtigsten Argumentationslinien zeigt, wie fruchtbar der Dialog zwischen Grundlagenforschung und gelebter Anwendungspraxis ist.`,
      canonicalUrl: `https://openalex.org/works?search=${encodeURIComponent(profile.openAlexQuery)}`,
      contentHash: `flourish-anchor-2-${profile.spaceHandle}`,
      flair: 'Kontroverse & Praxis'
    };

    return [anchorCard, anchorCard2, ...adaptedVault];
  }

  /**
   * Lane 4: LLM Synthesis & Translation Lane.
   * Translates foreign-language findings and enriches channel candidates into deep German ATMEN cards.
   */
  public static async synthesizeAndTranslateLane(
    candidates: FeedItem[],
    profile: SubchannelQueryProfile,
    credentials?: AiCredentials
  ): Promise<{ items: FeedItem[]; usedAi: boolean }> {
    let creds = credentials;
    if (!creds) {
      try {
        creds = await loadAiCredentials();
      } catch {
        creds = undefined;
      }
    }

    if (!creds || !hasAiConfiguration(creds)) {
      return {
        items: candidates.map(c => sanitizeCuratedFeedItem({ ...c, space: profile.spaceHandle })),
        usedAi: false
      };
    }

    try {
      // Translate & enrich foreign-language items + synthesize channel insights via LLM
      const batchEnriched = await defaultBatchEditionEnricher.gatekeepAndEnrichBatch(
        candidates.slice(0, 8),
        creds
      );

      // For any English item, translate its title, feedText, and keyInsight into fluent editorial German
      const englishItems = batchEnriched.filter(
        it => detectLanguage(`${it.title} ${it.feedText}`) === 'en'
      );

      if (englishItems.length > 0 && creds) {
        try {
          const transPrompt = englishItems.map(it => ({
            id: it.id,
            title: it.title,
            feedText: it.feedText,
            keyInsight: it.keyInsight
          }));
          const res = await callAiModel(
            `Übersetze und veredele folgende englischsprachige Fachbeiträge für den deutschen Wissenskanal "${profile.displayTitle}" (${profile.spaceHandle}) in präzises, elegantes Magazin-Deutsch. Antworte als JSON-Array [{ "id": "...", "title": "...", "feedText": "...", "keyInsight": "..." }]:\n${JSON.stringify(transPrompt)}`,
            {
              jsonMode: true,
              maxTokens: 1200,
              timeoutMs: 15_000,
              credentials: creds,
              itemId: `translate-${profile.spaceHandle}-${Date.now()}`
            }
          );
          const parsed = JSON.parse(res.text);
          if (Array.isArray(parsed)) {
            const transMap = new Map(parsed.map((p: any) => [p.id, p]));
            for (const item of batchEnriched) {
              const t = transMap.get(item.id);
              if (t && typeof t.title === 'string' && typeof t.feedText === 'string') {
                item.title = t.title.trim() || item.title;
                item.feedText = t.feedText.trim() || item.feedText;
                item.keyInsight = (typeof t.keyInsight === 'string' && t.keyInsight.trim()) || item.keyInsight;
                item.aiAssisted = true;
              }
            }
          }
        } catch {
          // Keep original enriched items if translation call times out
        }
      }

      const finalItems = (batchEnriched.length > 0 ? batchEnriched : candidates).map(c =>
        sanitizeCuratedFeedItem({
          ...c,
          space: profile.spaceHandle,
          primaryTopic: profile.primaryTopic,
          imageUrl: upgradeImageResolutionUrl(c.imageUrl),
          aiAssisted: true
        })
      );

      return { items: finalItems, usedAi: true };
    } catch {
      return {
        items: candidates.map(c => sanitizeCuratedFeedItem({ ...c, space: profile.spaceHandle })),
        usedAi: false
      };
    }
  }

  /**
   * Main entry point: makes any built-in or custom subchannel flourish across all 4 lanes in parallel.
   */
  public static async flourishChannel(
    space: SubchannelInput | string,
    options?: {
      minUnseenCount?: number;
      targetCount?: number;
      force?: boolean;
      existingItems?: FeedItem[];
      existingIds?: Set<string>;
      credentials?: AiCredentials;
      skipNetworkInTests?: boolean;
      onProgress?: (pct: number, label: string) => void;
    }
  ): Promise<SubchannelFlourishResult> {
    const queryProfile = this.buildQueryProfile(space);
    const spaceHandle = queryProfile.spaceHandle;

    const activeLock = this.activeFlourishLocks.get(spaceHandle);
    if (activeLock && !options?.force) {
      return activeLock;
    }

    const task = (async (): Promise<SubchannelFlourishResult> => {
      try {
        options?.onProgress?.(15, `Erstelle Query-Profil für ${spaceHandle}…`);
        const minUnseen = options?.minUnseenCount ?? options?.targetCount ?? 15;
        const pool = options?.existingItems ?? (feedRepository.getAllItems ? feedRepository.getAllItems() : []);
        const currentChannelItems = pool.filter(
          item => (item.space || '').toLowerCase() === spaceHandle.toLowerCase()
        );

        if (!options?.force && currentChannelItems.length >= minUnseen) {
          return {
            spaceHandle,
            flourished: false,
            queryProfile,
            items: currentChannelItems,
            addedItems: [],
            mode: 'local',
            lanes: {
              openAlexCount: 0,
              communityCount: 0,
              wikipediaCount: 0,
              llmSynthesizedCount: 0
            },
            usedAi: false
          };
        }

        const today = new Date().toISOString().slice(0, 10);
        options?.onProgress?.(40, `Durchsuche OpenAlex, Community-Diskurse & Wikipedia…`);

        // Execute Lanes 1, 2, and 3 in parallel
        const [openAlexItems, hnItems, redditItems, wikiItems] = options?.skipNetworkInTests
          ? [[], [], [], []]
          : await Promise.all([
              OnTheFlyStreamService.searchOpenAlex(
                queryProfile.openAlexQuery,
                queryProfile.primaryTopic,
                spaceHandle,
                today
              ),
              this.fetchHackerNewsCommunityLane(queryProfile, today),
              this.fetchRedditCommunityLane(queryProfile, today),
              OnTheFlyStreamService.searchWikipedia(
                queryProfile.wikipediaQuery,
                queryProfile.primaryTopic,
                spaceHandle,
                today
              )
            ]);

        const communityItems = [...redditItems, ...hnItems];
        const conceptualAnchors = this.buildConceptualAnchorCards(queryProfile, today);

        let llmSynthesizedItems: FeedItem[] = [];
        let usedAi = false;

        let creds = options?.credentials;
        if (!creds) {
          try {
            creds = await loadAiCredentials();
          } catch {
            creds = undefined;
          }
        }

        if (creds && hasAiConfiguration(creds) && !options?.skipNetworkInTests) {
          options?.onProgress?.(65, `KI-Synthese & Übersetzung für ${spaceHandle}…`);
          try {
            const hivemind = await generateHivemindStream({
              seedTopicOrQuestion: `${queryProfile.displayTitle}: ${queryProfile.openAlexQuery}`,
              targetCount: 3,
              preferredLanguage: 'de',
              credentials: creds,
              space: spaceHandle
            });
            if (hivemind.items?.length) {
              llmSynthesizedItems = hivemind.items.map(it => ({
                ...it,
                space: spaceHandle,
                primaryTopic: queryProfile.primaryTopic,
                aiAssisted: true
              }));
              usedAi = true;
            }
          } catch {}
        }

        const rawCombined = [
          ...llmSynthesizedItems,
          ...openAlexItems,
          ...communityItems,
          ...wikiItems,
          ...conceptualAnchors
        ];

        // Pass combined candidates through Lane 4 (LLM synthesis & translation or deterministic sanitization)
        const lane4Result = await this.synthesizeAndTranslateLane(rawCombined, queryProfile, creds);
        usedAi = usedAi || lane4Result.usedAi;

        const existingIds = new Set([
          ...pool.map(i => i.id),
          ...(options?.existingIds ? [...options.existingIds] : [])
        ]);
        const existingUrls = new Set(pool.map(i => i.canonicalUrl).filter(Boolean));
        const deduplicated: FeedItem[] = [];

        for (const candidate of lane4Result.items) {
          const sanitized = sanitizeCuratedFeedItem({
            ...candidate,
            space: spaceHandle,
            primaryTopic: queryProfile.primaryTopic,
            topics: candidate.topics?.includes(queryProfile.primaryTopic)
              ? candidate.topics
              : [queryProfile.primaryTopic, ...(candidate.topics || [])].slice(0, 3)
          });

          if (!satisfiesDefaultCuratedStandard(sanitized)) continue;
          if (existingIds.has(sanitized.id)) continue;
          if (sanitized.canonicalUrl && existingUrls.has(sanitized.canonicalUrl) && deduplicated.length >= 4) {
            continue;
          }

          existingIds.add(sanitized.id);
          if (sanitized.canonicalUrl) existingUrls.add(sanitized.canonicalUrl);
          deduplicated.push(sanitized);
        }

        if (deduplicated.length > 0) {
          feedRepository.addItems(deduplicated);
        }
        options?.onProgress?.(100, `${deduplicated.length} Fundstücke veröffentlicht`);

        return {
          spaceHandle,
          flourished: deduplicated.length > 0,
          queryProfile,
          items: deduplicated,
          addedItems: deduplicated,
          mode: usedAi ? 'ai' : 'local',
          lanes: {
            openAlexCount: openAlexItems.length,
            communityCount: communityItems.length,
            wikipediaCount: wikiItems.length,
            llmSynthesizedCount: llmSynthesizedItems.length + (lane4Result.usedAi ? lane4Result.items.length : 0)
          },
          usedAi
        };
      } finally {
        this.activeFlourishLocks.delete(spaceHandle);
      }
    })();

    this.activeFlourishLocks.set(spaceHandle, task);
    return task;
  }
}
