import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatShipping, STOCK_LABELS, type ProductSummaryDTO } from '@bwp/shared';
import { space, useTheme } from '@/lib/theme';
import { BeforePrice, Card, DealBadge, DiscountBadge, Price, ProductThumb } from './ui';

export function ProductCard({ product }: { product: ProductSummaryDTO }) {
  const t = useTheme();
  const o = product.bestOffer;
  const inStock = o.stockStatus === 'in_stock' || o.stockStatus === 'low_stock';

  return (
    <Link href={{ pathname: '/produkt/[slug]', params: { slug: product.slug } }} asChild>
      <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })} accessibilityRole="link">
        <Card style={styles.card}>
          <ProductThumb brand={product.brand} />
          <View style={styles.body}>
            <Text style={[styles.brand, { color: t.textMuted }]}>{product.brand}</Text>
            <Text style={[styles.name, { color: t.text }]} numberOfLines={2}>
              {product.name}
            </Text>

            <View style={styles.priceRow}>
              <Price ore={o.totalOre} />
              <DiscountBadge pct={o.discountPct} />
              <BeforePrice ore={o.beforePriceOre} />
            </View>

            <Text style={[styles.meta, { color: t.textMuted }]}>
              hos <Text style={{ color: t.text, fontWeight: '700' }}>{o.store.name}</Text>
              {' · '}
              {product.offerCount === 1 ? '1 butikk' : `${product.offerCount} butikker`}
            </Text>
            <Text style={[styles.meta, { color: inStock ? t.good : t.textMuted }]}>
              {STOCK_LABELS[o.stockStatus]} · {formatShipping(o.shippingOre)}
            </Text>
            <DealBadge deal={o.dealCheck} />
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: space(3) },
  body: { flex: 1, gap: 3 },
  brand: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  name: { fontSize: 16, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), flexWrap: 'wrap', marginTop: 2 },
  meta: { fontSize: 13 },
});
