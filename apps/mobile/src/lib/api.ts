import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  toSearchParams,
  type ProductDetailDTO,
  type SearchFilters,
  type SearchResponseDTO,
  type SuggestionDTO,
} from '@bwp/shared';

/**
 * Adressen til API-et. Settes med EXPO_PUBLIC_API_URL i produksjon.
 * I utvikling bruker vi samme maskin som Expo-serveren kjører på,
 * så appen på telefonen (Expo Go) finner API-et på det lokale nettet.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && Platform.OS !== 'web') return `http://${host}:3001`;
  return 'http://localhost:3001';
}

export const API_URL = resolveApiUrl();

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { signal });
  if (!res.ok) throw new Error(res.status === 404 ? 'Fant ikke det du lette etter' : `Noe gikk galt (${res.status})`);
  return (await res.json()) as T;
}

export const api = {
  search: (f: SearchFilters, signal?: AbortSignal) =>
    get<SearchResponseDTO>(`/api/search?${toSearchParams(f).toString()}`, signal),
  suggest: (q: string, signal?: AbortSignal) =>
    get<SuggestionDTO[]>(`/api/suggest?q=${encodeURIComponent(q)}`, signal),
  product: (slug: string, signal?: AbortSignal) =>
    get<ProductDetailDTO>(`/api/products/${encodeURIComponent(slug)}`, signal),
};
