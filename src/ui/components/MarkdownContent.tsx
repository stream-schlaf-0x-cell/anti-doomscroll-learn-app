import React from 'react';
import { View, Text, StyleSheet, TextStyle } from 'react-native';
import { ThemeColors } from '../theme';
import {
  InlineToken,
  parseInlineFormatting,
  stripMarkdownFormatting
} from '../../core/utils/markdownUtils';

export { stripMarkdownFormatting, parseInlineFormatting };

interface MarkdownContentProps {
  content: string;
  bodyFontSize?: number;
  bodyLineHeight?: number;
  colors: ThemeColors;
  style?: TextStyle;
}

/**
 * High-performance, native-friendly Markdown Renderer tailored for editorial readability.
 * Renders H1, H2, H3, H4, blockquotes, lists, bold, and paragraphs with magazine-grade typography.
 */
export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  bodyFontSize = 18,
  bodyLineHeight = 32,
  colors,
  style
}) => {
  if (!content || !content.trim()) {
    return null;
  }

  // Split into structural blocks separated by blank lines
  const rawBlocks = content.split(/\n\s*\n/);

  const renderInlineTokens = (tokens: InlineToken[], baseStyle: TextStyle, keyPrefix: string) => {
    return tokens.map((token, idx) => {
      const tokenStyle: TextStyle = {
        fontWeight: token.bold ? '700' : baseStyle.fontWeight || '400',
        fontStyle: token.italic ? 'italic' : baseStyle.fontStyle || 'normal',
        fontFamily: token.code ? 'monospace' : undefined,
        backgroundColor: token.code ? colors.surfaceSecondary : undefined,
        color: baseStyle.color || colors.textPrimary
      };

      return (
        <Text key={`${keyPrefix}-${idx}`} style={tokenStyle}>
          {token.text}
        </Text>
      );
    });
  };

  return (
    <View style={styles.container}>
      {rawBlocks.map((block, blockIndex) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Heading 1: # Title
        if (trimmed.startsWith('# ')) {
          const text = trimmed.replace(/^#\s+/, '');
          const tokens = parseInlineFormatting(text);
          return (
            <Text
              key={blockIndex}
              style={[
                styles.h1,
                {
                  color: colors.textPrimary,
                  fontSize: Math.round(bodyFontSize * 1.5),
                  lineHeight: Math.round(bodyLineHeight * 1.35)
                }
              ]}
            >
              {renderInlineTokens(tokens, { color: colors.textPrimary, fontWeight: '700' }, `b-${blockIndex}`)}
            </Text>
          );
        }

        // Heading 2: ## Title
        if (trimmed.startsWith('## ')) {
          const text = trimmed.replace(/^##\s+/, '');
          const tokens = parseInlineFormatting(text);
          return (
            <Text
              key={blockIndex}
              style={[
                styles.h2,
                {
                  color: colors.textPrimary,
                  fontSize: Math.round(bodyFontSize * 1.3),
                  lineHeight: Math.round(bodyLineHeight * 1.25)
                }
              ]}
            >
              {renderInlineTokens(tokens, { color: colors.textPrimary, fontWeight: '700' }, `b-${blockIndex}`)}
            </Text>
          );
        }

        // Heading 3: ### Title (e.g. "### Die Entmaterialisierung der Architektur")
        if (trimmed.startsWith('### ')) {
          const text = trimmed.replace(/^###\s+/, '');
          const tokens = parseInlineFormatting(text);
          return (
            <View key={blockIndex} style={styles.h3Wrapper}>
              <View style={[styles.h3AccentLine, { backgroundColor: colors.accent }]} />
              <Text
                style={[
                  styles.h3,
                  {
                    color: colors.textPrimary,
                    fontSize: Math.round(bodyFontSize * 1.15),
                    lineHeight: Math.round(bodyLineHeight * 1.2)
                  }
                ]}
              >
                {renderInlineTokens(tokens, { color: colors.textPrimary, fontWeight: '700' }, `b-${blockIndex}`)}
              </Text>
            </View>
          );
        }

        // Heading 4: #### Title (e.g. "#### 1. Die Curtain Wall (Vorhangfassade)")
        if (trimmed.startsWith('#### ')) {
          const text = trimmed.replace(/^####\s+/, '');
          const tokens = parseInlineFormatting(text);
          return (
            <Text
              key={blockIndex}
              style={[
                styles.h4,
                {
                  color: colors.accent,
                  fontSize: Math.round(bodyFontSize * 1.05),
                  lineHeight: Math.round(bodyLineHeight * 1.15)
                }
              ]}
            >
              {renderInlineTokens(tokens, { color: colors.accent, fontWeight: '700' }, `b-${blockIndex}`)}
            </Text>
          );
        }

        // Blockquote: > Quote
        if (trimmed.startsWith('>')) {
          const lines = trimmed
            .split('\n')
            .map((l) => l.replace(/^>\s?/, ''))
            .join(' ');
          const tokens = parseInlineFormatting(lines);
          return (
            <View
              key={blockIndex}
              style={[
                styles.blockquote,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderLeftColor: colors.accent
                }
              ]}
            >
              <Text
                style={[
                  styles.blockquoteText,
                  {
                    color: colors.textPrimary,
                    fontSize: bodyFontSize,
                    lineHeight: bodyLineHeight
                  }
                ]}
              >
                {renderInlineTokens(tokens, { color: colors.textPrimary, fontStyle: 'italic' }, `b-${blockIndex}`)}
              </Text>
            </View>
          );
        }

        // Bullet list: - or *
        if (/^[-*]\s+/m.test(trimmed)) {
          const items = trimmed.split('\n').filter((l) => /^[-*]\s+/.test(l.trim()));
          return (
            <View key={blockIndex} style={styles.listContainer}>
              {items.map((item, itemIdx) => {
                const itemText = item.trim().replace(/^[-*]\s+/, '');
                const tokens = parseInlineFormatting(itemText);
                return (
                  <View key={itemIdx} style={styles.listItemRow}>
                    <Text style={[styles.listBullet, { color: colors.accent }]}>•</Text>
                    <Text
                      style={[
                        styles.listItemText,
                        {
                          color: colors.textPrimary,
                          fontSize: bodyFontSize,
                          lineHeight: bodyLineHeight
                        }
                      ]}
                    >
                      {renderInlineTokens(tokens, { color: colors.textPrimary }, `li-${blockIndex}-${itemIdx}`)}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        }

        // Numbered list: 1. 2.
        if (/^\d+\.\s+/m.test(trimmed)) {
          const items = trimmed.split('\n').filter((l) => /^\d+\.\s+/.test(l.trim()));
          return (
            <View key={blockIndex} style={styles.listContainer}>
              {items.map((item, itemIdx) => {
                const numMatch = item.trim().match(/^(\d+)\.\s+(.*)$/);
                const num = numMatch ? numMatch[1] : `${itemIdx + 1}`;
                const itemText = numMatch ? numMatch[2] : item.trim();
                const tokens = parseInlineFormatting(itemText);
                return (
                  <View key={itemIdx} style={styles.listItemRow}>
                    <Text style={[styles.listNumber, { color: colors.accent }]}>{num}.</Text>
                    <Text
                      style={[
                        styles.listItemText,
                        {
                          color: colors.textPrimary,
                          fontSize: bodyFontSize,
                          lineHeight: bodyLineHeight
                        }
                      ]}
                    >
                      {renderInlineTokens(tokens, { color: colors.textPrimary }, `nli-${blockIndex}-${itemIdx}`)}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        }

        // Regular Paragraph
        const tokens = parseInlineFormatting(trimmed);
        return (
          <Text
            key={blockIndex}
            style={[
              styles.paragraph,
              {
                color: colors.textPrimary,
                fontSize: bodyFontSize,
                lineHeight: bodyLineHeight
              },
              style
            ]}
          >
            {renderInlineTokens(tokens, { color: colors.textPrimary }, `p-${blockIndex}`)}
          </Text>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%'
  },
  h1: {
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 14,
    letterSpacing: -0.4
  },
  h2: {
    fontWeight: '700',
    marginTop: 22,
    marginBottom: 12,
    letterSpacing: -0.3
  },
  h3Wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 10
  },
  h3AccentLine: {
    width: 3.5,
    height: 20,
    borderRadius: 2,
    marginRight: 10
  },
  h3: {
    fontWeight: '700',
    letterSpacing: -0.2,
    flex: 1
  },
  h4: {
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: -0.15
  },
  blockquote: {
    borderLeftWidth: 3.5,
    paddingLeft: 16,
    paddingVertical: 10,
    marginVertical: 14,
    borderRadius: 4
  },
  blockquoteText: {
    fontStyle: 'italic'
  },
  listContainer: {
    marginVertical: 10
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  listBullet: {
    fontSize: 18,
    lineHeight: 28,
    marginRight: 10,
    fontWeight: '700'
  },
  listNumber: {
    fontSize: 15,
    lineHeight: 28,
    marginRight: 8,
    fontWeight: '700'
  },
  listItemText: {
    flex: 1
  },
  paragraph: {
    marginBottom: 18,
    letterSpacing: -0.15
  }
});
