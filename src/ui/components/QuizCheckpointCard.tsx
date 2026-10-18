import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FeedQuizQuestion, FeedItem } from '../../core/domain/types';
import { useApp } from '../../core/context/AppContext';
import { appStorage } from '../../core/data/storage';
import { generateQuizWithAi } from '../../core/quiz/quizGenerator';
import { loadAiCredentials } from '../../core/ai/atmenAiClient';
import { typography, radius, spacing } from '../theme';

export interface QuizCheckpointCardProps {
  questions: FeedQuizQuestion[];
  title?: string;
  subtitle?: string;
  compact?: boolean;
  onComplete?: (score: number, total: number) => void;
}

export const QUIZ_STORAGE_KEY = '@atem:quiz_state:v1';

interface StoredQuizState {
  answeredQuestions: Record<string, { selectedIndex: number; isCorrect: boolean; timestamp: string }>;
  totalCorrect: number;
  totalAnswered: number;
}

export const QuizCheckpointCard: React.FC<QuizCheckpointCardProps> = ({
  questions,
  title = 'Wissens-Checkpoint & Bloomscrolling',
  subtitle = 'Reflektiere und festige deine Erkenntnisse der letzten Abschnitte',
  compact = false,
  onComplete
}) => {
  const { colors } = useApp();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [quizState, setQuizState] = useState<StoredQuizState>({
    answeredQuestions: {},
    totalCorrect: 0,
    totalAnswered: 0
  });

  const [activeQuestions, setActiveQuestions] = useState<FeedQuizQuestion[]>(questions);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [isAiGenerated, setIsAiGenerated] = useState<boolean>(false);

  useEffect(() => {
    setActiveQuestions(questions);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
  }, [questions]);

  const validQuestions = activeQuestions.filter(q => q && Array.isArray(q.options) && q.options.length >= 2);
  const currentQuestion = validQuestions[currentIndex];

  const handleGenerateAiQuestions = async () => {
    if (isGeneratingAi || !currentQuestion) return;
    setIsGeneratingAi(true);
    try {
      const creds = await loadAiCredentials();
      const mockItem: FeedItem = {
        id: currentQuestion.sourceArticleId || `item-${Date.now()}`,
        type: 'deep_dive',
        format: 'concise_insight',
        title: currentQuestion.sourceArticleTitle || currentQuestion.question,
        subtitle: currentQuestion.question,
        feedText: currentQuestion.question + ' ' + (currentQuestion.explanation || ''),
        articleBody: currentQuestion.question,
        body: currentQuestion.question,
        topics: ['philosophy_ethics'],
        primaryTopic: 'philosophy_ethics',
        sourceReferences: [],
        publishedAt: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        estimatedReadingMinutes: 3,
        relevanceExplanation: 'Quiz Generator Input',
        contentStatus: 'philosophical_perspective',
        isDailyEdition: false,
        editionDate: new Date().toISOString().slice(0, 10),
        isDemonstration: false,
        aiAssisted: true,
        factReviewStatus: 'philosophical_discourse',
        provenanceSummary: 'Atmen AI Quiz',
        wordCount: 150,
        evidenceTier: 'multiple_sources',
        contentOrigin: 'enriched_ai',
        contentHash: `hash-${Date.now()}`,
        canonicalUrl: 'https://atmen.network',
        space: 'c/philosophy_ethics',
        upvotesCount: 0,
        awardsCount: { gold: 0, brain: 0, spark: 0 },
        sourceTrustLevel: 'verified_creator',
        isTeachingRelated: false,
        isChallengingPerspective: false,
        comments: []
      };

      const generated = await generateQuizWithAi([mockItem], creds);
      if (generated && generated.length > 0) {
        setActiveQuestions(generated);
        setCurrentIndex(0);
        setSelectedOption(null);
        setIsAnswered(false);
        setIsAiGenerated(true);
      }
    } catch (e) {
      console.warn('AI Quiz generation failed', e);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    appStorage.getItem(QUIZ_STORAGE_KEY).then(raw => {
      if (raw && isMounted) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            setQuizState(parsed);
          }
        } catch {
          // Ignore
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!currentQuestion) {
    return null;
  }

  const handleSelectOption = async (optionIdx: number) => {
    if (isAnswered) return;

    setSelectedOption(optionIdx);
    setIsAnswered(true);

    const isCorrect = optionIdx === currentQuestion.correctIndex;
    const newScore = isCorrect ? score + 1 : score;
    setScore(newScore);

    const updatedState: StoredQuizState = {
      answeredQuestions: {
        ...quizState.answeredQuestions,
        [currentQuestion.id]: {
          selectedIndex: optionIdx,
          isCorrect,
          timestamp: new Date().toISOString()
        }
      },
      totalCorrect: isCorrect ? quizState.totalCorrect + 1 : quizState.totalCorrect,
      totalAnswered: quizState.totalAnswered + 1
    };
    setQuizState(updatedState);
    await appStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(updatedState));

    if (validQuestions.length === 1 && onComplete) {
      onComplete(isCorrect ? 1 : 0, 1);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < validQuestions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      if (onComplete) {
        onComplete(score, validQuestions.length);
      }
    }
  };

  const isLastQuestion = currentIndex + 1 >= validQuestions.length;

  return (
    <View
      style={[
        styles.container,
        compact ? styles.compactContainer : styles.fullContainer,
        {
          backgroundColor: compact ? colors.surfaceSecondary : colors.surface,
          borderColor: colors.borderSubtle
        }
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBox, { backgroundColor: '#F59E0B' + '22' }]}>
            <Ionicons name="bulb-outline" size={16} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {title}
            </Text>
            {!compact && (
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        {validQuestions.length > 1 && (
          <View style={[styles.badgePill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
              {currentIndex + 1} / {validQuestions.length}
            </Text>
          </View>
        )}
      </View>

      {/* Source attribution if available */}
      {currentQuestion.sourceArticleTitle && (
        <View style={styles.sourceBox}>
          <Ionicons name="book-outline" size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
          <Text style={[styles.sourceText, { color: colors.textMuted }]} numberOfLines={1}>
            Fokus: {currentQuestion.sourceArticleTitle}
          </Text>
        </View>
      )}

      {/* Question Text */}
      <Text style={[styles.questionText, { color: colors.textPrimary }]}>
        {currentQuestion.question}
      </Text>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {currentQuestion.options.map((option, idx) => {
          const isSelected = selectedOption === idx;
          const isCorrect = idx === currentQuestion.correctIndex;

          let btnBg = colors.surfaceSecondary;
          let btnBorder = colors.borderSubtle;
          let textColor = colors.textPrimary;
          let iconName: 'checkmark-circle' | 'close-circle' | null = null;
          let iconColor = '#10B981';

          if (isAnswered) {
            if (isCorrect) {
              btnBg = '#10B981' + '18';
              btnBorder = '#10B981';
              textColor = '#10B981';
              iconName = 'checkmark-circle';
              iconColor = '#10B981';
            } else if (isSelected) {
              btnBg = '#EF4444' + '18';
              btnBorder = '#EF4444';
              textColor = '#EF4444';
              iconName = 'close-circle';
              iconColor = '#EF4444';
            }
          } else if (isSelected) {
            btnBg = colors.accent + '20';
            btnBorder = colors.accent;
          }

          return (
            <TouchableOpacity
              key={idx}
              onPress={() => handleSelectOption(idx)}
              disabled={isAnswered}
              activeOpacity={0.7}
              style={[
                styles.optionButton,
                {
                  backgroundColor: btnBg,
                  borderColor: btnBorder
                }
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Antwortoption ${String.fromCharCode(65 + idx)}: ${option}`}
            >
              <View style={[styles.optionIndexBadge, { backgroundColor: colors.surface }]}>
                <Text style={[styles.optionIndexText, { color: colors.textSecondary }]}>
                  {String.fromCharCode(65 + idx)}
                </Text>
              </View>
              <Text style={[styles.optionText, { color: textColor }]}>
                {option}
              </Text>
              {iconName && (
                <Ionicons name={iconName} size={18} color={iconColor} style={{ marginLeft: 6 }} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Explanation & Next action */}
      {isAnswered && (
        <View style={[styles.explanationCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
            <Ionicons
              name={selectedOption === currentQuestion.correctIndex ? 'checkmark-circle-outline' : 'information-circle-outline'}
              size={18}
              color={selectedOption === currentQuestion.correctIndex ? '#10B981' : colors.accent}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.explanationTitle, { color: colors.textPrimary }]}>
                {selectedOption === currentQuestion.correctIndex ? 'Richtig verstanden!' : 'Didaktische Einordnung:'}
              </Text>
              <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
                {currentQuestion.explanation}
              </Text>
            </View>
          </View>

          {validQuestions.length > 1 && (
            <TouchableOpacity
              onPress={handleNext}
              style={[styles.nextButton, { backgroundColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel={isLastQuestion ? 'Checkpoint abschließen' : 'Nächste Frage'}
            >
              <Text style={styles.nextButtonText}>
                {isLastQuestion ? 'Abschließen & Weiterlesen' : 'Nächste Frage →'}
              </Text>
              <Ionicons name={isLastQuestion ? 'checkmark-done-outline' : 'arrow-forward-outline'} size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* AI Quiz Generation Footer Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: colors.borderSubtle, flexWrap: 'wrap', gap: 6 }}>
        {isAiGenerated ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10B98118', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm }}>
            <Ionicons name="sparkles" size={11} color="#10B981" />
            <Text style={{ fontSize: 10, color: '#10B981', fontWeight: '700' }}>✨ Live-KI generiert</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="hardware-chip-outline" size={11} color={colors.textMuted} />
            <Text style={{ fontSize: 10, color: colors.textMuted }}>Kuratierter Checkpoint</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleGenerateAiQuestions}
          disabled={isGeneratingAi}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.borderSubtle }}
          accessibilityRole="button"
          accessibilityLabel="Neue KI-Fragen generieren"
        >
          {isGeneratingAi ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <>
              <Ionicons name="sparkles" size={12} color={colors.accent} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent }}>✨ Neue KI-Fragen generieren</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden'
  },
  fullContainer: {
    padding: spacing.md,
    marginVertical: spacing.md
  },
  compactContainer: {
    padding: spacing.sm,
    marginTop: spacing.xs
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800'
  },
  subtitle: {
    fontSize: typography.sizes.micro,
    lineHeight: 14,
    marginTop: 1
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  badgeText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700'
  },
  sourceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  sourceText: {
    fontSize: typography.sizes.micro,
    fontStyle: 'italic'
  },
  questionText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: spacing.sm
  },
  optionsContainer: {
    gap: 6
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1
  },
  optionIndexBadge: {
    width: 20,
    height: 20,
    borderRadius: radius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8
  },
  optionIndexText: {
    fontSize: typography.sizes.micro,
    fontWeight: '800'
  },
  optionText: {
    flex: 1,
    fontSize: typography.sizes.caption,
    lineHeight: 18,
    fontWeight: '500'
  },
  explanationCard: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 0.5
  },
  explanationTitle: {
    fontSize: typography.sizes.caption,
    fontWeight: '800',
    marginBottom: 2
  },
  explanationText: {
    fontSize: typography.sizes.micro,
    lineHeight: 16
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignSelf: 'flex-end',
    marginTop: spacing.sm
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  }
});
