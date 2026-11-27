import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { cheapestOffer, formatNok } from '@bwp/shared';
import { OfferRow } from '@/components/offer-row';
import { PriceChart } from '@/components/price-chart';
import { Card, DealBadge, Message, ProductThumb } from '@/components/ui';
import { api } from '@/lib/api';
import { space, useTheme } from '@/lib/theme';

export default function ProductScreen() {
  const t = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [onlyInStock, setOnlyInStock] = useState(false);

  const { data: product, isLoading, isError, error } = useQuery({
    queryKey: ['product', slug],
    queryFn: ({ signal }) => api.product(slug, signal),
    enabled: !!slug,
  });

  if (isLoading) return <ActivityIndicator style={{ marginTop: space(10) }} />;
  if (isError || !product) {
    return <Message title="Kunne ikke vise produktet" body={error instanceof Error ? error.message : undefined} />;
  }

  const offers = onlyInStock
    ? product.offers.filter((o) => o.stockStatus === 'in_stock' || o.stockStatus === 'low_stock')
    : product.offers;
  const best = cheapestOffer(offers);

  return (
    <>
      <Stack.Screen options={{ title: product.brand }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <ProductThumb brand={product.brand} size={72} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.brand, { color: t.textMuted }]}>
              {product.brand} · {product.category.name}
            </Text>
            <Text style={[styles.name, { color: t.text }]}>{product.name}</Text>
            {product.modelNumber ? (
              <Text style={{ color: t.textMuted, fontSize: 12 }}>Modell {product.modelNumber}</Text>
            ) : null}
          </View>
        </View>

        {best ? (
          <Card style={{ gap: space(2) }}>
            <Text style={{ color: t.textMuted }}>
              Billigst hos <Text style={{ color: t.text, fontWeight: '700' }}>{best.store.name}</Text>
            </Text>
            <Text style={[styles.bestPrice, { color: t.text }]}>{formatNok(best.totalOre)}</Text>
            <Text style={{ color: t.textMuted, fontSize: 13 }}>inkl. frakt · {product.offers.length} butikker sammenlignet</Text>
            <DealBadge deal={best.dealCheck} detailed />
            <PriceChart points={product.lowestPriceHistory} />
          </Card>
        ) : null}

        <View style={styles.listHeader}>
          <Text style={[styles.sectionTitle, { color: t.text }]}>Alle tilbud</Text>
          <View style={styles.toggle}>
            <Text style={{ color: t.textMuted }}>Bare på lager</Text>
            <Switch value={onlyInStock} onValueChange={setOnlyInStock} accessibilityLabel="Bare på lager" />
          </View>
        </View>

        {offers.length === 0 ? (
          <Message title="Ingen butikker har varen på lager akkurat nå" />
        ) : (
          offers.map((o) => <OfferRow key={o.id} offer={o} cheapest={o.id === best?.id} />)
        )}

        <Text style={[styles.footnote, { color: t.textMuted }]}>
          Totalpris er varepris pluss frakt. «Ekte tilbud» betyr at prisen er lavere enn den laveste prisen butikken
          hadde de 30 dagene før tilbudet startet. Prisene hentes jevnlig og kan ha endret seg hos butikken.
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(4), gap: space(3), paddingBottom: space(12) },
  hero: { flexDirection: 'row', gap: space(3), alignItems: 'center' },
  brand: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  name: { fontSize: 22, fontWeight: '800' },
  bestPrice: { fontSize: 32, fontWeight: '900', fontVariant: ['tabular-nums'] },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space(2) },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  footnote: { fontSize: 12, lineHeight: 17, marginTop: space(2) },
});
