import { StyleSheet, Text, View } from 'react-native';
import { formatNok, type PricePointDTO } from '@bwp/shared';
import { space, useTheme } from '@/lib/theme';

/** Enkel søylegraf over laveste pris per dag, uten ekstra biblioteker. */
export function PriceChart({ points }: { points: PricePointDTO[] }) {
  const t = useTheme();
  if (points.length < 2) return null;

  const prices = points.map((p) => p.priceOre);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = Math.max(max - min, 1);
  const last = prices[prices.length - 1]!;

  return (
    <View style={{ gap: space(2) }}>
      <View style={styles.legend}>
        <Text style={{ color: t.textMuted, fontSize: 12 }}>Laveste pris per dag, siste 2 måneder</Text>
        <Text style={{ color: t.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] }}>
          {formatNok(min)} – {formatNok(max)}
        </Text>
      </View>
      <View style={styles.bars} accessibilityLabel={`Prisgraf. Laveste ${formatNok(min)}, høyeste ${formatNok(max)}, nå ${formatNok(last)}`}>
        {points.map((p, i) => (
          <View
            key={p.recordedAt}
            style={{
              flex: 1,
              height: `${20 + ((p.priceOre - min) / span) * 80}%`,
              backgroundColor: i === points.length - 1 ? t.accent : p.priceOre === min ? t.good : t.border,
              borderTopLeftRadius: 2,
              borderTopRightRadius: 2,
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: space(1) },
  bars: { height: 64, flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
});
