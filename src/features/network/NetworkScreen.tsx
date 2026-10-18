import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { defaultGraphRepository } from '../../core/graph/graphRepository';
import { defaultAutomationEngine } from '../../core/automation/automationEngine';
import { UserThoughtNode, KnowledgeConnection, ThoughtNodeType, ConnectionRelation } from '../../core/graph/types';
import { AutomationRule } from '../../core/automation/types';
import { HyperspaceCanvas, HyperspaceNode, HyperspaceEdge } from './HyperspaceCanvas';
import { copyToClipboard } from '../../core/export/craftExport';
import { isFeatureEnabled } from '../../core/modules/featureRegistry';
import { TOPIC_SPACE_MAP, TopicTag } from '../../core/domain/types';

export const NetworkScreen: React.FC = () => {
  const { colors, isDark, profile, savedArticles, openArticle, openInvestigation } = useApp();

  const [thoughts, setThoughts] = useState<UserThoughtNode[]>([]);
  const [connections, setConnections] = useState<KnowledgeConnection[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');

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
    loadGraphData();
  }, [loadGraphData]);

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
      showToast('Gedanke im persönlichen Netzwerk verankert');
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
    } catch (err: any) {
      setAutomationResult(`Fehler: ${err?.message || 'Unbekannt'}`);
    }
  };

  // Convert thoughts and saved articles into HyperspaceNodes
  const hyperspaceNodes: HyperspaceNode[] = [
    ...thoughts.map(t => ({
      id: t.id,
      title: t.title,
      type: t.type,
      color: t.type === 'question' ? '#F59E0B' : t.type === 'thesis' ? '#EF4444' : '#8B5CF6',
      space: t.space
    })),
    ...savedArticles.map(a => ({
      id: a.id,
      title: a.title,
      type: 'article' as const,
      color: TOPIC_SPACE_MAP[a.primaryTopic as TopicTag]?.color || '#3B82F6',
      space: a.space
    }))
  ];

  const hyperspaceEdges: HyperspaceEdge[] = connections.map(c => ({
    id: c.id,
    sourceId: c.sourceId,
    targetId: c.targetId,
    relation: c.relation,
    annotation: c.annotation
  }));

  const handleNodeClick = (node: HyperspaceNode) => {
    if (node.type === 'article') {
      openArticle(node.id);
      return;
    }
    const foundThought = thoughts.find(t => t.id === node.id);
    if (foundThought) {
      setSelectedNode(foundThought);
    }
  };

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
          <Text style={[styles.title, { color: colors.textPrimary }]}>Persönliches Netzwerk</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Gedanken, Thesen, Primärquellen & nachvollziehbare Brücken
          </Text>
        </View>

        <View style={styles.headerActions}>
          {isHyperspaceEnabled && (
            <View style={[styles.toggleGroup, { borderColor: colors.borderSubtle, backgroundColor: colors.surfaceSecondary }]}>
              <TouchableOpacity
                style={[styles.toggleBtn, viewMode === '3d' && { backgroundColor: colors.surface }]}
                onPress={() => setViewMode('3d')}
                accessibilityLabel="3D-Kosmos"
              >
                <Ionicons name="planet" size={14} color={viewMode === '3d' ? colors.accent : colors.textMuted} style={{ marginRight: 4 }} />
                <Text style={[styles.toggleBtnText, { color: viewMode === '3d' ? colors.accent : colors.textMuted }]}>3D-Kosmos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, viewMode === '2d' && { backgroundColor: colors.surface }]}
                onPress={() => setViewMode('2d')}
                accessibilityLabel="2D-Liste"
              >
                <Ionicons name="list" size={14} color={viewMode === '2d' ? colors.accent : colors.textMuted} style={{ marginRight: 4 }} />
                <Text style={[styles.toggleBtnText, { color: viewMode === '2d' ? colors.accent : colors.textMuted }]}>2D-Liste</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
            onPress={handleExportMarkdown}
            accessibilityLabel="Markdown exportieren"
          >
            <Ionicons name="download-outline" size={16} color={colors.textPrimary} style={{ marginRight: 6 }} />
            <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Markdown</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
            onPress={() => setShowAddThoughtModal(true)}
            accessibilityLabel="Neuer Gedanke"
          >
            <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Gedanke</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Main View: 3D or 2D */}
        {viewMode === '3d' && isHyperspaceEnabled ? (
          <View style={styles.canvasWrapper}>
            <HyperspaceCanvas
              nodes={hyperspaceNodes}
              edges={hyperspaceEdges}
              onSelectNode={handleNodeClick}
              colors={colors}
              isDark={isDark}
            />
          </View>
        ) : null}

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

        {/* Recherche-Automation Section (Masterplan §7) */}
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
                      Scope: {rule.scope.question || rule.scope.topic || 'Alle Themen'} • Max: {rule.scope.maxItems} Quellen
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

            {/* Type selector */}
            <View style={styles.typeSelectorRow}>
              {(['thought', 'thesis', 'question', 'concept'] as ThoughtNodeType[]).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeBtn,
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
              <Text style={styles.submitBtnText}>Im Netzwerk verankern</Text>
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
              {hyperspaceNodes.map(n => (
                <TouchableOpacity
                  key={`src-${n.id}`}
                  style={[
                    styles.nodeChip,
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
              {hyperspaceNodes.map(n => (
                <TouchableOpacity
                  key={`tgt-${n.id}`}
                  style={[
                    styles.nodeChip,
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
                      style={{ marginTop: 6 }}
                      onPress={() => {
                        const id = selectedNode.sourceArticleId!;
                        setSelectedNode(null);
                        openArticle(id);
                      }}
                    >
                      <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '600' }}>Im Reader öffnen →</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
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
    gap: 8
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
    flex: 1
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60
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
  }
});
