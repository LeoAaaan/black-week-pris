import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatNok } from '@bwp/shared';
import { api } from '@/lib/api';
import { radius, space, useTheme } from '@/lib/theme';
import { useDebounced } from '@/lib/use-debounced';

/** Søkefelt med autoforslag. Forslagene tåler skrivefeil (trigram-søk i API-et). */
export function SearchBar({ initial, onSubmit }: { initial: string; onSubmit: (q: string) => void }) {
  const t = useTheme();
  const [text, setText] = useState(initial);
  const [focused, setFocused] = useState(false);
  const q = useDebounced(text.trim(), 150);

  const { data: suggestions } = useQuery({
    queryKey: ['suggest', q],
    queryFn: ({ signal }) => api.suggest(q, signal),
    enabled: q.length >= 2,
    staleTime: 60_000,
  });

  const showSuggestions = focused && q.length >= 2 && (suggestions?.length ?? 0) > 0;

  const submit = (value: string) => {
    setFocused(false);
    onSubmit(value.trim());
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.field, { backgroundColor: t.surface }]}>
        <Text style={{ color: t.textMuted, fontSize: 16 }}>⌕</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onSubmitEditing={() => submit(text)}
          placeholder="Søk etter produkt, f.eks. AirPods Pro"
          placeholderTextColor={t.textMuted}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          style={[styles.input, { color: t.text }]}
          accessibilityLabel="Søk etter produkt"
        />
        {text ? (
          <Pressable
            onPress={() => {
              setText('');
              submit('');
            }}
            hitSlop={10}
            accessibilityLabel="Tøm søk"
          >
            <Text style={{ color: t.textMuted, fontSize: 18 }}>×</Text>
          </Pressable>
        ) : null}
      </View>

      {showSuggestions ? (
        <View style={[styles.dropdown, { backgroundColor: t.surface, borderColor: t.border }]}>
          {suggestions!.map((s) => (
            <Pressable
              key={s.slug}
              onPress={() => {
                setFocused(false);
                router.push({ pathname: '/produkt/[slug]', params: { slug: s.slug } });
              }}
              style={({ pressed }) => [styles.suggestion, { backgroundColor: pressed ? t.surfaceAlt : 'transparent' }]}
            >
              <Text style={{ color: t.text, flex: 1 }} numberOfLines={1}>
                <Text style={{ fontWeight: '700' }}>{s.brand}</Text> {s.name}
              </Text>
              {s.lowestPriceOre != null ? (
                <Text style={{ color: t.textMuted, fontVariant: ['tabular-nums'] }}>fra {formatNok(s.lowestPriceOre)}</Text>
              ) : null}
            </Pressable>
          ))}
          <Pressable onPress={() => submit(text)} style={styles.suggestion}>
            <Text style={{ color: t.textMuted }}>Vis alle treff for «{text.trim()}»</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 10 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    borderRadius: radius.md,
    paddingHorizontal: space(3),
  },
  input: { flex: 1, fontSize: 16, paddingVertical: space(3) },
  dropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingHorizontal: space(3),
    paddingVertical: space(3),
  },
});
