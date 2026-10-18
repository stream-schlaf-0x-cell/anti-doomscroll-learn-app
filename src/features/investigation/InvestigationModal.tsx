import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { FeedItem } from '../../core/domain/types';
import {
  Investigation,
  InvestigationResult,
  InvestigationSource,
  GroundedClaim
} from '../../core/investigation/types';
import { defaultInvestigationEngine } from '../../core/investigation/investigationEngine';
import { defaultInvestigationRepository } from '../../core/investigation/investigationRepository';
import { defaultGraphRepository } from '../../core/graph/graphRepository';
import { copyToClipboard } from '../../core/export/craftExport';

interface InvestigationModalProps {
  visible: boolean;
  onClose: () => void;
  initialArticle?: FeedItem | null;
  initialQuestion?: string | null;
}

export const InvestigationModal: React.FC<InvestigationModalProps> = ({
  visible,
  onClose,
  initialArticle,
  initialQuestion
}) => {
  const { colors, savedArticles } = useApp();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const [question, setQuestion] = useState<string>('');
  const [selectedSources, setSelectedSources] = useState<InvestigationSource[]>([]);
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'completed' | 'error'>('idle');
  const [currentInvestigation, setCurrentInvestigation] = useState<Investigation | null>(null);
  const [activeStepText, setActiveStepText] = useState<string>('');
  const [userVerdictText, setUserVerdictText] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showComparePicker, setShowComparePicker] = useState<boolean>(false);
  const [investigationId, setInvestigationId] = useState<string>('');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (!visible) return;

    const id = `inv-${Date.now()}`;
    setInvestigationId(id);
    setStatus('idle');
    setCurrentInvestigation(null);
    setUserVerdictText('');

    if (initialQuestion) {
      setQuestion(initialQuestion);
    } else if (initialArticle) {
      setQuestion(`Was wurde in „${initialArticle.title.slice(0, 60)}…“ tatsächlich untersucht und was trägt die Aussage?`);
    } else {
      setQuestion('');
    }

    if (initialArticle) {
      const fullText = (initialArticle.articleBody && initialArticle.articleBody.trim().length > 20)
        ? initialArticle.articleBody.trim()
        : (initialArticle.feedText || initialArticle.body || '').trim();

      const sourceObj: InvestigationSource = {
        id: initialArticle.id,
        title: initialArticle.title,
        publisher: initialArticle.sourceBroadcasterName || initialArticle.sourceReferences?.[0]?.publisher,
        author: initialArticle.sourceReferences?.[0]?.author,
        url: initialArticle.canonicalUrl || initialArticle.sourceReferences?.[0]?.originalUrl,
        publishedAt: initialArticle.publishedAt,
        fullTextAvailable: Boolean(initialArticle.articleBody && initialArticle.articleBody.length > 300),
        wordCount: fullText.split(/\s+/).length,
        contentSnippet: fullText
      };
      setSelectedSources([sourceObj]);
    } else {
      setSelectedSources([]);
    }
  }, [visible, initialArticle, initialQuestion]);

  // Execute investigation run
  const handleStartInvestigation = async (overrideSources?: InvestigationSource[], compareWith?: InvestigationResult) => {
    if (!question.trim()) {
      showToast('Bitte formuliere eine konkrete Leitfrage.');
      return;
    }

    const sourcesToUse = overrideSources || selectedSources;
    if (sourcesToUse.length === 0) {
      showToast('Mindestens eine Quelle erforderlich.');
      return;
    }

    setStatus('analyzing');
    setActiveStepText('1/3 Quellenmaterial lesen & Herkunft prüfen…');

    try {
      const stepTimer1 = setTimeout(() => {
        setActiveStepText('2/3 Belegstellen, Zitate & methodische Grenzen prüfen…');
      }, 900);

      const stepTimer2 = setTimeout(() => {
        setActiveStepText('3/3 Nüchternen Recherchebrief strukturieren…');
      }, 1800);

      const result = await defaultInvestigationEngine.runInvestigation(investigationId, {
        question: question.trim(),
        sources: sourcesToUse,
        compareWithPreviousResult: compareWith
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      const investigationRecord: Investigation = {
        id: investigationId,
        title: initialArticle?.title || question.trim().slice(0, 60),
        question: question.trim(),
        scope: sourcesToUse.length > 1 ? 'multi_source' : 'single_source',
        sources: sourcesToUse,
        status: 'completed',
        currentResult: result,
        historyVersions: currentInvestigation?.currentResult
          ? [...(currentInvestigation.historyVersions || []), currentInvestigation.currentResult]
          : [],
        userVerdict: userVerdictText,
        userNotes: currentInvestigation?.userNotes || [],
        connectedThoughtNodeIds: currentInvestigation?.connectedThoughtNodeIds || [],
        createdAt: currentInvestigation?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await defaultInvestigationRepository.saveInvestigation(investigationRecord);
      setCurrentInvestigation(investigationRecord);
      setStatus('completed');
    } catch (err: any) {
      if (err.message && err.message.includes('abgebrochen')) {
        setStatus('idle');
        showToast('Untersuchung wurde abgebrochen.');
      } else {
        setStatus('error');
        showToast(`Fehler: ${err.message || 'Untersuchung fehlgeschlagen'}`);
      }
    }
  };

  const handleCancel = () => {
    defaultInvestigationEngine.cancelInvestigation(investigationId);
    setStatus('idle');
  };

  const handleSaveVerdict = async () => {
    if (!currentInvestigation) return;
    await defaultInvestigationRepository.updateUserVerdict(currentInvestigation.id, userVerdictText);
    showToast('Dein persönliches Urteil wurde dauerhaft gespeichert.');
  };

  const handleExportMarkdown = async () => {
    if (!currentInvestigation) return;
    const md = defaultInvestigationRepository.exportInvestigationToMarkdown(currentInvestigation);
    const ok = await copyToClipboard(md);
    if (ok) {
      showToast('Recherchebrief als Markdown in die Zwischenablage kopiert!');
    }
  };

  // Connect claim into Knowledge Graph
  const handleConnectToGraph = async (claim: GroundedClaim) => {
    try {
      const node = await defaultGraphRepository.addThought({
        title: claim.claim.slice(0, 80),
        body: `> „${claim.exactQuote}“\n\nBelegte Aussage aus Untersuchung: ${claim.sourceTitle}`,
        type: 'thesis',
        tags: ['recherche', claim.evidenceType],
        sourceArticleId: claim.sourceId,
        sourceArticleTitle: claim.sourceTitle
      });

      if (currentInvestigation) {
        currentInvestigation.connectedThoughtNodeIds.push(node.id);
        await defaultInvestigationRepository.saveInvestigation(currentInvestigation);
      }

      showToast(`Als These „${node.title.slice(0, 30)}…“ ins Netzwerk übernommen!`);
    } catch {
      showToast('Knoten konnte nicht im Netzwerk angelegt werden.');
    }
  };

  // Trigger compare with a second saved article
  const handleSelectCompareArticle = (article: FeedItem) => {
    setShowComparePicker(false);
    const fullText = (article.articleBody && article.articleBody.trim().length > 20)
      ? article.articleBody.trim()
      : (article.feedText || article.body || '').trim();

    const secondSource: InvestigationSource = {
      id: article.id,
      title: article.title,
      publisher: article.sourceBroadcasterName || article.sourceReferences?.[0]?.publisher,
      author: article.sourceReferences?.[0]?.author,
      url: article.canonicalUrl || article.sourceReferences?.[0]?.originalUrl,
      publishedAt: article.publishedAt,
      fullTextAvailable: Boolean(article.articleBody && article.articleBody.length > 300),
      wordCount: fullText.split(/\s+/).length,
      contentSnippet: fullText
    };

    const updatedSources = [...selectedSources, secondSource];
    setSelectedSources(updatedSources);
    handleStartInvestigation(updatedSources, currentInvestigation?.currentResult);
  };

  if (!visible) return null;

  const result = currentInvestigation?.currentResult;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Toast */}
        {toastMessage && (
          <View style={[styles.toast, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
            <Text style={[styles.toastText, { color: colors.textPrimary }]}>{toastMessage}</Text>
          </View>
        )}

        <View
          style={[
            styles.modalContainer,
            isDesktop ? styles.desktopModal : styles.mobileModal,
            { backgroundColor: colors.surface, borderColor: colors.borderSubtle }
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconBox, { backgroundColor: colors.accentSubtle }]}>
                <Ionicons name="telescope-outline" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  Gezielte Untersuchung
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
                  Neugier ausführen: Nüchterne Recherche, Belegstellen & Grenzen
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceSecondary }]}
              accessibilityLabel="Schließen"
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {/* Sources in scope */}
            <View style={styles.sourcesBar}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                Ausgangsquellen ({selectedSources.length}):
              </Text>
              <View style={styles.sourcesPillsRow}>
                {selectedSources.map((s, idx) => (
                  <View
                    key={s.id || idx}
                    style={[styles.sourcePill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                  >
                    <Ionicons name="document-text-outline" size={12} color={colors.accent} style={{ marginRight: 4 }} />
                    <Text style={[styles.sourcePillText, { color: colors.textPrimary }]} numberOfLines={1}>
                      {s.title}
                    </Text>
                    {s.fullTextAvailable ? (
                      <Text style={[styles.sourceBadge, { color: '#10B981' }]}>[Volltext]</Text>
                    ) : (
                      <Text style={[styles.sourceBadge, { color: '#F59E0B' }]}>[Auszug]</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>

            {/* Leitfrage & Preset Prompts */}
            <View style={[styles.questionBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Deine Leitfrage:</Text>
              <TextInput
                style={[
                  styles.questionInput,
                  { color: colors.textPrimary, borderColor: colors.borderSubtle, backgroundColor: colors.surface }
                ]}
                value={question}
                onChangeText={setQuestion}
                placeholder="Was möchtest du an diesem Beitrag genau untersuchen?"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={2}
                editable={status !== 'analyzing'}
              />

              {/* Quick Template Buttons */}
              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={[styles.presetBtn, { borderColor: colors.borderSubtle }]}
                  onPress={() =>
                    setQuestion('Was wurde tatsächlich untersucht, welche Grenzen hat das Ergebnis, und was trägt die Aussage?')
                  }
                >
                  <Text style={[styles.presetBtnText, { color: colors.textSecondary }]}>
                    🔍 Kernaussagen & Belegprüfung
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.presetBtn, { borderColor: colors.borderSubtle }]}
                  onPress={() =>
                    setQuestion('Welche methodischen Einschränkungen, Gegenbelege oder alternativen Erklärungen existieren?')
                  }
                >
                  <Text style={[styles.presetBtnText, { color: colors.textSecondary }]}>
                    ⚖️ Grenzen & Einwände
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.presetBtn, { borderColor: colors.borderSubtle }]}
                  onPress={() =>
                    setQuestion('Was lässt sich aus diesen Erkenntnissen verantwortbar in die Praxis oder den Unterricht übertragen?')
                  }
                >
                  <Text style={[styles.presetBtnText, { color: colors.textSecondary }]}>
                    🏫 Praxistransfer
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Launch / Cancel Bar */}
              <View style={styles.actionLaunchRow}>
                {status === 'analyzing' ? (
                  <View style={styles.analyzingRow}>
                    <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 8 }} />
                    <Text style={[styles.analyzingText, { color: colors.accent }]}>{activeStepText}</Text>
                    <TouchableOpacity onPress={handleCancel} style={styles.cancelLink}>
                      <Text style={{ color: '#EF4444', fontSize: 13, marginLeft: 12 }}>Abbrechen</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.startBtn, { backgroundColor: colors.accent }]}
                    onPress={() => handleStartInvestigation()}
                  >
                    <Ionicons name="sparkles" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.startBtnText}>
                      {result ? 'Erneut untersuchen' : 'Untersuchung starten'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Results Presentation (Research Brief) */}
            {result && (
              <View style={styles.resultContainer}>
                {/* Mode & Timestamp Banner */}
                <View style={[styles.metaBanner, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.metaBannerText, { color: colors.textMuted }]}>
                    Stand: Version {result.version} • {new Date(result.timestamp).toLocaleTimeString('de-DE')} • Modus:{' '}
                    <Text style={{ color: colors.accent, fontWeight: '600' }}>
                      {result.executionMode === 'ai_real'
                        ? 'KI-Recherche (Gemini 3.8 Flash)'
                        : result.executionMode === 'cached'
                        ? 'Gecached (Kostensparend)'
                        : 'Deterministische Text-Extraktion'}
                    </Text>
                  </Text>
                  <TouchableOpacity onPress={handleExportMarkdown} style={styles.exportPill}>
                    <Ionicons name="download-outline" size={13} color={colors.accent} style={{ marginRight: 4 }} />
                    <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>Markdown</Text>
                  </TouchableOpacity>
                </View>

                {/* Diff from previous version if updated */}
                {result.diffFromPreviousVersion && (
                  <View style={[styles.diffCard, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}>
                    <View style={styles.diffHeader}>
                      <Ionicons name="git-commit-outline" size={16} color="#15803D" style={{ marginRight: 6 }} />
                      <Text style={{ color: '#15803D', fontWeight: '700', fontSize: 13 }}>
                        Erkenntnis-Update ({result.diffFromPreviousVersion.category})
                      </Text>
                    </View>
                    <Text style={{ color: '#166534', fontSize: 13, marginTop: 4 }}>
                      {result.diffFromPreviousVersion.summary}
                    </Text>
                    <Text style={{ color: '#14532D', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>
                      {result.diffFromPreviousVersion.impactOnPreviousClaims}
                    </Text>
                  </View>
                )}

                {/* 1. Synthesis Summary */}
                <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.cardHeader, { color: colors.accent }]}>
                    1. 💡 Was sich aus dem Material ableiten lässt
                  </Text>
                  <Text style={[styles.synthesisBody, { color: colors.textPrimary }]}>
                    {result.synthesisSummary}
                  </Text>
                </View>

                {/* 2. Grounded Claims & Quotes */}
                <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.cardHeader, { color: colors.accent }]}>
                    2. 📖 Belegstellen & Zitate (Darauf stützt sich diese Einordnung)
                  </Text>
                  {result.groundedClaims.map((claim, idx) => (
                    <View
                      key={claim.id || idx}
                      style={[styles.claimItem, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                    >
                      <View style={styles.claimTopRow}>
                        <View style={[styles.evidenceBadge, { backgroundColor: colors.accentSubtle }]}>
                          <Text style={[styles.evidenceBadgeText, { color: colors.accent }]}>
                            {claim.evidenceType === 'observation'
                              ? '🔍 Beobachtung'
                              : claim.evidenceType === 'interpretation'
                              ? '💭 Interpretation'
                              : claim.evidenceType === 'causal_claim'
                              ? '⚡ Kausalität'
                              : '⚖️ Werturteil'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.connectBtn, { borderColor: colors.borderSubtle }]}
                          onPress={() => handleConnectToGraph(claim)}
                          accessibilityLabel="Als These ins Netzwerk übernehmen"
                        >
                          <Ionicons name="git-network-outline" size={12} color={colors.accent} style={{ marginRight: 4 }} />
                          <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '600' }}>Ins Netzwerk</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={[styles.claimTitle, { color: colors.textPrimary }]}>{claim.claim}</Text>
                      {Boolean(claim.exactQuote) && (
                        <View style={[styles.quoteBox, { borderLeftColor: colors.accent }]}>
                          <Text style={[styles.quoteText, { color: colors.textSecondary }]}>
                            „{claim.exactQuote}“
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.claimSourceInfo, { color: colors.textMuted }]}>
                        Quelle: {claim.sourceTitle} • Evidenzsicherheit: {claim.confidence}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* 3. Limitations & Counterpoints */}
                <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.cardHeader, { color: '#8B5CF6' }]}>
                    3. ⚠️ Relevante Grenzen & methodische Einwände
                  </Text>
                  {result.limitationsAndCounterpoints.map((lim, idx) => (
                    <View key={idx} style={styles.bulletRow}>
                      <Ionicons name="alert-circle-outline" size={14} color="#8B5CF6" style={{ marginRight: 6, marginTop: 2 }} />
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{lim}</Text>
                    </View>
                  ))}
                </View>

                {/* 4. Open Questions */}
                <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.cardHeader, { color: '#F59E0B' }]}>
                    4. ❓ Was offen bleibt
                  </Text>
                  {result.openQuestions.map((q, idx) => (
                    <View key={idx} style={styles.bulletRow}>
                      <Ionicons name="help-circle-outline" size={14} color="#F59E0B" style={{ marginRight: 6, marginTop: 2 }} />
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{q}</Text>
                    </View>
                  ))}
                </View>

                {/* 5. Next Steps */}
                <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.cardHeader, { color: colors.textPrimary }]}>
                    5. 🚀 Mögliche nächste Schritte
                  </Text>
                  {result.suggestedNextSteps.map((step, idx) => (
                    <View
                      key={step.id || idx}
                      style={[styles.stepItem, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                    >
                      <View style={styles.stepHeader}>
                        <Text style={[styles.stepTypeBadge, { color: colors.accent }]}>
                          {step.type.toUpperCase()}
                        </Text>
                        <Text style={[styles.stepLabel, { color: colors.textPrimary }]}>{step.label}</Text>
                      </View>
                      <Text style={[styles.stepRationale, { color: colors.textSecondary }]}>
                        {step.rationale}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Action Bar: Compare second source / Check new sources */}
                <View style={styles.compareActionsBar}>
                  <TouchableOpacity
                    style={[styles.compareBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                    onPress={() => setShowComparePicker(true)}
                  >
                    <Ionicons name="git-compare-outline" size={15} color={colors.accent} style={{ marginRight: 6 }} />
                    <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>
                      Zweite Quelle vergleichen / Update anfordern
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* User Verdict & Sovereign Judgment */}
                <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
                  <Text style={[styles.cardHeader, { color: colors.textPrimary }]}>
                    ✍️ Mein persönliches Urteil (Unveränderbare Notiz)
                  </Text>
                  <Text style={[styles.verdictHint, { color: colors.textMuted }]}>
                    Die KI liefert Recherche und Belege. Deine eigene Schlussfolgerung bleibt davon getrennt und wird niemals überschrieben.
                  </Text>
                  <TextInput
                    style={[
                      styles.verdictInput,
                      { color: colors.textPrimary, borderColor: colors.borderSubtle, backgroundColor: colors.surfaceSecondary }
                    ]}
                    value={userVerdictText}
                    onChangeText={setUserVerdictText}
                    placeholder="Was überzeugt dich daran? Wo bleibst du skeptisch?"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                  />
                  <TouchableOpacity
                    style={[styles.saveVerdictBtn, { backgroundColor: colors.accent }]}
                    onPress={handleSaveVerdict}
                  >
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 12 }}>Urteil sichern</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Compare Article Picker Modal */}
          {showComparePicker && (
            <Modal visible={showComparePicker} transparent animationType="fade">
              <View style={styles.pickerBackdrop}>
                <View style={[styles.pickerContainer, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                  <View style={styles.pickerHeader}>
                    <Text style={[styles.pickerTitle, { color: colors.textPrimary }]}>
                      Zweite Quelle zum Vergleich auswählen
                    </Text>
                    <TouchableOpacity onPress={() => setShowComparePicker(false)}>
                      <Ionicons name="close" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={{ maxHeight: 340 }}>
                    {savedArticles.filter(a => !selectedSources.some(s => s.id === a.id)).length === 0 ? (
                      <Text style={{ color: colors.textMuted, padding: 16, textAlign: 'center' }}>
                        Keine weiteren gespeicherten Artikel zum Vergleich verfügbar. Speichere zuvor weitere Beiträge in der Bibliothek.
                      </Text>
                    ) : (
                      savedArticles
                        .filter(a => !selectedSources.some(s => s.id === a.id))
                        .map(art => (
                          <TouchableOpacity
                            key={art.id}
                            style={[styles.pickerItem, { borderBottomColor: colors.borderSubtle }]}
                            onPress={() => handleSelectCompareArticle(art)}
                          >
                            <Text style={[styles.pickerItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                              {art.title}
                            </Text>
                            <Text style={[styles.pickerItemMeta, { color: colors.textMuted }]}>
                              {art.sourceBroadcasterName || 'Quelle'} • {art.space}
                            </Text>
                          </TouchableOpacity>
                        ))
                    )}
                  </ScrollView>
                </View>
              </View>
            </Modal>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContainer: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: '92%',
    display: 'flex',
    flexDirection: 'column'
  },
  desktopModal: {
    width: 820
  },
  mobileModal: {
    width: '100%',
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700'
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollArea: {
    flex: 1
  },
  scrollContent: {
    padding: 20
  },
  sourcesBar: {
    marginBottom: 16
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  sourcesPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: '100%'
  },
  sourcePillText: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1
  },
  sourceBadge: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 6
  },
  questionBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8
  },
  questionInput: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top'
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10
  },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1
  },
  presetBtnText: {
    fontSize: 11,
    fontWeight: '500'
  },
  actionLaunchRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end'
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  analyzingText: {
    fontSize: 13,
    fontWeight: '600'
  },
  cancelLink: {
    padding: 4
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8
  },
  startBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13
  },
  resultContainer: {
    gap: 16
  },
  metaBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  metaBannerText: {
    fontSize: 12
  },
  exportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  diffCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1
  },
  diffHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  sectionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10
  },
  synthesisBody: {
    fontSize: 14,
    lineHeight: 22
  },
  claimItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8
  },
  claimTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  evidenceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  evidenceBadgeText: {
    fontSize: 11,
    fontWeight: '600'
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1
  },
  claimTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18
  },
  quoteBox: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginVertical: 6
  },
  quoteText: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 18
  },
  claimSourceInfo: {
    fontSize: 11,
    marginTop: 4
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6
  },
  bulletText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1
  },
  stepItem: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  stepTypeBadge: {
    fontSize: 10,
    fontWeight: '800',
    marginRight: 6
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '600'
  },
  stepRationale: {
    fontSize: 12,
    lineHeight: 17
  },
  compareActionsBar: {
    alignItems: 'center',
    marginVertical: 4
  },
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1
  },
  verdictHint: {
    fontSize: 12,
    marginBottom: 8
  },
  verdictInput: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    lineHeight: 18,
    textAlignVertical: 'top',
    marginBottom: 10
  },
  saveVerdictBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  toast: {
    position: 'absolute',
    top: 20,
    zIndex: 9999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600'
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  pickerContainer: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden'
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '700'
  },
  pickerItem: {
    padding: 14,
    borderBottomWidth: 1
  },
  pickerItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2
  },
  pickerItemMeta: {
    fontSize: 11
  }
});
