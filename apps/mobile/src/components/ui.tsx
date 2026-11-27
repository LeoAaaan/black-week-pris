import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { DEAL_LABELS, formatNok, formatPercent, type DealCheck } from '@bwp/shared';
import { radius, space, useTheme } from '@/lib/theme';

export function Chip({
  label,
  selected,
  onPress,
  count,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  count?: number;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? t.text : t.surface,
          borderColor: selected ? t.text : t.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? t.bg : t.text }]}>
        {label}
        {count != null ? <Text style={{ color: selected ? t.bg : t.textMuted }}>{`  ${count}`}</Text> : null}
      </Text>
    </Pressable>
  );
}

export function DiscountBadge({ pct, style }: { pct: number; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  if (pct <= 0) return null;
  return (
    <View style={[styles.discount, { backgroundColor: t.sale }, style]}>
      <Text style={styles.discountText}>−{formatPercent(pct)}</Text>
    </View>
  );
}

/** «Ekte tilbud?»-merke. Kompakt i lister, med forklaring på produktsiden. */
export function DealBadge({ deal, detailed }: { deal: DealCheck; detailed?: boolean }) {
  const t = useTheme();
  const tone =
    deal.verdict === 'real'
      ? { bg: t.goodBg, fg: t.good, icon: '✓' }
      : deal.verdict === 'not_real'
        ? { bg: t.warnBg, fg: t.warn, icon: '!' }
        : { bg: t.neutralBg, fg: t.textMuted, icon: '–' };

  if (!detailed && deal.verdict === 'unknown') return null;

  return (
    <View style={[styles.deal, { backgroundColor: tone.bg }]}>
      <Text style={[styles.dealText, { color: tone.fg }]}>
        {tone.icon} {DEAL_LABELS[deal.verdict]}
      </Text>
      {detailed && deal.lowest30Ore != null ? (
        <Text style={[styles.dealSub, { color: tone.fg }]}>
          Laveste pris siste 30 dager før tilbudet: {formatNok(deal.lowest30Ore)}
        </Text>
      ) : null}
      {deal.inflatedBeforePrice ? (
        <Text style={[styles.dealSub, { color: t.warn }]}>Førprisen er høyere enn laveste pris siste 30 dager</Text>
      ) : null}
    </View>
  );
}

export function Price({ ore, size = 'md', style }: { ore: number; size?: 'sm' | 'md' | 'lg'; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  const fontSize = size === 'lg' ? 28 : size === 'md' ? 20 : 15;
  return <Text style={[{ fontSize, fontWeight: '800', color: t.text, fontVariant: ['tabular-nums'] }, style]}>{formatNok(ore)}</Text>;
}

export function BeforePrice({ ore }: { ore: number | null }) {
  const t = useTheme();
  if (ore == null) return null;
  return (
    <Text style={{ color: t.textMuted, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] }}>
      {formatNok(ore)}
    </Text>
  );
}

/** Plassholder for produktbilde: merkets forbokstav. Ekte bilder kommer med butikkdataene. */
export function ProductThumb({ brand, size = 56 }: { brand: string; size?: number }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: t.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.4, fontWeight: '800', color: t.textMuted }}>{brand.slice(0, 1)}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, style]}>{children}</View>;
}

export function Message({ title, body }: { title: string; body?: string }) {
  const t = useTheme();
  return (
    <View style={{ padding: space(8), alignItems: 'center', gap: space(2) }}>
      <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
      {body ? <Text style={{ color: t.textMuted, textAlign: 'center' }}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: space(3),
    paddingVertical: space(2),
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  discount: { paddingHorizontal: space(2), paddingVertical: 2, borderRadius: radius.sm, alignSelf: 'flex-start' },
  discountText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] },
  deal: { paddingHorizontal: space(2), paddingVertical: space(1), borderRadius: radius.sm, alignSelf: 'flex-start', gap: 2 },
  dealText: { fontSize: 12, fontWeight: '700' },
  dealSub: { fontSize: 12 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space(3) },
});
