// Coercition de la donnée éditée (`unknown` dans BlockData) vers le type attendu par chaque widget.
// Gardes, pas de cast : la valeur peut venir du serveur (validée) ou d'une édition en cours.
import type { BlockData } from './types';

export const asString = (v: unknown): string => (typeof v === 'string' ? v : '');

export const asStringOrNull = (v: unknown): string | null =>
  typeof v === 'string' && v !== '' ? v : null;

export const asBool = (v: unknown): boolean => (typeof v === 'boolean' ? v : false);

export const asNumberOrNull = (v: unknown): number | null =>
  typeof v === 'number' && !Number.isNaN(v) ? v : null;

export const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const asRecord = (v: unknown): BlockData => (isRecord(v) ? v : {});

export const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// Champ number : la valeur saisie (Input type=number émet une string) → number | null.
export const parseNumberInput = (value: string, integer?: boolean): number | null => {
  if (value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return integer ? Math.trunc(n) : n;
};
