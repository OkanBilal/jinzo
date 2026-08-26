import { Fragment, type ReactNode } from "react";
import { Linking, ScrollView, Text, View } from "react-native";

import { parseMarkdown, type Block, type Inline, type ListItem } from "@/lib/markdown";
import { colors, radius, spacing, useBrandColors } from "@/theme";

import { SFSymbol } from "./sf-symbol";
import { ThemedText } from "./themed-text";

/**
 * Agent prose, rendered onto the app's own type ramp.
 *
 * The desktop hands assistant text to `react-markdown` and lets a Tailwind
 * `prose` class style it; here each block maps to a `ThemedText` variant
 * instead, so a message sits on the same ramp as the rest of the app rather
 * than importing a second set of type decisions.
 */
export function Markdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source);
  return <BlockList blocks={blocks} />;
}

function BlockList({ blocks }: { blocks: Block[] }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </View>
  );
}

/**
 * Agent prose sits one step below `body`: a transcript is read at a glance and
 * scrolled, and 17pt turns a normal answer into several screens.
 */
const PROSE = "prose" as const;

/** Heading level → a step on the ramp. Levels past four all read as level four. */
const HEADING_VARIANTS = ["title3", "headline", "callout", "subhead"] as const;

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading": {
      const variant = HEADING_VARIANTS[Math.min(block.level, 4) - 1];
      return (
        <ThemedText
          variant={variant}
          selectable
          style={{ color: colors.label, fontWeight: "700", marginTop: spacing.xs }}
        >
          <InlineRun nodes={block.inline} />
        </ThemedText>
      );
    }

    case "paragraph":
      return (
        <ThemedText variant={PROSE} selectable>
          <InlineRun nodes={block.inline} />
        </ThemedText>
      );

    case "list":
      return (
        <View style={{ gap: spacing.xs }}>
          {block.items.map((item, i) => (
            <ListRow
              key={i}
              item={item}
              marker={block.ordered ? `${block.start + i}.` : "•"}
            />
          ))}
        </View>
      );

    case "code":
      return <CodeBlock text={block.text} />;

    case "quote":
      return (
        <View
          style={{
            borderLeftWidth: 3,
            borderLeftColor: colors.separator,
            paddingLeft: spacing.ms,
            gap: spacing.sm,
          }}
        >
          <BlockList blocks={block.blocks} />
        </View>
      );

    case "table":
      return <Table header={block.header} rows={block.rows} />;

    case "rule":
      return <View style={{ height: 1, backgroundColor: colors.separator, marginVertical: spacing.xs }} />;
  }
}

/** A list item: its marker in a fixed gutter, its blocks beside it. */
function ListRow({ item, marker }: { item: ListItem; marker: string }) {
  return (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      <View style={{ minWidth: 18, alignItems: "flex-end", paddingTop: item.checked === undefined ? 0 : 3 }}>
        {item.checked === undefined ? (
          <ThemedText variant={PROSE} style={{ color: colors.secondaryLabel }}>
            {marker}
          </ThemedText>
        ) : (
          <SFSymbol
            name={item.checked ? "checkmark.square.fill" : "square"}
            size={15}
            tint={item.checked ? colors.systemGreen : colors.tertiaryLabel}
          />
        )}
      </View>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <BlockList blocks={item.blocks} />
      </View>
    </View>
  );
}

/** A fenced block: monospaced, scrolled sideways so indentation survives. */
function CodeBlock({ text }: { text: string }) {
  return (
    <View
      style={{
        backgroundColor: colors.secondarySystemBackground,
        borderRadius: radius.md,
        borderCurve: "continuous",
        paddingVertical: spacing.sm,
        overflow: "hidden",
      }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ paddingHorizontal: spacing.ms }}>
          {text.split("\n").map((line, i) => (
            <ThemedText key={i} variant="mono" selectable style={{ color: colors.label }}>
              {line || " "}
            </ThemedText>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** GFM table. Columns keep a floor width and the whole grid scrolls sideways. */
function Table({ header, rows }: { header: Inline[][]; rows: Inline[][][] }) {
  const columns = Math.max(header.length, ...rows.map((r) => r.length), 1);

  const cells = (row: Inline[][], head: boolean) => (
    <View style={{ flexDirection: "row" }}>
      {Array.from({ length: columns }, (_, c) => (
        <View
          key={c}
          style={{
            minWidth: 110,
            flex: 1,
            paddingVertical: spacing.xs + 2,
            paddingRight: spacing.ms,
          }}
        >
          <ThemedText
            variant="footnote"
            selectable
            style={{ color: colors.label, fontWeight: head ? "600" : "400" }}
          >
            <InlineRun nodes={row[c] ?? []} />
          </ThemedText>
        </View>
      ))}
    </View>
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={{ borderBottomWidth: 1, borderBottomColor: colors.separator }}>
          {cells(header, true)}
        </View>
        {rows.map((row, i) => (
          <View
            key={i}
            style={{
              borderBottomWidth: i === rows.length - 1 ? 0 : 1,
              borderBottomColor: colors.separator,
            }}
          >
            {cells(row, false)}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/**
 * Inline runs, as nested `Text`.
 *
 * Everything below the block level has to stay inside one `Text` tree — a
 * `View` mid-sentence would break the line box — so emphasis, code and links
 * are text styles. Each node sets only its *delta* (weight, slant, color) and
 * never a size: RN inherits the rest, which is what lets a bold run inside an
 * h1 stay h1-sized instead of snapping back to body.
 */
function InlineRun({ nodes }: { nodes: Inline[] }): ReactNode {
  return nodes.map((node, i) => <InlineNode key={i} node={node} />);
}

function InlineNode({ node }: { node: Inline }) {
  const brand = useBrandColors();

  switch (node.type) {
    case "text":
      return <Fragment>{node.text}</Fragment>;

    case "strong":
      return (
        <Text style={{ fontWeight: "700" }}>
          <InlineRun nodes={node.children} />
        </Text>
      );

    case "em":
      return (
        <Text style={{ fontStyle: "italic" }}>
          <InlineRun nodes={node.children} />
        </Text>
      );

    case "strike":
      return (
        <Text style={{ textDecorationLine: "line-through", color: colors.secondaryLabel }}>
          <InlineRun nodes={node.children} />
        </Text>
      );

    case "code":
      // No background: iOS paints a nested Text's background across the rest of
      // the line when the span wraps, which leaves a slab hanging off the end of
      // every wrapped code span. The face change carries the distinction alone.
      return <Text style={{ fontFamily: "Menlo", color: colors.label }}>{node.text}</Text>;

    case "link":
      return (
        <Text
          style={{ color: brand.accent }}
          onPress={() => {
            void Linking.openURL(node.href).catch(() => {});
          }}
        >
          <InlineRun nodes={node.children} />
        </Text>
      );
  }
}
