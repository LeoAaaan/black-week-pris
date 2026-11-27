import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatDelivery,
  formatNok,
  formatPercent,
  formatRelativeTime,
  formatShipping,
  STOCK_LABELS,
  type OfferDTO,
} from '@bwp/shared';
import { radius, space, useTheme } from '@/lib/theme';
import { BeforePrice, Card, DealBadge, Price } from './ui';

export function OfferRow({ offer, cheapest }: { offer: OfferDTO; cheapest: boolean }) {
  const t = useTheme();
  const inStock = offer.stockStatus === 'in_stock' || offer.stockStatus === 'low_stock';
  const delivery = formatDelivery(offer.deliveryDaysMin, offer.deliveryDaysMax);

  return (
    <Card style={[styles.card, cheapest && { borderColor: t.accent, borderWidth: 2 }]}>
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.store, { color: t.text }]}>{offer.store.name}</Text>
          <Text style={{ color: inStock ? t.good : t.textMuted, fontSize: 13, fontWeight: '600' }}>
            ● {STOCK_LABELS[offer.stockStatus]}
            {delivery && inStock ? <Text style={{ color: t.textMuted, fontWeight: '400' }}> · Levering {delivery}</Text> : null}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          {cheapest ? (
            <View style={[styles.cheapest, { backgroundColor: t.accent }]}>
              <Text style={{ color: t.accentText, fontSize: 11, fontWeight: '800' }}>BILLIGST</Text>
            </View>
          ) : null}
          <Price ore={offer.totalOre} />
          <Text style={{ color: t.textMuted, fontSize: 12 }}>totalpris</Text>
        </View>
      </View>

      <View style={styles.details}>
        <Text style={{ color: t.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] }}>
          Pris {formatNok(offer.priceOre)} · {formatShipping(offer.shippingOre)}
        </Text>
        {offer.discountPct > 0 ? (
          <View style={styles.discountRow}>
            <BeforePrice ore={offer.beforePriceOre} />
            <Text style={{ color: t.sale, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              −{formatPercent(offer.discountPct)} (−{formatNok(offer.discountOre)})
            </Text>
          </View>
        ) : null}
      </View>

      <DealBadge deal={offer.dealCheck} detailed={offer.discountPct > 0} />

      <View style={styles.bottom}>
        <Text style={{ color: t.textMuted, fontSize: 12 }}>Pris oppdatert {formatRelativeTime(offer.lastCheckedAt)}</Text>
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(offer.url)}
          style={({ pressed }) => [styles.button, { backgroundColor: t.text, opacity: pressed ? 0.8 : 1 }]}
          accessibilityRole="link"
          accessibilityLabel={`Gå til ${offer.store.name}`}
        >
          <Text style={{ color: t.bg, fontWeight: '700' }}>Til butikken ↗</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space(2) },
  top: { flexDirection: 'row', gap: space(3) },
  store: { fontSize: 17, fontWeight: '700' },
  cheapest: { paddingHorizontal: space(2), paddingVertical: 2, borderRadius: radius.sm },
  details: { gap: 2 },
  discountRow: { flexDirection: 'row', gap: space(2), alignItems: 'center' },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space(1) },
  button: { paddingHorizontal: space(4), paddingVertical: space(2), borderRadius: radius.md },
});
