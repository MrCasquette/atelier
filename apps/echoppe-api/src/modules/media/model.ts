import { t } from 'elysia';
import { DEFAULT_LIMIT, MAX_LIMIT } from '../../lib/pagination';

// Schémas du module média — médiathèque (fichiers) et son arborescence de dossiers.
//
// Ils ne sont PAS enregistrés dans `src/model.ts` : la médiathèque n'expose aucun modèle nommé au
// contrat OpenAPI aujourd'hui, et les inscrire changerait `components.schemas`, donc le SDK publié.

export const mediaSchema = t.Object({
  id: t.String(),
  folder: t.Nullable(t.String()),
  filenameDisk: t.String(),
  filenameOriginal: t.String(),
  title: t.Nullable(t.String()),
  description: t.Nullable(t.String()),
  alt: t.Nullable(t.String()),
  mimeType: t.String(),
  size: t.Number(),
  width: t.Nullable(t.Number()),
  height: t.Nullable(t.Number()),
  dateCreated: t.Date(),
});

export const folderSchema = t.Object({
  id: t.String(),
  parent: t.Nullable(t.String()),
  name: t.String(),
  sortOrder: t.Number(),
});

export const uuidParam = t.Object({
  id: t.String({ format: 'uuid' }),
});

export const folderBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  parent: t.Optional(t.Union([t.String({ format: 'uuid' }), t.Null()])),
});

export const mediaUpdate = t.Object({
  title: t.Optional(t.String({ maxLength: 255 })),
  description: t.Optional(t.String()),
  alt: t.Optional(t.String({ maxLength: 255 })),
  folder: t.Optional(t.Union([t.String({ format: 'uuid' }), t.Null()])),
});

export const mediaQuery = t.Object({
  folder: t.Optional(t.String({ format: 'uuid' })),
  search: t.Optional(t.String()),
  sort: t.Optional(t.String()),
  order: t.Optional(t.String()),
  all: t.Optional(t.String()),
  type: t.Optional(
    t.Union([t.Literal('images'), t.Literal('pdf'), t.Literal('documents'), t.Literal('all')]),
  ),
  page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT })),
});

export const uploadBody = t.Object({
  file: t.Union([t.File(), t.Array(t.File())]),
  folder: t.Optional(t.String({ format: 'uuid' })),
  folderName: t.Optional(t.String({ maxLength: 100 })),
});

export const batchMoveBody = t.Object({
  ids: t.Array(t.String({ format: 'uuid' })),
  folder: t.Union([t.String({ format: 'uuid' }), t.Null()]),
});

export const batchDeleteBody = t.Object({
  ids: t.Array(t.String({ format: 'uuid' })),
});

export const batchResultSchema = t.Object({ moved: t.Array(t.String()), count: t.Number() });
export const batchDeleteResultSchema = t.Object({
  deleted: t.Array(t.String()),
  count: t.Number(),
});
