import React from 'react';
import { View, Text, StyleSheet, TextStyle, Linking, Platform } from 'react-native';
import { ThemeColors } from '../theme';
import {
  InlineToken,
  parseInlineFormatting,
  stripMarkdownFormatting,
  buildMarkdownBlocks,
  BULLET_LINE,
  NUMBERED_LINE
} from '../../core/utils/markdownUtils';

export { stripMarkdownFormatting, parseInlineFormatting, buildMarkdownBlocks };

interface MarkdownContentProps {
  content: string;
  bodyFontSize?: number;
  bodyLineHeight?: number;
  colors: ThemeColors;
  style?: TextStyle;
  /** Renders the first regular paragraph as a slightly larger magazine lede. */
  enableLede?: boolean;
}

function openExternalUrl(url: string) {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.open) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      void Linking.openURL(url).catch(() => {});
    }
  } catch {
    // non-fatal
  }
}

/**
 * High-performance, native-friendly Markdown Renderer tailored for editorial readability.
 * Renders H1–H4, block quotes, lists, links, bold/italic, dividers and a magazine lede.
 */
export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  bodyFontSize = 18,
  bodyLineHeight = 32,
  colors,
  style,
  enableLede = false
}) => {
  if (!content || !content.trim()) {
    return null;
  }

  const blocks = buildMarkdownBlocks(content);
  let ledeRendered = !enableLede;

  const renderInlineTokens = (tokens: InlineToken[], baseStyle: TextStyle, keyPrefix: string) => {
    return tokens.map((token, idx) => {
      if (token.url) {
        const url = token.url;
        return (
          <Text
            key={`${keyPrefix}-${idx}`}
            style={{
              color: colors.accent,
              fontWeight: '600',
              textDecorationLine: 'underline',
              textDecorationColor: colors.accent
            }}
            onPress={() => openExternalUrl(url)}
            accessibilityRole="link"
          >
            {token.text}
          </Text>
        );
      }
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
      {blocks.map((trimmed, blockIndex) => {
        // Divider
        if (trimmed === '---') {
          return <View key={blockIndex} style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />;
        }

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

        const blockLines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);

        // Bullet list: -, * or •
        if (blockLines.length > 0 && blockLines.every((l) => BULLET_LINE.test(l))) {
          return (
            <View key={blockIndex} style={styles.listContainer}>
              {blockLines.map((item, itemIdx) => {
                const itemText = item.replace(BULLET_LINE, '');
                const tokens = parseInlineFormatting(itemText);
                return (
                  <View key={itemIdx} style={styles.listItemRow}>
                    <Text style={[styles.listBullet, { color: colors.accent, lineHeight: bodyLineHeight }]}>•</Text>
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
        if (blockLines.length > 0 && blockLines.every((l) => NUMBERED_LINE.test(l))) {
          return (
            <View key={blockIndex} style={styles.listContainer}>
              {blockLines.map((item, itemIdx) => {
                const numMatch = item.match(/^(\d+)[.)]\s+(.*)$/);
                const num = numMatch ? numMatch[1] : `${itemIdx + 1}`;
                const itemText = numMatch ? numMatch[2] : item;
                const tokens = parseInlineFormatting(itemText);
                return (
                  <View key={itemIdx} style={styles.listItemRow}>
                    <Text style={[styles.listNumber, { color: colors.accent, lineHeight: bodyLineHeight }]}>{num}.</Text>
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

        // Mixed block (paragraph lines + list lines): render line by line
        if (blockLines.some((l) => BULLET_LINE.test(l)) && blockLines.length > 1) {
          return (
            <View key={blockIndex} style={styles.listContainer}>
              {blockLines.map((line, lineIdx) => {
                const isBullet = BULLET_LINE.test(line);
                const tokens = parseInlineFormatting(isBullet ? line.replace(BULLET_LINE, '') : line);
                return (
                  <View key={lineIdx} style={isBullet ? styles.listItemRow : styles.mixedParagraphRow}>
                    {isBullet && (
                      <Text style={[styles.listBullet, { color: colors.accent, lineHeight: bodyLineHeight }]}>•</Text>
                    )}
                    <Text
                      style={[
                        styles.listItemText,
                        { color: colors.textPrimary, fontSize: bodyFontSize, lineHeight: bodyLineHeight }
                      ]}
                    >
                      {renderInlineTokens(tokens, { color: colors.textPrimary }, `mx-${blockIndex}-${lineIdx}`)}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        }

        // Regular Paragraph (first one optionally rendered as a magazine lede)
        const tokens = parseInlineFormatting(blockLines.join('\n'));
        const isLede = !ledeRendered && trimmed.length >= 60;
        if (isLede) ledeRendered = true;
        return (
          <Text
            key={blockIndex}
            style={[
              styles.paragraph,
              {
                color: colors.textPrimary,
                fontSize: isLede ? bodyFontSize + 2 : bodyFontSize,
                lineHeight: isLede ? bodyLineHeight + 3 : bodyLineHeight
              },
              isLede && styles.lede,
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
    paddingRight: 12,
    paddingVertical: 10,
    marginVertical: 14,
    borderRadius: 4
  },
  blockquoteText: {
    fontStyle: 'italic'
  },
  listContainer: {
    marginTop: 4,
    marginBottom: 16
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  mixedParagraphRow: {
    flexDirection: 'row',
    marginBottom: 10
  },
  listBullet: {
    fontSize: 18,
    marginRight: 10,
    fontWeight: '700'
  },
  listNumber: {
    fontSize: 15,
    marginRight: 8,
    fontWeight: '700'
  },
  listItemText: {
    flex: 1
  },
  paragraph: {
    marginBottom: 18,
    letterSpacing: -0.15
  },
  lede: {
    fontWeight: '500',
    marginBottom: 22
  },
  divider: {
    height: 1,
    marginVertical: 22,
    width: '40%',
    alignSelf: 'center'
  }
});
