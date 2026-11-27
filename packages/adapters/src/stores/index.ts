import type { StoreAdapter } from '../types';
import { elkjop } from './elkjop';
import { komplett } from './komplett';
import { proshop } from './proshop';

/** Alle butikker med ekte adapter. Ny butikk: lag en fil her og legg den til i lista. */
export const adapters: Record<string, () => StoreAdapter> = { komplett, proshop, elkjop };
