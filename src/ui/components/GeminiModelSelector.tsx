import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import {
  GeminiModelEntry,
  ModelCategory,
  ModelStatus,
  GEMINI_MODEL_CATALOG,
  CATEGORY_LABELS,
  filterModelsForWorkflow,
  discoverLiveGeminiModels,
  validateModelChoice
} from '../../core/ai/geminiModelRegistry';
import { radius, spacing } from '../theme';

export interface GeminiModelSelectorProps {
  selectedModelId: string;
  onSelectModel: (modelId: string, model?: GeminiModelEntry) => void;
  workflow?: ModelCategory | 'all';
  apiKey?: string;
  allowCustomInput?: boolean;
}

export const GeminiModelSelector: React.FC<GeminiModelSelectorProps> = ({
  selectedModelId,
  onSelectModel,
  workflow = 'text',
  apiKey,
  allowCustomInput = true
}) => {
  const { colors } = useApp();

  const [activeCategory, setActiveCategory] = useState<ModelCategory | 'all'>(workflow);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showLegacy, setShowLegacy] = useState<boolean>(false);
  const [models, setModels] = useState<GeminiModelEntry[]>(GEMINI_MODEL_CATALOG);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [hasLiveDiscovery, setHasLiveDiscovery] = useState<boolean>(false);
  const [customModelText, setCustomModelText] = useState<string>('');
  const [expandedTooltipId, setExpandedTooltipId] = useState<string | null>(null);

  // Sync category if workflow changes
  useEffect(() => {
    setActiveCategory(workflow);
  }, [workflow]);

  // Load cached discovery or query models
  const loadModels = useCallback(async (force = false) => {
    if (force) setIsRefreshing(true);
    setDiscoveryError(null);
    try {
      const res = await discoverLiveGeminiModels(apiKey, { forceRefresh: force });
      setModels(res.models);
      setHasLiveDiscovery(res.accountVerified);
      if (res.error) {
        setDiscoveryError(res.error);
      }
    } catch (err) {
      setDiscoveryError(err instanceof Error ? err.message : String(err));
    } finally {
      if (force) setIsRefreshing(false);
    }
  }, [apiKey]);

  useEffect(() => {
    void loadModels(false);
  }, [loadModels]);

  // Filter models
  const filteredModels = useMemo(() => {
    let list = filterModelsForWorkflow(activeCategory, showLegacy, models);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        m =>
          m.id.toLowerCase().includes(q) ||
          m.label.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q)
      );
    }

    // Sort: Recommended first, then by status (stable -> preview -> experimental -> legacy)
    const statusOrder: Record<ModelStatus, number> = {
      stable: 1,
      preview: 2,
      experimental: 3,
      legacy: 4
    };

    return [...list].sort((a, b) => {
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      return (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5);
    });
  }, [activeCategory, showLegacy, models, searchQuery]);

  const selectedModelEntry = useMemo(
    () => models.find(m => m.id === selectedModelId),
    [models, selectedModelId]
  );

  const workflowValidation = useMemo(() => {
    if (workflow === 'all') return { valid: true };
    return validateModelChoice(selectedModelId, workflow, models);
  }, [selectedModelId, workflow, models]);

  const getStatusBadgeStyle = (status: ModelStatus) => {
    switch (status) {
      case 'stable':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', label: 'Stabil' };
      case 'preview':
        return { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', label: 'Preview' };
      case 'experimental':
        return { bg: 'rgba(245, 158, 11, 0.18)', text: '#F59E0B', label: 'Experimentell' };
      case 'legacy':
        return { bg: 'rgba(156, 163, 175, 0.18)', text: '#9CA3AF', label: 'Legacy' };
    }
  };

  const handleApplyCustomModel = () => {
    const trimmed = customModelText.trim();
    if (!trimmed) return;
    onSelectModel(trimmed);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="hardware-chip-outline" size={18} color={colors.accent} style={{ marginRight: 6 }} />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Google Gemini: {selectedModelEntry?.label || selectedModelId}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => void loadModels(true)}
          disabled={isRefreshing}
          style={[styles.refreshBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
          accessibilityRole="button"
          accessibilityLabel="Modelle live von Google abrufen"
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <>
              <Ionicons name="sync-outline" size={13} color={colors.accent} style={{ marginRight: 4 }} />
              <Text style={[styles.refreshBtnText, { color: colors.accent }]}>Live-Check</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Discovery Status Banner */}
      {hasLiveDiscovery && (
        <View style={[styles.statusBanner, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10B981' }]}>
          <Ionicons name="checkmark-circle" size={14} color="#10B981" style={{ marginRight: 6 }} />
          <Text style={[styles.statusBannerText, { color: '#10B981' }]}>
            Live mit deinem Google AI Studio Account verifiziert ({models.filter(m => m.liveVerified).length} Modelle aktiv)
          </Text>
        </View>
      )}

      {discoveryError && (
        <View style={[styles.statusBanner, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#EF4444' }]}>
          <Ionicons name="alert-circle" size={14} color="#EF4444" style={{ marginRight: 6 }} />
          <Text style={[styles.statusBannerText, { color: '#EF4444' }]} numberOfLines={2}>
            {discoveryError} (Kuratierter Stand: 18. Oktober 2026 aktiv)
          </Text>
        </View>
      )}

      {/* Workflow Incompatibility Alert */}
      {!workflowValidation.valid && (
        <View style={[styles.statusBanner, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#F59E0B' }]}>
          <Ionicons name="warning" size={14} color="#F59E0B" style={{ marginRight: 6 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusBannerText, { color: '#D97706', fontWeight: '700' }]}>
              Workflow-Warnung:
            </Text>
            <Text style={[styles.statusBannerText, { color: '#B45309' }]}>
              {workflowValidation.reason}
            </Text>
            {workflowValidation.suggestedModelId && (
              <TouchableOpacity
                onPress={() => onSelectModel(workflowValidation.suggestedModelId!)}
                style={{ marginTop: 4 }}
              >
                <Text style={{ fontSize: 11, color: colors.accent, fontWeight: '700', textDecorationLine: 'underline' }}>
                  Zu empfohlenem Modell wechseln ({workflowValidation.suggestedModelId})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Search Input Bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
        <Ionicons name="search-outline" size={15} color={colors.textMuted} style={{ marginRight: 6 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Modell suchen (z. B. 3.8 Flash, Banana, Argon)..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Pills (Workflow Switcher) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        <TouchableOpacity
          onPress={() => setActiveCategory('all')}
          style={[
            styles.categoryPill,
            activeCategory === 'all'
              ? { backgroundColor: colors.accent, borderColor: colors.accent }
              : { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
          ]}
        >
          <Text
            style={[
              styles.categoryPillText,
              { color: activeCategory === 'all' ? '#FFFFFF' : colors.textPrimary }
            ]}
          >
            Alle Bereiche
          </Text>
        </TouchableOpacity>

        {(Object.keys(CATEGORY_LABELS) as ModelCategory[]).map(cat => {
          const isSelected = activeCategory === cat;
          const meta = CATEGORY_LABELS[cat];
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => setActiveCategory(cat)}
              style={[
                styles.categoryPill,
                isSelected
                  ? { backgroundColor: colors.accent, borderColor: colors.accent }
                  : { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
              ]}
            >
              <Ionicons
                name={meta.icon as any}
                size={13}
                color={isSelected ? '#FFFFFF' : colors.textSecondary}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.categoryPillText,
                  { color: isSelected ? '#FFFFFF' : colors.textPrimary }
                ]}
              >
                {meta.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Legacy & Specialized Toggle */}
      <View style={styles.legacyToggleRow}>
        <TouchableOpacity
          onPress={() => setShowLegacy(!showLegacy)}
          style={styles.legacyToggleBtn}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: showLegacy }}
        >
          <Ionicons
            name={showLegacy ? 'checkbox-outline' : 'square-outline'}
            size={16}
            color={showLegacy ? colors.accent : colors.textMuted}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.legacyToggleText, { color: colors.textSecondary }]}>
            Legacy-Modelle einblenden (z.B. Gemini 2.5 Pro / Flash)
          </Text>
        </TouchableOpacity>

        <Text style={[styles.modelCountBadge, { color: colors.textMuted }]}>
          {filteredModels.length} verfügbar
        </Text>
      </View>

      {/* Model Cards List */}
      <View style={styles.modelsGrid}>
        {filteredModels.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={24} color={colors.textMuted} style={{ marginBottom: 6 }} />
            <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>
              Keine Modelle für diese Filterkombination gefunden.
            </Text>
          </View>
        ) : (
          filteredModels.map(model => {
            const isSelected = selectedModelId === model.id;
            const badgeMeta = getStatusBadgeStyle(model.status);
            const isTooltipOpen = expandedTooltipId === model.id;

            return (
              <TouchableOpacity
                key={model.id}
                onPress={() => onSelectModel(model.id, model)}
                style={[
                  styles.modelCard,
                  {
                    backgroundColor: isSelected ? colors.surfaceSecondary : colors.surface,
                    borderColor: isSelected ? colors.accent : colors.borderSubtle
                  },
                  isSelected && styles.modelCardSelected
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                {/* Top Row: Label, Status Badge & Radio Indicator */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <Text
                        style={[
                          styles.cardLabel,
                          { color: colors.textPrimary, fontWeight: isSelected ? '700' : '600' }
                        ]}
                      >
                        {model.label}
                      </Text>

                      {model.recommended && (
                        <View style={styles.recommendedBadge}>
                          <Text style={styles.recommendedBadgeText}>Empfohlen</Text>
                        </View>
                      )}

                      <View style={[styles.statusBadge, { backgroundColor: badgeMeta.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: badgeMeta.text }]}>
                          {badgeMeta.label}
                        </Text>
                      </View>

                      {model.liveVerified && (
                        <View style={[styles.statusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                          <Text style={[styles.statusBadgeText, { color: '#10B981' }]}>
                            ✓ Live
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.modelIdSubtext, { color: colors.textMuted }]}>
                      ID: {model.id}
                    </Text>
                  </View>

                  <View style={styles.radioIndicator}>
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={isSelected ? colors.accent : colors.textMuted}
                    />
                  </View>
                </View>

                {/* Description & Strength Explanation */}
                <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                  {model.description}
                </Text>

                {/* Tooltip / Details Toggle */}
                <TouchableOpacity
                  onPress={() => setExpandedTooltipId(isTooltipOpen ? null : model.id)}
                  style={styles.detailsToggle}
                >
                  <Ionicons
                    name={isTooltipOpen ? 'chevron-up-outline' : 'information-circle-outline'}
                    size={13}
                    color={colors.accent}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.detailsToggleText, { color: colors.accent }]}>
                    {isTooltipOpen ? 'Weniger Details' : 'Fähigkeiten & Methoden'}
                  </Text>
                </TouchableOpacity>

                {isTooltipOpen && (
                  <View style={[styles.tooltipBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                    <Text style={[styles.tooltipLine, { color: colors.textPrimary }]}>
                      • <Text style={{ fontWeight: '700' }}>Bereich:</Text> {CATEGORY_LABELS[model.category]?.label || model.category}
                    </Text>
                    <Text style={[styles.tooltipLine, { color: colors.textPrimary }]}>
                      • <Text style={{ fontWeight: '700' }}>Methoden:</Text> {model.supportedMethods.join(', ')}
                    </Text>
                    {model.contextWindow && (
                      <Text style={[styles.tooltipLine, { color: colors.textPrimary }]}>
                        • <Text style={{ fontWeight: '700' }}>Kontextfenster:</Text> {Math.round(model.contextWindow / 1024)}k Tokens
                      </Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Custom Model String Option */}
      {allowCustomInput && (
        <View style={[styles.customSection, { borderTopColor: colors.borderSubtle }]}>
          <Text style={[styles.customSectionTitle, { color: colors.textSecondary }]}>
            Manuelle Modell-ID eingeben (Spezial- oder Vorschau-Endpoint):
          </Text>
          <View style={styles.customInputRow}>
            <TextInput
              style={[
                styles.customInput,
                { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.borderSubtle }
              ]}
              placeholder="z. B. gemini-4-argon oder gemini-3.8-flash"
              placeholderTextColor={colors.textMuted}
              value={customModelText}
              onChangeText={setCustomModelText}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={handleApplyCustomModel}
              disabled={!customModelText.trim()}
              style={[
                styles.customApplyBtn,
                { backgroundColor: customModelText.trim() ? colors.accent : colors.surfaceSecondary }
              ]}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>Übernehmen</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Footer Info */}
      <View style={styles.footerRow}>
        <Ionicons name="shield-checkmark-outline" size={13} color={colors.textMuted} style={{ marginRight: 4 }} />
        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          Standard: Gemini 3.8 Flash • Geprüft nach Google Dokumentation Stand 18. Oktober 2026
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginVertical: spacing.sm
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700'
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  refreshBtnText: {
    fontSize: 11,
    fontWeight: '700'
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginVertical: 4
  },
  statusBannerText: {
    fontSize: 11
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginVertical: 6
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    paddingVertical: 2
  },
  categoryScroll: {
    flexDirection: 'row',
    marginVertical: 4
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '600'
  },
  legacyToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 6
  },
  legacyToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  legacyToggleText: {
    fontSize: 11
  },
  modelCountBadge: {
    fontSize: 11
  },
  modelsGrid: {
    gap: 8,
    marginVertical: 4
  },
  modelCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm
  },
  modelCardSelected: {
    borderWidth: 1.5
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  cardLabel: {
    fontSize: 13
  },
  modelIdSubtext: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2
  },
  radioIndicator: {
    marginLeft: 8,
    marginTop: 2
  },
  recommendedBadge: {
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  recommendedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#EC4899'
  },
  statusBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700'
  },
  cardDescription: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6
  },
  detailsToggleText: {
    fontSize: 10,
    fontWeight: '600'
  },
  tooltipBox: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 6,
    marginTop: 6
  },
  tooltipLine: {
    fontSize: 10,
    lineHeight: 14
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg
  },
  emptyStateText: {
    fontSize: 12
  },
  customSection: {
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 8
  },
  customSectionTitle: {
    fontSize: 11,
    marginBottom: 4
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: 12
  },
  customApplyBtn: {
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8
  },
  footerText: {
    fontSize: 10
  }
});
