import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  countActiveFilters,
  parseSearchParams,
  SORT_LABELS,
  toSearchParams,
  type SearchFilters,
  type SortKey,
} from '@bwp/shared';
import { FilterSheet } from '@/components/filter-sheet';
import { ProductCard } from '@/components/product-card';
import { SearchBar } from '@/components/search-bar';
import { Chip, Message } from '@/components/ui';
import { api } from '@/lib/api';
import { radius, space, useTheme } from '@/lib/theme';

export default function SearchScreen() {
  const t = useTheme();
  const params = useLocalSearchParams<Record<string, string>>();

  // Filtrene ligger i URL-en, så et søk kan deles som lenke og overlever «tilbake».
  const filters = useMemo(() => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === 'string') sp.set(k, v);
    return parseSearchParams(sp);
  }, [params]);

  const setFilters = (next: SearchFilters) => {
    const sp = toSearchParams(next);
    const all = ['q', 'minPrice', 'maxPrice', 'stores', 'category', 'brands', 'inStock', 'minDiscount', 'freeShipping', 'sort'];
    router.setParams(Object.fromEntries(all.map((k) => [k, sp.get(k) ?? undefined])));
  };

  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['search', toSearchParams(filters).toString()],
    queryFn: ({ signal }) => api.search(filters, signal),
    placeholderData: keepPreviousData,
  });

  const activeCount = countActiveFilters(filters);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: t.header }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: t.headerText }]}>
            Black Week<Text style={{ color: t.accent }}>-pris</Text>
          </Text>
          {isFetching ? <ActivityIndicator color={t.accent} /> : null}
        </View>
        <SearchBar initial={filters.q} onSubmit={(q) => setFilters({ ...filters, q })} />
      </SafeAreaView>

      <View style={[styles.toolbar, { borderColor: t.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
          <Pressable
            onPress={() => setFiltersOpen(true)}
            style={[styles.filterButton, { backgroundColor: activeCount ? t.accent : t.surface, borderColor: t.border }]}
            accessibilityRole="button"
          >
            <Text style={{ color: activeCount ? t.accentText : t.text, fontWeight: '700' }}>
              Filter{activeCount ? ` (${activeCount})` : ''}
            </Text>
          </Pressable>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <Chip
              key={key}
              label={SORT_LABELS[key]}
              selected={filters.sort === key}
              onPress={() => setFilters({ ...filters, sort: key })}
            />
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: space(10) }} />
      ) : isError ? (
        <View>
          <Message title="Fikk ikke kontakt med serveren" body="Sjekk nettet og prøv igjen." />
          <Pressable onPress={() => refetch()} style={{ alignSelf: 'center' }}>
            <Text style={{ color: t.link, fontWeight: '700' }}>Prøv igjen</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data?.results ?? []}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <ProductCard product={item} />}
          contentContainerStyle={styles.list}
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            data ? (
              <Text style={{ color: t.textMuted, marginBottom: space(1) }}>
                {filters.q
                  ? `${data.total} treff for «${filters.q}»`
                  : `${data.total} produkter på tilbud`}
              </Text>
            ) : undefined
          }
          ListEmptyComponent={
            <Message
              title={filters.q ? `Ingen treff for «${filters.q}»` : 'Ingen produkter'}
              body={activeCount ? 'Prøv å fjerne noen filtre.' : 'Prøv et annet søkeord.'}
            />
          }
        />
      )}

      <FilterSheet
        visible={filtersOpen}
        filters={filters}
        facets={data?.facets}
        onClose={() => setFiltersOpen(false)}
        onApply={(f) => {
          setFiltersOpen(false);
          setFilters(f);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space(4), paddingBottom: space(3), gap: space(3), zIndex: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: space(2) },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  toolbar: { borderBottomWidth: StyleSheet.hairlineWidth },
  sortRow: { paddingHorizontal: space(4), paddingVertical: space(3), gap: space(2) },
  filterButton: {
    paddingHorizontal: space(4),
    paddingVertical: space(2),
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  list: { padding: space(4), gap: space(3) },
});
