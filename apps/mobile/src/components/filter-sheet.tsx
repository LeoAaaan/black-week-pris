import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DEFAULT_FILTERS, type SearchFilters, type SearchResponseDTO } from '@bwp/shared';
import { radius, space, useTheme } from '@/lib/theme';
import { Chip } from './ui';

const DISCOUNT_STEPS = [10, 20, 30, 50];

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function parseKr(text: string): number | undefined {
  const n = Number(text.replace(/\s/g, ''));
  return text.trim() === '' || !Number.isFinite(n) ? undefined : Math.max(0, Math.floor(n));
}

export function FilterSheet({
  visible,
  filters,
  facets,
  onClose,
  onApply,
}: {
  visible: boolean;
  filters: SearchFilters;
  facets: SearchResponseDTO['facets'] | undefined;
  onClose: () => void;
  onApply: (f: SearchFilters) => void;
}) {
  const t = useTheme();
  const [draft, setDraft] = useState(filters);
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');

  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setMinText(filters.minPrice != null ? String(filters.minPrice) : '');
      setMaxText(filters.maxPrice != null ? String(filters.maxPrice) : '');
    }
  }, [visible, filters]);

  const set = (patch: Partial<SearchFilters>) => setDraft((d) => ({ ...d, ...patch }));

  const apply = () => onApply({ ...draft, minPrice: parseKr(minText), maxPrice: parseKr(maxText) });
  const reset = () => {
    setDraft({ ...DEFAULT_FILTERS, q: draft.q, sort: draft.sort });
    setMinText('');
    setMaxText('');
  };

  const inputStyle = [styles.input, { borderColor: t.border, color: t.text, backgroundColor: t.surface }];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'bottom']}>
        <View style={[styles.header, { borderColor: t.border }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={{ color: t.text, fontSize: 16 }}>Lukk</Text>
          </Pressable>
          <Text style={[styles.title, { color: t.text }]}>Filtre</Text>
          <Pressable onPress={reset} hitSlop={12}>
            <Text style={{ color: t.text, fontSize: 16 }}>Nullstill</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Section title="Pris (totalpris med frakt)">
            <View style={styles.row}>
              <TextInput
                style={inputStyle}
                placeholder="Fra kr"
                placeholderTextColor={t.textMuted}
                keyboardType="number-pad"
                value={minText}
                onChangeText={setMinText}
                accessibilityLabel="Minstepris i kroner"
              />
              <Text style={{ color: t.textMuted }}>–</Text>
              <TextInput
                style={inputStyle}
                placeholder="Til kr"
                placeholderTextColor={t.textMuted}
                keyboardType="number-pad"
                value={maxText}
                onChangeText={setMaxText}
                accessibilityLabel="Makspris i kroner"
              />
            </View>
          </Section>

          <Section title="Minste rabatt">
            <View style={styles.chips}>
              {DISCOUNT_STEPS.map((pct) => (
                <Chip
                  key={pct}
                  label={`${pct} %`}
                  selected={draft.minDiscount === pct}
                  onPress={() => set({ minDiscount: draft.minDiscount === pct ? undefined : pct })}
                />
              ))}
            </View>
          </Section>

          <Section title="">
            <ToggleRow label="Bare varer på lager" value={draft.inStock} onChange={(v) => set({ inStock: v })} />
            <ToggleRow label="Bare gratis frakt" value={draft.freeShipping} onChange={(v) => set({ freeShipping: v })} />
          </Section>

          {facets?.stores.length ? (
            <Section title="Butikk">
              <View style={styles.chips}>
                {facets.stores.map((s) => (
                  <Chip
                    key={s.value}
                    label={s.label}
                    count={s.count}
                    selected={draft.stores.includes(s.value)}
                    onPress={() => set({ stores: toggle(draft.stores, s.value) })}
                  />
                ))}
              </View>
            </Section>
          ) : null}

          {facets?.categories.length ? (
            <Section title="Kategori">
              <View style={styles.chips}>
                {facets.categories.map((c) => (
                  <Chip
                    key={c.value}
                    label={c.label}
                    count={c.count}
                    selected={draft.category === c.value}
                    onPress={() => set({ category: draft.category === c.value ? undefined : c.value })}
                  />
                ))}
              </View>
            </Section>
          ) : null}

          {facets?.brands.length ? (
            <Section title="Merke">
              <View style={styles.chips}>
                {facets.brands.map((b) => (
                  <Chip
                    key={b.value}
                    label={b.label}
                    count={b.count}
                    selected={draft.brands.includes(b.value)}
                    onPress={() => set({ brands: toggle(draft.brands, b.value) })}
                  />
                ))}
              </View>
            </Section>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { borderColor: t.border, backgroundColor: t.bg }]}>
          <Pressable
            onPress={apply}
            style={({ pressed }) => [styles.apply, { backgroundColor: t.accent, opacity: pressed ? 0.8 : 1 }]}
            accessibilityRole="button"
          >
            <Text style={[styles.applyText, { color: t.accentText }]}>Vis resultater</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: space(2) }}>
      {title ? <Text style={[styles.sectionTitle, { color: t.text }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <View style={styles.toggleRow}>
      <Text style={{ color: t.text, fontSize: 16 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: '700' },
  content: { padding: space(4), gap: space(6), paddingBottom: space(10) },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  input: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space(3), paddingVertical: space(3), fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space(1) },
  footer: { padding: space(4), borderTopWidth: StyleSheet.hairlineWidth },
  apply: { borderRadius: radius.md, paddingVertical: space(4), alignItems: 'center' },
  applyText: { fontSize: 16, fontWeight: '800' },
});
