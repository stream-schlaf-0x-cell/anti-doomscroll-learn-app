import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  ViewStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { FeedItem, UserNote } from '../../core/domain/types';
import { feedRepository } from '../../core/data/feedRepository';
import { defaultGraphRepository } from '../../core/graph/graphRepository';
import { defaultAutomationEngine } from '../../core/automation/automationEngine';
import {
  UserThoughtNode,
  KnowledgeConnection,
  ThoughtNodeType,
  ConnectionRelation
} from '../../core/graph/types';
import { AutomationRule } from '../../core/automation/types';
import {
  HivemindLearningTrack,
  hivemindLearningService
} from '../../core/learning/hivemindLearningService';
import { HyperspaceCanvas, HyperspaceNode, HyperspaceEdge, GalaxyMode } from './HyperspaceCanvas';
import { copyToClipboard } from '../../core/export/craftExport';
import { isFeatureEnabled } from '../../core/modules/featureRegistry';
import { AtmenBreathingPortal } from '../breathing/AtmenBreathingPortal';
import { HivemindStreamModal } from '../../ui/components/HivemindStreamModal';

type KosmosFilter = 'all' | 'saved' | 'upvotes' | 'notes' | 'tracks';

interface ItemSnapshotShape {
  title?: string;
  subtitle?: string;
  publisher?: string;
  sourceDomain?: string;
  space?: string;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function getInspectorBadgeMeta(node: HyperspaceNode): { label: string; icon: IoniconName } {
  if (node.id === 'atmen-breathing-core' || node.type === 'reading_anchor') {
    return { label: 'Atem-Kern', icon: 'leaf-outline' };
  }
  switch (node.type) {
    case 'saved_article':
      return { label: 'Gespeichert', icon: 'bookmark-outline' };
    case 'upvoted_article':
      return { label: 'Upvote', icon: 'arrow-up-circle-outline' };
    case 'hivemind_track':
      return { label: 'Lernpfad', icon: 'school-outline' };
    case 'user_note':
    case 'article_note':
      return { label: 'Notiz', icon: 'create-outline' };
    case 'thesis':
      return { label: 'These', icon: 'bulb-outline' };
    case 'question':
      return { label: 'Forschungsfrage', icon: 'help-circle-outline' };
    case 'thought':
      return { label: 'Gedanke', icon: 'sparkles-outline' };
    case 'concept':
      return { label: 'Konzept', icon: 'git-network-outline' };
    default:
      return { label: 'Spur', icon: 'ellipse-outline' };
  }
}

function getPrimaryJumpMeta(node: HyperspaceNode): { label: string; icon: IoniconName } {
  if (node.id === 'atmen-breathing-core' || node.type === 'reading_anchor') {
    return { label: 'Atem-Zentrum öffnen', icon: 'leaf-outline' };
  }
  if (node.type === 'hivemind_track') {
    return { label: 'Lernpfad öffnen', icon: 'school-outline' };
  }
  if (node.articleId || node.type === 'saved_article' || node.type === 'upvoted_article' || node.type === 'article') {
    return { label: 'Im Reader öffnen', icon: 'book-outline' };
  }
  return { label: 'Gedanke öffnen', icon: 'bulb-outline' };
}

export const NetworkScreen: React.FC = () => {
  const {
    colors,
    isDark,
    profile,
    savedArticles,
    interactions,
    dailyEdition,
    discoveryItems,
    openArticle,
    openInvestigation,
    setActiveTab
  } = useApp();

  const [thoughts, setThoughts] = useState<UserThoughtNode[]>([]);
  const [connections, setConnections] = useState<KnowledgeConnection[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [hivemindTracks, setHivemindTracks] = useState<HivemindLearningTrack[]>(() =>
    hivemindLearningService.getTracksSync()
  );
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');

  // Search, filter & geometry state
  const [kosmosSearch, setKosmosSearch] = useState<string>('');
  const [galaxyMode, setGalaxyMode] = useState<GalaxyMode>('orbital');
  const [kosmosFilter, setKosmosFilter] = useState<KosmosFilter>('all');
  const [selectedGalaxyNode, setSelectedGalaxyNode] = useState<HyperspaceNode | null>(null);

  // Modals & form state
  const [showAddThoughtModal, setShowAddThoughtModal] = useState<boolean>(false);
  const [thoughtTitle, setThoughtTitle] = useState<string>('');
  const [thoughtBody, setThoughtBody] = useState<string>('');
  const [thoughtType, setThoughtType] = useState<ThoughtNodeType>('thought');
  const [thoughtTags, setThoughtTags] = useState<string>('');

  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [sourceNodeId, setSourceNodeId] = useState<string>('');
  const [targetNodeId, setTargetNodeId] = useState<string>('');
  const [relation, setRelation] = useState<ConnectionRelation>('belongs_to');
  const [connectionAnnotation, setConnectionAnnotation] = useState<string>('');

  const [selectedNode, setSelectedNode] = useState<UserThoughtNode | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [automationResult, setAutomationResult] = useState<string | null>(null);
  const [showBreathingPortal, setShowBreathingPortal] = useState<boolean>(false);
  const [showHivemindModal, setShowHivemindModal] = useState<boolean>(false);

  const isHyperspaceEnabled = isFeatureEnabled(profile, 'hyperspace_3d');

  const loadGraphData = useCallback(async () => {
    try {
      const [allThoughts, allConns, rules] = await Promise.all([
        defaultGraphRepository.getAllThoughts(),
        defaultGraphRepository.getAllConnections(),
        defaultAutomationEngine.getRules()
      ]);
      setThoughts(allThoughts);
      setConnections(allConns);
      setAutomationRules(rules);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    void loadGraphData();
  }, [loadGraphData]);

  useEffect(() => {
    void hivemindLearningService.getTracks().then(setHivemindTracks).catch(() => {});
    return hivemindLearningService.subscribe(setHivemindTracks);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCreateThought = async () => {
    if (!thoughtTitle.trim()) return;
    try {
      const tags = thoughtTags
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);

      await defaultGraphRepository.addThought({
        title: thoughtTitle.trim(),
        body: thoughtBody.trim(),
        type: thoughtType,
        tags,
        status: 'crystallized'
      });

      setThoughtTitle('');
      setThoughtBody('');
      setThoughtTags('');
      setShowAddThoughtModal(false);
      await loadGraphData();
      showToast('Gedanke im Wissensnetz verankert');
    } catch {
      showToast('Fehler beim Speichern');
    }
  };

  const handleCreateConnection = async () => {
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) {
      showToast('Bitte wähle zwei unterschiedliche Knoten');
      return;
    }
    try {
      await defaultGraphRepository.connectNodes({
        sourceId: sourceNodeId,
        targetId: targetNodeId,
        relation,
        annotation: connectionAnnotation.trim() || undefined,
        provenance: 'user_curated'
      });

      setConnectionAnnotation('');
      setShowConnectModal(false);
      await loadGraphData();
      showToast('Verbindung hergestellt');
    } catch {
      showToast('Fehler beim Verbinden');
    }
  };

  const handleDeleteThought = async (id: string) => {
    try {
      await defaultGraphRepository.deleteThought(id);
      setSelectedNode(null);
      if (selectedGalaxyNode?.id === id) {
        setSelectedGalaxyNode(null);
      }
      await loadGraphData();
      showToast('Eintrag und verknüpfte Kanten entfernt');
    } catch {
      showToast('Löschen fehlgeschlagen');
    }
  };

  const handleExportMarkdown = async () => {
    try {
      const md = await defaultGraphRepository.exportGraphAsMarkdown();
      await copyToClipboard(md);
      showToast('Markdown in Zwischenablage kopiert (Obsidian/Craft-kompatibel)');
    } catch {
      showToast('Export fehlgeschlagen');
    }
  };

  const handleRunAutomation = async (ruleId: string, dryRun: boolean) => {
    try {
      const result = await defaultAutomationEngine.executeRule(ruleId, { dryRun });
      setAutomationResult(result.summary);
      await loadGraphData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unbekannt';
      setAutomationResult(`Fehler: ${message}`);
    }
  };

  // Lookup map across savedArticles, dailyEdition, discoveryItems, and feedRepository
  const itemLookup = useMemo(() => {
    const map = new Map<string, FeedItem>();
    const repoAll = feedRepository.getAllItems ? feedRepository.getAllItems() : [];
    for (const item of repoAll) {
      map.set(item.id, item);
    }
    for (const item of discoveryItems || []) {
      map.set(item.id, item);
    }
    for (const item of dailyEdition || []) {
      map.set(item.id, item);
    }
    for (const item of savedArticles || []) {
      map.set(item.id, item);
    }
    return map;
  }, [dailyEdition, discoveryItems, savedArticles]);

  // Build pure user-trace nodes (NO channelNodes / default topic spaces)
  const {
    savedNodes,
    upvotedNodes,
    noteAndThoughtNodes,
    trackNodes,
    breathingAnchorNode,
    pureTraceNodes,
    searchCorpusById
  } = useMemo(() => {
    const corpus = new Map<string, string>();
    const savedIdSet = new Set((savedArticles || []).map(a => a.id));

    const saved: HyperspaceNode[] = (savedArticles || []).map(a => {
      const publisher = a.sourceReferences?.[0]?.publisher || a.sourceBroadcasterName || '';
      const domain = a.sourceDomain || '';
      const node: HyperspaceNode = {
        id: `saved-${a.id}`,
        articleId: a.id,
        title: a.title,
        subtitle: domain || publisher || a.primaryTopic,
        type: 'saved_article',
        color: '#38BDF8',
        space: a.space,
        tags: a.topics,
        reasonText: 'Gespeicherter Primärtext in deiner Bibliothek',
        interactionDepth: 4
      };
      corpus.set(
        node.id,
        [a.title, a.subtitle, domain, publisher, a.space, a.primaryTopic, ...(a.topics || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
      );
      return node;
    });

    const interactionList = Object.values(interactions || {});

    const upvoted: HyperspaceNode[] = interactionList
      .filter(i => (i.voteScore || 0) > 0 && !savedIdSet.has(i.itemId))
      .map(i => {
        const snapshot = (i as { itemSnapshot?: ItemSnapshotShape }).itemSnapshot;
        const matched = itemLookup.get(i.itemId);
        const title = matched?.title || snapshot?.title || `Upvote: ${i.itemId.slice(0, 24)}`;
        const domain = matched?.sourceDomain || snapshot?.sourceDomain || '';
        const publisher =
          matched?.sourceReferences?.[0]?.publisher ||
          matched?.sourceBroadcasterName ||
          snapshot?.publisher ||
          '';
        const space = matched?.space || snapshot?.space;
        const subtitleText = domain || publisher || snapshot?.subtitle || 'Upvote';

        const node: HyperspaceNode = {
          id: `upvote-${i.itemId}`,
          articleId: i.itemId,
          title,
          subtitle: subtitleText,
          type: 'upvoted_article',
          color: '#10B981',
          space,
          tags: matched?.topics,
          reasonText: 'Durch Upvote in deinem Kosmos verankert',
          interactionDepth: 3
        };
        corpus.set(
          node.id,
          [title, snapshot?.subtitle, matched?.subtitle, domain, publisher, space, ...(matched?.topics || [])]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
        );
        return node;
      });

    // Thoughts & mirrored notes from GraphRepository
    const mirroredKeys = new Set<string>();
    const thoughtNodesList: HyperspaceNode[] = thoughts.map(t => {
      if (t.sourceArticleId && t.body.trim()) {
        mirroredKeys.add(`${t.sourceArticleId}::${t.body.trim().toLowerCase()}`);
      }
      const matched = t.sourceArticleId ? itemLookup.get(t.sourceArticleId) : undefined;
      const typeLabel =
        t.type === 'question'
          ? 'Forschungsfrage'
          : t.type === 'thesis'
          ? 'These'
          : t.type === 'article_note'
          ? 'Randnotiz'
          : t.type === 'concept'
          ? 'Konzept'
          : 'Gedanke';
      const nodeColor = t.type === 'question' || t.type === 'article_note' ? '#F59E0B' : '#A78BFA';
      const node: HyperspaceNode = {
        id: t.id,
        articleId: t.sourceArticleId,
        title: t.title,
        subtitle: t.sourceArticleTitle || matched?.title || typeLabel,
        type: t.type,
        color: nodeColor,
        space: t.space || matched?.space,
        tags: t.tags,
        noteText: t.body || undefined,
        reasonText: t.sourceArticleTitle
          ? `${typeLabel} zu „${t.sourceArticleTitle}“`
          : `Eigener Eintrag (${typeLabel})`,
        interactionDepth: 4
      };
      corpus.set(
        node.id,
        [
          t.title,
          t.body,
          t.sourceArticleTitle,
          matched?.sourceDomain,
          t.space,
          typeLabel,
          ...(t.tags || [])
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
      );
      return node;
    });

    // Un-mirrored interaction userNotes (deduplicated against mirrored thoughts)
    const userNoteNodes: HyperspaceNode[] = [];
    interactionList.forEach(i => {
      if (!i.userNotes || i.userNotes.length === 0) return;
      const snapshot = (i as { itemSnapshot?: ItemSnapshotShape }).itemSnapshot;
      const matched = itemLookup.get(i.itemId);
      i.userNotes.forEach((n: UserNote, idx: number) => {
        const trimmedText = (n.text || '').trim();
        if (!trimmedText) return;
        const mirrorKey = `${i.itemId}::${trimmedText.toLowerCase()}`;
        if (mirroredKeys.has(mirrorKey)) return;
        mirroredKeys.add(mirrorKey);

        const tagLabel =
          n.tag === 'einwand'
            ? 'Einwand'
            : n.tag === 'these'
            ? 'These'
            : n.tag === 'unterricht'
            ? 'Unterricht'
            : 'Notiz';

        const node: HyperspaceNode = {
          id: `note-${i.itemId}-${n.id || idx}`,
          articleId: i.itemId,
          title: trimmedText.length > 44 ? `${trimmedText.slice(0, 42)}…` : trimmedText,
          subtitle: matched?.title || snapshot?.title || 'Randnotiz',
          type: 'user_note',
          color: '#F59E0B',
          space: matched?.space || snapshot?.space,
          tags: [n.tag || 'notiz'],
          noteText: trimmedText,
          reasonText: `Persönliche Randnotiz (${tagLabel})`,
          interactionDepth: 4
        };
        corpus.set(
          node.id,
          [
            trimmedText,
            matched?.title,
            snapshot?.title,
            matched?.sourceDomain,
            snapshot?.sourceDomain,
            matched?.space,
            snapshot?.space,
            tagLabel
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
        );
        userNoteNodes.push(node);
      });
    });

    const tracks: HyperspaceNode[] = (hivemindTracks || []).map(tr => {
      const node: HyperspaceNode = {
        id: `track-${tr.id}`,
        trackId: tr.id,
        title: tr.title,
        subtitle: `${tr.progressPercent}% abgeschlossen · ${tr.completedItemIds.length}/${tr.totalItemsCount} Schritte`,
        type: 'hivemind_track',
        color: '#818CF8',
        space: tr.items?.[0]?.space || 'c/hivemind',
        progressPercent: tr.progressPercent,
        reasonText: `Aktiver Hivemind Lernpfad (${tr.progressPercent}% Fortschritt)`,
        interactionDepth: 4
      };
      corpus.set(
        node.id,
        [tr.title, tr.subtitle, tr.sourceLabel, 'lernpfad', 'hivemind', node.space]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
      );
      return node;
    });

    const coreAnchor: HyperspaceNode = {
      id: 'atmen-breathing-core',
      title: '0,1 Hz Atem-Kern',
      subtitle: '6 Atemzüge / Minute',
      type: 'reading_anchor',
      color: '#10B981',
      reasonText: 'Kohärente Atemfrequenz (0,1 Hz / 6 Atemzüge pro Minute)',
      interactionDepth: 5
    };
    corpus.set(coreAnchor.id, '0,1 hz atem kern atmung pause ruhe zentrum');

    const notesCombined = [...thoughtNodesList, ...userNoteNodes];
    const allPureTraces = [...saved, ...upvoted, ...notesCombined, ...tracks];

    return {
      savedNodes: saved,
      upvotedNodes: upvoted,
      noteAndThoughtNodes: notesCombined,
      trackNodes: tracks,
      breathingAnchorNode: coreAnchor,
      pureTraceNodes: allPureTraces,
      searchCorpusById: corpus
    };
  }, [savedArticles, interactions, itemLookup, thoughts, hivemindTracks]);

  const normalizedQuery = kosmosSearch.trim().toLowerCase();

  // Filter pure user traces by category & instant search query
  const filteredPureTraceNodes = useMemo(() => {
    return pureTraceNodes.filter(node => {
      if (kosmosFilter === 'saved' && node.type !== 'saved_article') return false;
      if (kosmosFilter === 'upvotes' && node.type !== 'upvoted_article') return false;
      if (
        kosmosFilter === 'notes' &&
        node.type !== 'user_note' &&
        node.type !== 'article_note' &&
        node.type !== 'thought' &&
        node.type !== 'thesis' &&
        node.type !== 'question' &&
        node.type !== 'concept'
      ) {
        return false;
      }
      if (kosmosFilter === 'tracks' && node.type !== 'hivemind_track') return false;

      if (normalizedQuery) {
        const hay =
          searchCorpusById.get(node.id) ||
          `${node.title} ${node.subtitle || ''} ${node.space || ''} ${node.noteText || ''}`.toLowerCase();
        return hay.includes(normalizedQuery);
      }
      return true;
    });
  }, [pureTraceNodes, kosmosFilter, normalizedQuery, searchCorpusById]);

  // Include the central 0.1 Hz Breathing Core anchor in the 3D scene when not narrowed out by search
  const canvasNodes = useMemo(() => {
    if (normalizedQuery) {
      const coreMatch = (searchCorpusById.get(breathingAnchorNode.id) || '').includes(normalizedQuery);
      return coreMatch ? [breathingAnchorNode, ...filteredPureTraceNodes] : filteredPureTraceNodes;
    }
    return [breathingAnchorNode, ...filteredPureTraceNodes];
  }, [breathingAnchorNode, filteredPureTraceNodes, normalizedQuery, searchCorpusById]);

  // Deselect inspector if active node disappears from current filter/search
  useEffect(() => {
    if (selectedGalaxyNode && !canvasNodes.some(n => n.id === selectedGalaxyNode.id)) {
      setSelectedGalaxyNode(null);
    }
  }, [canvasNodes, selectedGalaxyNode]);

  // Clean HyperspaceEdges: explicit connections + note->article links + max 2 thematic space links per node
  const hyperspaceEdges: HyperspaceEdge[] = useMemo(() => {
    const activeIds = new Set(canvasNodes.map(n => n.id));
    const articleToNodeId = new Map<string, string>();

    for (const node of canvasNodes) {
      if (
        node.articleId &&
        (node.type === 'saved_article' || node.type === 'upvoted_article')
      ) {
        articleToNodeId.set(node.articleId, node.id);
      }
    }

    const resolveEndpoint = (rawId: string): string | null => {
      if (activeIds.has(rawId)) return rawId;
      const mapped = articleToNodeId.get(rawId);
      return mapped && activeIds.has(mapped) ? mapped : null;
    };

    const result: HyperspaceEdge[] = [];
    const seenPairs = new Set<string>();
    const addEdge = (sourceId: string, targetId: string, relation: string, idPrefix: string, annotation?: string) => {
      if (!sourceId || !targetId || sourceId === targetId) return;
      if (!activeIds.has(sourceId) || !activeIds.has(targetId)) return;
      const pairKey = sourceId < targetId ? `${sourceId}::${targetId}` : `${targetId}::${sourceId}`;
      if (seenPairs.has(pairKey)) return;
      seenPairs.add(pairKey);
      result.push({
        id: `${idPrefix}-${pairKey}`,
        sourceId,
        targetId,
        relation,
        annotation
      });
    };

    // 1. Explicit connections from GraphRepository
    for (const c of connections) {
      const s = resolveEndpoint(c.sourceId);
      const t = resolveEndpoint(c.targetId);
      if (s && t) {
        addEdge(s, t, c.relation, `conn-${c.id}`, c.annotation);
      }
    }

    // 2. Link notes/theses to their articleId node if present
    for (const node of canvasNodes) {
      if (
        node.articleId &&
        node.type !== 'saved_article' &&
        node.type !== 'upvoted_article'
      ) {
        const targetArticleNodeId = articleToNodeId.get(node.articleId);
        if (targetArticleNodeId) {
          addEdge(node.id, targetArticleNodeId, 'cites', 'note-article');
        }
      }
    }

    // 3. Subtle thematic links (max 2 per node) between traces sharing the same space
    const thematicDegree = new Map<string, number>();
    const nodesBySpace = new Map<string, HyperspaceNode[]>();
    for (const node of filteredPureTraceNodes) {
      if (!node.space) continue;
      const key = node.space.toLowerCase();
      const bucket = nodesBySpace.get(key) || [];
      bucket.push(node);
      nodesBySpace.set(key, bucket);
    }

    for (const bucket of nodesBySpace.values()) {
      if (bucket.length < 2) continue;
      for (let i = 0; i < bucket.length; i++) {
        const a = bucket[i];
        const degA = thematicDegree.get(a.id) || 0;
        if (degA >= 2) continue;
        for (let j = i + 1; j < bucket.length; j++) {
          const b = bucket[j];
          const degB = thematicDegree.get(b.id) || 0;
          if (degB >= 2) continue;
          const pairKey = a.id < b.id ? `${a.id}::${b.id}` : `${b.id}::${a.id}`;
          if (seenPairs.has(pairKey)) continue;
          addEdge(a.id, b.id, 'belongs_to', 'space');
          thematicDegree.set(a.id, (thematicDegree.get(a.id) || 0) + 1);
          thematicDegree.set(b.id, (thematicDegree.get(b.id) || 0) + 1);
          if ((thematicDegree.get(a.id) || 0) >= 2) break;
        }
      }
    }

    return result;
  }, [canvasNodes, connections, filteredPureTraceNodes]);

  // Pure user-trace filter counts (excluding 0.1 Hz Breathing Core)
  const totalTraceCount = pureTraceNodes.length;
  const savedCount = savedNodes.length;
  const upvoteCount = upvotedNodes.length;
  const noteCount = noteAndThoughtNodes.length;
  const trackCount = trackNodes.length;

  const handleNodeClick = (node: HyperspaceNode) => {
    setSelectedGalaxyNode(node);
  };

  const handlePrimaryJump = (node: HyperspaceNode) => {
    if (node.id === 'atmen-breathing-core' || node.type === 'reading_anchor') {
      setShowBreathingPortal(true);
      return;
    }
    if (node.type === 'hivemind_track') {
      setShowHivemindModal(true);
      return;
    }
    if (node.articleId) {
      void openArticle(node.articleId);
      return;
    }
    if (node.type === 'article' || node.type === 'saved_article' || node.type === 'upvoted_article') {
      void openArticle(node.id.replace(/^(saved-|upvote-)/, ''));
      return;
    }
    const foundThought = thoughts.find(t => t.id === node.id);
    if (foundThought) {
      setSelectedNode(foundThought);
      return;
    }
    showToast('Für diese Spur ist kein verknüpfter Volltext hinterlegt.');
  };

  const handleInvestigateNode = (node: HyperspaceNode) => {
    if (node.articleId) {
      const matched = itemLookup.get(node.articleId);
      if (matched) {
        openInvestigation(matched, null);
        return;
      }
    }
    const topicQuestion = node.noteText
      ? `${node.title}: ${node.noteText.slice(0, 140)}`
      : node.title;
    openInvestigation(null, topicQuestion);
  };

  const handleStartFocusTrackFromModal = (trackId: string) => {
    const track = hivemindTracks.find(t => t.id === trackId);
    if (!track || track.items.length === 0) {
      setActiveTab('feed');
      return;
    }
    const completedSet = new Set(track.completedItemIds);
    const nextItem = track.items.find(it => !completedSet.has(it.id)) || track.items[0];
    if (nextItem) {
      void openArticle(nextItem.id);
    } else {
      setActiveTab('feed');
    }
  };

  const webScrollStyle =
    Platform.OS === 'web'
      ? ({
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        } as unknown as ViewStyle)
      : undefined;

  const filterOptions: {
    key: KosmosFilter;
    label: string;
    count: number;
    icon: IoniconName;
  }[] = [
    { key: 'all', label: 'Alle meine Funde', count: totalTraceCount, icon: 'layers-outline' },
    { key: 'saved', label: 'Gespeichert', count: savedCount, icon: 'bookmark-outline' },
    { key: 'upvotes', label: 'Upvotes', count: upvoteCount, icon: 'arrow-up-circle-outline' },
    { key: 'notes', label: 'Notizen & Thesen', count: noteCount, icon: 'create-outline' },
    { key: 'tracks', label: 'Lernpfade', count: trackCount, icon: 'school-outline' }
  ];

  const geometryOptions: {
    key: GalaxyMode;
    label: string;
    icon: IoniconName;
  }[] = [
    { key: 'orbital', label: 'Galaxie', icon: 'planet-outline' },
    { key: 'lotus', label: 'Sphäre', icon: 'aperture-outline' },
    { key: 'torus', label: 'Torus', icon: 'infinite-outline' }
  ];

  const selectedBadgeMeta = selectedGalaxyNode ? getInspectorBadgeMeta(selectedGalaxyNode) : null;
  const selectedJumpMeta = selectedGalaxyNode ? getPrimaryJumpMeta(selectedGalaxyNode) : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Toast Notification */}
      {toastMessage && (
        <View style={[styles.toast, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
          <Text style={[styles.toastText, { color: colors.textPrimary }]}>{toastMessage}</Text>
        </View>
      )}

      {/* Screen Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderSubtle, backgroundColor: colors.surface }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Wissenskosmos</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Deine gespeicherten Impulse, Upvotes, Notizen, Thesen & Lernpfade
          </Text>
        </View>

        <View style={styles.headerActions}>
          {isHyperspaceEnabled && (
            <View style={[styles.toggleGroup, { borderColor: colors.borderSubtle, backgroundColor: colors.surfaceSecondary }]}>
              <TouchableOpacity
                style={[styles.toggleBtn, viewMode === '3d' && { backgroundColor: colors.surface }]}
                onPress={() => setViewMode('3d')}
                accessibilityRole="button"
                accessibilityLabel="3D-Kosmos"
              >
                <Ionicons name="planet-outline" size={14} color={viewMode === '3d' ? colors.accent : colors.textMuted} style={{ marginRight: 5 }} />
                <Text style={[styles.toggleBtnText, { color: viewMode === '3d' ? colors.accent : colors.textMuted }]}>3D-Kosmos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, viewMode === '2d' && { backgroundColor: colors.surface }]}
                onPress={() => setViewMode('2d')}
                accessibilityRole="button"
                accessibilityLabel="2D-Liste"
              >
                <Ionicons name="list-outline" size={14} color={viewMode === '2d' ? colors.accent : colors.textMuted} style={{ marginRight: 5 }} />
                <Text style={[styles.toggleBtnText, { color: viewMode === '2d' ? colors.accent : colors.textMuted }]}>2D-Liste</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
            onPress={handleExportMarkdown}
            accessibilityRole="button"
            accessibilityLabel="Markdown exportieren"
          >
            <Ionicons name="download-outline" size={15} color={colors.textPrimary} style={{ marginRight: 5 }} />
            <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Markdown</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
            onPress={() => setShowAddThoughtModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Neuer Gedanke"
          >
            <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Gedanke</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={[styles.content, webScrollStyle]}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Instant Top Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <Ionicons name="search-outline" size={17} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Alles wiederfinden, was ich gespeichert, geupvoted oder notiert habe…"
            placeholderTextColor={colors.textMuted}
            value={kosmosSearch}
            onChangeText={setKosmosSearch}
            returnKeyType="search"
            accessibilityLabel="Wissenskosmos durchsuchen"
          />
          {kosmosSearch.length > 0 && (
            <TouchableOpacity
              onPress={() => setKosmosSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Suche leeren"
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills Bar (1 Ionicon each, 0 emojis, pure trace counts) */}
        <View style={{ marginBottom: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsRow}>
            {filterOptions.map(opt => {
              const isActive = kosmosFilter === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setKosmosFilter(opt.key)}
                  style={[
                    styles.filterPill,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle },
                    isActive && { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${opt.label} (${opt.count})`}
                >
                  <Ionicons
                    name={opt.icon}
                    size={13}
                    color={isActive ? colors.accent : colors.textSecondary}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.filterPillText, { color: isActive ? colors.accent : colors.textPrimary }]}>
                    {opt.label} ({opt.count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Empty State / Filter Hint Banner */}
        {filteredPureTraceNodes.length === 0 && (
          <View style={[styles.emptyFilterBanner, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
            <Ionicons name="filter-outline" size={14} color={colors.accent} style={{ marginRight: 8 }} />
            <Text style={[styles.emptyFilterText, { color: colors.textSecondary }]}>
              {totalTraceCount === 0
                ? 'Noch keine eigenen Spuren vorhanden — speichere, upvote oder notiere Impulse im Stream.'
                : normalizedQuery
                ? `Keine Treffer für „${kosmosSearch.trim()}“ im aktuellen Filter.`
                : 'Keine Spuren im gewählten Filter vorhanden.'}
            </Text>
            {(kosmosFilter !== 'all' || normalizedQuery.length > 0) && (
              <TouchableOpacity
                onPress={() => {
                  setKosmosFilter('all');
                  setKosmosSearch('');
                }}
                style={{ marginLeft: 'auto', paddingLeft: 10 }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>Zurücksetzen</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Main 3D Kosmos View */}
        {viewMode === '3d' && isHyperspaceEnabled ? (
          <View style={styles.canvasWrapper}>
            {/* 3D Geometry Switcher Bar */}
            <View style={[styles.galaxyControlsBar, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              <View style={styles.presetSelectorGroup}>
                {geometryOptions.map(geom => {
                  const isActive = galaxyMode === geom.key;
                  return (
                    <TouchableOpacity
                      key={geom.key}
                      onPress={() => setGalaxyMode(geom.key)}
                      style={[
                        styles.galaxyPresetBtn,
                        { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle },
                        isActive && { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Ansicht ${geom.label}`}
                    >
                      <Ionicons
                        name={geom.icon}
                        size={14}
                        color={isActive ? colors.accent : colors.textSecondary}
                        style={{ marginRight: 5 }}
                      />
                      <Text style={[styles.galaxyPresetBtnText, { color: isActive ? colors.accent : colors.textPrimary }]}>
                        {geom.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Real Three.js 3D WebGL Canvas */}
            <HyperspaceCanvas
              nodes={canvasNodes}
              edges={hyperspaceEdges}
              onSelectNode={handleNodeClick}
              colors={colors}
              isDark={isDark}
              galaxyMode={galaxyMode}
              selectedNodeId={selectedGalaxyNode?.id ?? null}
            />

            {/* Refined Detail Inspector Card */}
            {selectedGalaxyNode && selectedBadgeMeta && selectedJumpMeta && (
              <View style={[styles.inspectorCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                <View style={styles.inspectorHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={styles.inspectorBadgeRow}>
                      <View
                        style={[
                          styles.inspectorBadge,
                          {
                            backgroundColor: (selectedGalaxyNode.color || colors.accent) + '1F',
                            borderColor: selectedGalaxyNode.color || colors.accent
                          }
                        ]}
                      >
                        <Ionicons
                          name={selectedBadgeMeta.icon}
                          size={12}
                          color={selectedGalaxyNode.color || colors.accent}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.inspectorBadgeText, { color: selectedGalaxyNode.color || colors.accent }]}>
                          {selectedBadgeMeta.label}
                        </Text>
                      </View>
                      {selectedGalaxyNode.space && (
                        <Text style={[styles.inspectorSpaceText, { color: colors.accent }]}>
                          {selectedGalaxyNode.space}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.inspectorTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                      {selectedGalaxyNode.title}
                    </Text>
                    {selectedGalaxyNode.subtitle && (
                      <Text style={[styles.inspectorSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                        {selectedGalaxyNode.subtitle}
                      </Text>
                    )}
                    {selectedGalaxyNode.reasonText && (
                      <Text style={[styles.inspectorReason, { color: colors.textMuted }]}>
                        {selectedGalaxyNode.reasonText}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedGalaxyNode(null)}
                    style={[styles.inspectorCloseBtn, { backgroundColor: colors.surfaceSecondary }]}
                    accessibilityRole="button"
                    accessibilityLabel="Knoten-Inspektor schließen"
                  >
                    <Ionicons name="close" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {selectedGalaxyNode.noteText && (
                  <View style={[styles.inspectorNoteBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                    <Ionicons name="document-text-outline" size={14} color={colors.accent} style={{ marginRight: 6, marginTop: 2 }} />
                    <Text style={[styles.inspectorNoteText, { color: colors.textPrimary }]}>
                      {selectedGalaxyNode.noteText}
                    </Text>
                  </View>
                )}

                <View style={styles.inspectorActionsRow}>
                  <TouchableOpacity
                    onPress={() => handlePrimaryJump(selectedGalaxyNode)}
                    style={[styles.inspectorActionBtn, { backgroundColor: colors.accent }]}
                    accessibilityRole="button"
                    accessibilityLabel={selectedJumpMeta.label}
                  >
                    <Ionicons name={selectedJumpMeta.icon} size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.inspectorActionBtnText}>{selectedJumpMeta.label}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleInvestigateNode(selectedGalaxyNode)}
                    style={[
                      styles.inspectorActionBtn,
                      { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, borderWidth: 1 }
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Untersuchen"
                  >
                    <Ionicons name="telescope-outline" size={14} color={colors.accent} style={{ marginRight: 6 }} />
                    <Text style={[styles.inspectorActionBtnText, { color: colors.textPrimary }]}>Untersuchen</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setShowBreathingPortal(true)}
                    style={[
                      styles.inspectorActionBtn,
                      { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, borderWidth: 1 }
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Atem-Pause"
                  >
                    <Ionicons name="leaf-outline" size={14} color="#10B981" style={{ marginRight: 6 }} />
                    <Text style={[styles.inspectorActionBtnText, { color: '#10B981' }]}>Atem-Pause</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ) : (
          /* 2D Searchable Trace List View */
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Meine Spuren ({filteredPureTraceNodes.length})
              </Text>
            </View>
            {filteredPureTraceNodes.length > 0 && (
              <View style={styles.thoughtGrid}>
                {filteredPureTraceNodes.map(node => {
                  const badge = getInspectorBadgeMeta(node);
                  return (
                    <TouchableOpacity
                      key={node.id}
                      style={[styles.thoughtCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                      onPress={() => handlePrimaryJump(node)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.thoughtCardHeader}>
                        <View style={[styles.inspectorBadge, { backgroundColor: node.color + '1F', borderColor: node.color }]}>
                          <Ionicons name={badge.icon} size={12} color={node.color} style={{ marginRight: 4 }} />
                          <Text style={[styles.inspectorBadgeText, { color: node.color }]}>{badge.label}</Text>
                        </View>
                        {node.space && (
                          <Text style={[styles.connCount, { color: colors.accent }]}>{node.space}</Text>
                        )}
                      </View>
                      <Text style={[styles.thoughtCardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                        {node.title}
                      </Text>
                      {(node.noteText || node.subtitle) && (
                        <Text style={[styles.thoughtCardBody, { color: colors.textSecondary }]} numberOfLines={3}>
                          {node.noteText || node.subtitle}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* 2D Knowledge Graph Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Eigene Gedanken & Forschungsfragen ({thoughts.length})
            </Text>
            <TouchableOpacity
              style={[styles.linkBtn, { borderColor: colors.borderSubtle }]}
              onPress={() => setShowConnectModal(true)}
            >
              <Ionicons name="link-outline" size={14} color={colors.accent} style={{ marginRight: 4 }} />
              <Text style={[styles.linkBtnText, { color: colors.accent }]}>Knoten verbinden</Text>
            </TouchableOpacity>
          </View>

          {thoughts.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              <Ionicons name="git-network-outline" size={32} color={colors.textMuted} style={{ marginBottom: 8 }} />
              <Text style={[styles.emptyCardTitle, { color: colors.textPrimary }]}>Noch keine eigenen Einträge im Netzwerk</Text>
              <Text style={[styles.emptyCardDesc, { color: colors.textSecondary }]}>
                Nutze im Feed oder Reader die Gesten „Notiz“, „These“ oder „Einwand“, oder lege direkt oben einen Gedanken an.
              </Text>
            </View>
          ) : (
            <View style={styles.thoughtGrid}>
              {thoughts.map(t => {
                const conns = connections.filter(c => c.sourceId === t.id || c.targetId === t.id);
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.thoughtCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                    onPress={() => setSelectedNode(t)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.thoughtCardHeader}>
                      <View style={[styles.badge, { backgroundColor: colors.surfaceSecondary }]}>
                        <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{t.type.toUpperCase()}</Text>
                      </View>
                      <Text style={[styles.connCount, { color: colors.textMuted }]}>
                        {conns.length} {conns.length === 1 ? 'Kante' : 'Kanten'}
                      </Text>
                    </View>
                    <Text style={[styles.thoughtCardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                      {t.title}
                    </Text>
                    {t.body ? (
                      <Text style={[styles.thoughtCardBody, { color: colors.textSecondary }]} numberOfLines={3}>
                        {t.body}
                      </Text>
                    ) : null}
                    {t.tags.length > 0 && (
                      <View style={styles.tagRow}>
                        {t.tags.map((tag, idx) => (
                          <Text key={idx} style={[styles.tag, { color: colors.accent }]}>
                            #{tag}
                          </Text>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Recherche-Automation Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Recherche-Automation & Vorhaben
          </Text>
          <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
            Ausdrücklich konfigurierte Vorhaben. Ein Probelauf zeigt die Wirkung, ohne Daten zu verändern.
          </Text>

          {automationResult && (
            <View style={[styles.automationResultBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.accent }]}>
              <Text style={[styles.automationResultText, { color: colors.textPrimary }]}>{automationResult}</Text>
              <TouchableOpacity onPress={() => setAutomationResult(null)} style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 11, color: colors.accent }}>Ausblenden</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.rulesList}>
            {automationRules.map(rule => (
              <View key={rule.id} style={[styles.ruleCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                <View style={styles.ruleCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.ruleTitle, { color: colors.textPrimary }]}>{rule.title}</Text>
                    <Text style={[styles.ruleDesc, { color: colors.textSecondary }]}>{rule.description}</Text>
                    <Text style={[styles.ruleScope, { color: colors.textMuted }]}>
                      Scope: {rule.scope.question || rule.scope.topic || 'Alle Themen'} · Max: {rule.scope.maxItems} Quellen
                    </Text>
                  </View>
                </View>

                <View style={styles.ruleActions}>
                  <TouchableOpacity
                    style={[styles.ruleBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                    onPress={() => handleRunAutomation(rule.id, true)}
                  >
                    <Ionicons name="eye-outline" size={13} color={colors.textPrimary} style={{ marginRight: 4 }} />
                    <Text style={[styles.ruleBtnText, { color: colors.textPrimary }]}>Probelauf</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.ruleBtn, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}
                    onPress={() => handleRunAutomation(rule.id, false)}
                  >
                    <Ionicons name="play" size={13} color={colors.accent} style={{ marginRight: 4 }} />
                    <Text style={[styles.ruleBtnText, { color: colors.accent, fontWeight: '700' }]}>Ausführen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Modal: Neuer Gedanke */}
      <Modal visible={showAddThoughtModal} animationType="slide" transparent onRequestClose={() => setShowAddThoughtModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Neuer Gedanke / These</Text>
              <TouchableOpacity onPress={() => setShowAddThoughtModal(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.typeSelectorRow}>
              {(['thought', 'thesis', 'question', 'concept'] as ThoughtNodeType[]).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeBtn,
                    { borderColor: colors.borderSubtle },
                    thoughtType === t && { backgroundColor: colors.accent, borderColor: colors.accent }
                  ]}
                  onPress={() => setThoughtType(t)}
                >
                  <Text style={[styles.typeBtnText, { color: thoughtType === t ? '#FFFFFF' : colors.textSecondary }]}>
                    {t === 'thought' ? 'Gedanke' : t === 'thesis' ? 'These' : t === 'question' ? 'Frage' : 'Konzept'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderSubtle, backgroundColor: colors.surfaceSecondary }]}
              placeholder="Titel oder zentrale These…"
              placeholderTextColor={colors.textMuted}
              value={thoughtTitle}
              onChangeText={setThoughtTitle}
            />

            <TextInput
              style={[styles.textArea, { color: colors.textPrimary, borderColor: colors.borderSubtle, backgroundColor: colors.surfaceSecondary }]}
              placeholder="Vertiefung, Begründung oder Kontext (optional)…"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              value={thoughtBody}
              onChangeText={setThoughtBody}
            />

            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderSubtle, backgroundColor: colors.surfaceSecondary }]}
              placeholder="Tags (kommagetrennt, z. B. erkenntnistheorie, fokus)…"
              placeholderTextColor={colors.textMuted}
              value={thoughtTags}
              onChangeText={setThoughtTags}
            />

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.accent }]} onPress={handleCreateThought}>
              <Text style={styles.submitBtnText}>Im Wissensnetz verankern</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Knoten verbinden */}
      <Modal visible={showConnectModal} animationType="slide" transparent onRequestClose={() => setShowConnectModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Beziehung herstellen</Text>
              <TouchableOpacity onPress={() => setShowConnectModal(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Ausgangs-Knoten:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {pureTraceNodes.map(n => (
                <TouchableOpacity
                  key={`src-${n.id}`}
                  style={[
                    styles.nodeChip,
                    { borderColor: colors.borderSubtle },
                    sourceNodeId === n.id && { backgroundColor: colors.accent, borderColor: colors.accent }
                  ]}
                  onPress={() => setSourceNodeId(n.id)}
                >
                  <Text style={[styles.nodeChipText, { color: sourceNodeId === n.id ? '#FFFFFF' : colors.textPrimary }]}>
                    {n.title.slice(0, 24)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Ziel-Knoten:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {pureTraceNodes.map(n => (
                <TouchableOpacity
                  key={`tgt-${n.id}`}
                  style={[
                    styles.nodeChip,
                    { borderColor: colors.borderSubtle },
                    targetNodeId === n.id && { backgroundColor: colors.accent, borderColor: colors.accent }
                  ]}
                  onPress={() => setTargetNodeId(n.id)}
                >
                  <Text style={[styles.nodeChipText, { color: targetNodeId === n.id ? '#FFFFFF' : colors.textPrimary }]}>
                    {n.title.slice(0, 24)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Art der Beziehung:</Text>
            <View style={styles.relationSelectorRow}>
              {(['belongs_to', 'cites', 'proves', 'contradicts', 'raises_question', 'inspires'] as ConnectionRelation[]).map(r => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.typeBtn,
                    { borderColor: colors.borderSubtle },
                    relation === r && { backgroundColor: colors.accent, borderColor: colors.accent }
                  ]}
                  onPress={() => setRelation(r)}
                >
                  <Text style={[styles.typeBtnText, { color: relation === r ? '#FFFFFF' : colors.textSecondary }]}>
                    {r.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.borderSubtle, backgroundColor: colors.surfaceSecondary, marginTop: 12 }]}
              placeholder="Optionale Begründung oder Anmerkung…"
              placeholderTextColor={colors.textMuted}
              value={connectionAnnotation}
              onChangeText={setConnectionAnnotation}
            />

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.accent, marginTop: 16 }]} onPress={handleCreateConnection}>
              <Text style={styles.submitBtnText}>Verbindung herstellen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Thought Details */}
      {selectedNode && (
        <Modal visible={Boolean(selectedNode)} animationType="fade" transparent onRequestClose={() => setSelectedNode(null)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              <View style={styles.modalHeader}>
                <View style={[styles.badge, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{selectedNode.type.toUpperCase()}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedNode(null)}>
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalTitle, { color: colors.textPrimary, marginTop: 8 }]}>{selectedNode.title}</Text>
              {selectedNode.body ? (
                <Text style={[styles.modalBodyText, { color: colors.textSecondary, marginTop: 8 }]}>{selectedNode.body}</Text>
              ) : null}

              {selectedNode.sourceArticleTitle && (
                <View style={[styles.sourceBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.sourceBoxLabel, { color: colors.textMuted }]}>Verknüpfter Quellbeitrag:</Text>
                  <Text style={[styles.sourceBoxTitle, { color: colors.textPrimary }]}>{selectedNode.sourceArticleTitle}</Text>
                  {selectedNode.sourceArticleId && (
                    <TouchableOpacity
                      style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => {
                        const id = selectedNode.sourceArticleId!;
                        setSelectedNode(null);
                        void openArticle(id);
                      }}
                    >
                      <Ionicons name="book-outline" size={14} color={colors.accent} style={{ marginRight: 5 }} />
                      <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '600' }}>Im Reader öffnen</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <View style={styles.nodeModalActions}>
                {isFeatureEnabled(profile, 'investigation') && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.accent, borderColor: colors.accent, marginRight: 8 }]}
                    onPress={() => {
                      const q = selectedNode.type === 'question' ? selectedNode.title : `Was trägt die These: „${selectedNode.title}“?`;
                      setSelectedNode(null);
                      openInvestigation(null, q);
                    }}
                  >
                    <Ionicons name="telescope-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Untersuchen</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.deleteBtn, { borderColor: colors.danger }]}
                  onPress={() => handleDeleteThought(selectedNode.id)}
                >
                  <Ionicons name="trash-outline" size={14} color={colors.danger} style={{ marginRight: 4 }} />
                  <Text style={[styles.deleteBtnText, { color: colors.danger }]}>Löschen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Hivemind Learning Tracks Modal */}
      {showHivemindModal && (
        <HivemindStreamModal
          visible={showHivemindModal}
          onClose={() => setShowHivemindModal(false)}
          onStartFocusTrack={handleStartFocusTrackFromModal}
        />
      )}

      {/* Atmen Breathing Portal Modal */}
      <AtmenBreathingPortal
        visible={showBreathingPortal}
        mode="modal"
        onClose={() => setShowBreathingPortal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    ...(Platform.OS === 'web' ? ({ overflow: 'hidden' } as unknown as ViewStyle) : {})
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12
  },
  headerLeft: {
    flex: 1,
    minWidth: 260
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  toggleGroup: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 2
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600'
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600'
  },
  content: {
    flex: 1,
    minHeight: 0
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    marginBottom: 12
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0
  },
  canvasWrapper: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden'
  },
  section: {
    marginBottom: 32
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2
  },
  sectionDesc: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 14
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1
  },
  linkBtnText: {
    fontSize: 12,
    fontWeight: '600'
  },
  emptyCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4
  },
  emptyCardDesc: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 420
  },
  thoughtGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  thoughtCard: {
    flex: 1,
    minWidth: 260,
    maxWidth: 380,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1
  },
  thoughtCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700'
  },
  connCount: {
    fontSize: 11
  },
  thoughtCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 6
  },
  thoughtCardBody: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  tag: {
    fontSize: 11,
    fontWeight: '500'
  },
  rulesList: {
    gap: 12
  },
  ruleCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1
  },
  ruleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  ruleTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4
  },
  ruleDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6
  },
  ruleScope: {
    fontSize: 11
  },
  ruleActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end'
  },
  ruleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1
  },
  ruleBtnText: {
    fontSize: 12
  },
  automationResultBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12
  },
  automationResultText: {
    fontSize: 13,
    lineHeight: 18
  },
  toast: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    width: '100%',
    maxWidth: 520,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700'
  },
  modalBodyText: {
    fontSize: 14,
    lineHeight: 20
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  typeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '600'
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 10
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6
  },
  nodeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 6
  },
  nodeChipText: {
    fontSize: 12
  },
  relationSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  submitBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  sourceBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1
  },
  sourceBoxLabel: {
    fontSize: 11
  },
  sourceBoxTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2
  },
  nodeModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '600'
  },
  galaxyControlsBar: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10
  },
  presetSelectorGroup: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  galaxyPresetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1
  },
  galaxyPresetBtnText: {
    fontSize: 12,
    fontWeight: '600'
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600'
  },
  inspectorCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3
  },
  inspectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  inspectorBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6
  },
  inspectorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1
  },
  inspectorBadgeText: {
    fontSize: 10,
    fontWeight: '700'
  },
  inspectorSpaceText: {
    fontSize: 11,
    fontWeight: '700'
  },
  inspectorTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22
  },
  inspectorSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  inspectorReason: {
    fontSize: 11,
    marginTop: 4
  },
  inspectorCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  inspectorNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10
  },
  inspectorNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18
  },
  inspectorActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap'
  },
  inspectorActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  inspectorActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  },
  emptyFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12
  },
  emptyFilterText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17
  }
});
