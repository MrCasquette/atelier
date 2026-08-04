import { asc, type Column, desc, eq, inArray, type SQL } from '@echoppe/core';
import { type TSchema, t } from 'elysia';

// =============================================================================
// LIST — SSOT des endpoints collection : une seule enveloppe { data, meta },
// un seul builder, un seul contrat de query (pagination + tri + filtres).
//
// L'enveloppe et la meta sont IDENTIQUES pour tous les consommateurs (admin via
// Eden, front via @echoppe/client). Ce qui varie par entité/audience, c'est
// uniquement le schéma d'item (projection) et l'allowlist tri/filtre passée à
// `parseListQuery` — jamais la forme de la réponse.
//
// La query execution (jointures, enrichissement, subqueries) reste dans la
// route : on factorise le CONTRAT, pas le SQL.
// =============================================================================

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// Fragments de query composables. `listQuery` = pagination + tri ; les filtres
// (spécifiques à chaque entité) s'ajoutent dans le t.Object de la route.
export const paginationQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, default: DEFAULT_PAGE })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT })),
});

export const sortQuery = t.Object({
  sort: t.Optional(t.String()),
  order: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
});

export const listQuery = t.Composite([paginationQuery, sortQuery]);

// Meta unique — la seule forme qui existe.
const listMeta = t.Object({
  total: t.Number(),
  page: t.Number(),
  limit: t.Number(),
  totalPages: t.Number(),
  hasNextPage: t.Boolean(),
  hasPrevPage: t.Boolean(),
});

// Schéma de réponse : enveloppe SSOT autour d'une projection d'item.
export function listResponse<T extends TSchema>(itemSchema: T) {
  return t.Object({
    data: t.Array(itemSchema),
    meta: listMeta,
  });
}

export interface ListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ListResponse<T> {
  data: T[];
  meta: ListMeta;
}

// Construit l'enveloppe : miroir exact de `listResponse` (écrits ensemble → pas
// de désync possible entre le schéma validé et la valeur renvoyée).
export function buildListResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): ListResponse<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

export interface ListQueryConfig {
  // Allowlist tri : clé publique (?sort=clé, = id de colonne côté UI) -> colonne DB.
  sortable: Record<string, Column>;
  // Tri par défaut quand aucun tri explicite valide n'est demandé (mono ou multi-colonnes).
  defaultSort: SQL | SQL[];
  // Allowlist filtres d'égalité : clé de query -> colonne DB. Optionnel.
  filterable?: Record<string, Column>;
}

export interface ParsedListQuery {
  page: number;
  limit: number;
  offset: number;
  orderBy: SQL[];
  filters: SQL[];
}

// Point d'entrée unique : parse pagination + tri (allowlist) + filtres d'égalité
// (allowlist). Les filtres complexes (ranges, full-text, jointures) restent dans
// la route et se concatènent à `filters`.
export function parseListQuery(
  query: Record<string, unknown>,
  config: ListQueryConfig,
): ParsedListQuery {
  const rawPage = typeof query.page === 'number' ? query.page : DEFAULT_PAGE;
  const rawLimit = typeof query.limit === 'number' ? query.limit : DEFAULT_LIMIT;
  const page = Math.max(1, rawPage);
  const limit = Math.min(Math.max(1, rawLimit), MAX_LIMIT);
  const offset = (page - 1) * limit;

  const sortKey = typeof query.sort === 'string' ? query.sort : undefined;
  const orderBy: SQL[] =
    sortKey && sortKey in config.sortable
      ? [(query.order === 'asc' ? asc : desc)(config.sortable[sortKey])]
      : Array.isArray(config.defaultSort)
        ? config.defaultSort
        : [config.defaultSort];

  const filters = config.filterable ? buildEqFilters(query, config.filterable) : [];

  return { page, limit, offset, orderBy, filters };
}

// Pagination seule — pour les routes sans tri/filtre générique.
export function getPaginationParams(query: { page?: number; limit?: number }) {
  const page = query.page ?? DEFAULT_PAGE;
  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// Filtres d'égalité génériques validés contre une allowlist { clé -> colonne }.
// Valeur multi (séparée par des virgules) -> inArray. Réutilisable seul pour les
// routes qui n'ont que des filtres, sans passer par parseListQuery.
export function buildEqFilters(
  query: Record<string, unknown>,
  filterable: Record<string, Column>,
): SQL[] {
  const conditions: SQL[] = [];
  for (const [key, column] of Object.entries(filterable)) {
    const raw = query[key];
    if (raw === undefined || raw === null || raw === '') continue;
    const values = String(raw).split(',').filter(Boolean);
    if (values.length === 0) continue;
    conditions.push(values.length === 1 ? eq(column, values[0]) : inArray(column, values));
  }
  return conditions;
}
