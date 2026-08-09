import { randomUUID } from 'node:crypto';
import { mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import {
  and,
  asc,
  count,
  db,
  desc,
  eq,
  folder,
  isNull,
  like,
  media,
  or,
  type SQL,
} from '@echoppe/core';
import { UPLOAD_DIR } from './storage';

// Logique de la médiathèque : fichiers, arborescence, disque. Sans rien savoir du transport — les
// absences sont des `null` de retour, pas des 404 (ADR-0044).

await mkdir(UPLOAD_DIR, { recursive: true });

export type MediaListFilters = {
  folder?: string;
  search?: string;
  sort?: string;
  order?: string;
  /** `'true'` ignore le filtre de dossier et liste toute la médiathèque à plat. */
  all?: string;
  type?: string;
};

/** Les familles de types MIME que l'administration propose au filtrage. */
const DOCUMENT_MIME_PATTERNS = [
  'application/msword%',
  'application/vnd.openxmlformats%',
  'application/vnd.ms-%',
  'text/%',
] as const;

function buildMediaFilter(filters: MediaListFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.all !== 'true') {
    conditions.push(filters.folder ? eq(media.folder, filters.folder) : isNull(media.folder));
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const searchCondition = or(like(media.title, pattern), like(media.filenameOriginal, pattern));
    if (searchCondition) conditions.push(searchCondition);
  }

  if (filters.type && filters.type !== 'all') {
    if (filters.type === 'images') {
      conditions.push(like(media.mimeType, 'image/%'));
    } else if (filters.type === 'pdf') {
      conditions.push(eq(media.mimeType, 'application/pdf'));
    } else if (filters.type === 'documents') {
      const docCondition = or(
        eq(media.mimeType, 'application/pdf'),
        ...DOCUMENT_MIME_PATTERNS.map((pattern) => like(media.mimeType, pattern)),
      );
      if (docCondition) conditions.push(docCondition);
    }
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listMedia(filters: MediaListFilters, limit: number, offset: number) {
  const whereClause = buildMediaFilter(filters);

  const sortField =
    filters.sort === 'name'
      ? media.filenameOriginal
      : filters.sort === 'size'
        ? media.size
        : media.dateCreated;
  const sortOrder = filters.order === 'asc' ? asc(sortField) : desc(sortField);

  const [items, [{ total }]] = await Promise.all([
    whereClause
      ? db.select().from(media).where(whereClause).orderBy(sortOrder).limit(limit).offset(offset)
      : db.select().from(media).orderBy(sortOrder).limit(limit).offset(offset),
    whereClause
      ? db
          .select({ total: count(media.id) })
          .from(media)
          .where(whereClause)
      : db.select({ total: count(media.id) }).from(media),
  ]);

  return { items, total };
}

export async function findMedia(id: string) {
  const [item] = await db.select().from(media).where(eq(media.id, id));
  return item ?? null;
}

/** Retrouve un dossier par son nom, ou le crée. Sert au téléversement par nom de dossier. */
async function resolveFolderByName(name: string): Promise<string> {
  const [existing] = await db.select({ id: folder.id }).from(folder).where(eq(folder.name, name));
  if (existing) return existing.id;

  const [created] = await db.insert(folder).values({ name }).returning({ id: folder.id });
  return created.id;
}

/**
 * Écrit les fichiers sur disque et crée leur ligne. Rend les médias créés dans l'ordre reçu ;
 * c'est le controller qui décide de renvoyer un objet seul ou un tableau.
 */
export async function uploadMedia(
  files: File[],
  target: { folder?: string | null; folderName?: string },
) {
  let folderId = target.folder || null;

  if (target.folderName && !folderId) {
    folderId = await resolveFolderByName(target.folderName);
  }

  const created = [];

  for (const file of files) {
    const ext = file.name.split('.').pop() || '';
    const filenameDisk = `${randomUUID()}.${ext}`;

    await Bun.write(join(UPLOAD_DIR, filenameDisk), file);

    const [row] = await db
      .insert(media)
      .values({
        folder: folderId,
        filenameDisk,
        filenameOriginal: file.name,
        title: file.name.replace(/\.[^/.]+$/, ''),
        mimeType: file.type,
        size: file.size,
        width: null,
        height: null,
      })
      .returning();

    created.push(row);
  }

  return created;
}

export type MediaMetadata = {
  title?: string;
  description?: string | null;
  alt?: string | null;
  folder?: string | null;
};

export async function updateMediaMetadata(id: string, metadata: MediaMetadata) {
  // Seules les clés réellement soumises sont écrites : `undefined` veut dire « ne touche pas »,
  // là où `null` veut dire « efface ».
  const updateData: Record<string, unknown> = {};
  if (metadata.title !== undefined) updateData.title = metadata.title;
  if (metadata.description !== undefined) updateData.description = metadata.description;
  if (metadata.alt !== undefined) updateData.alt = metadata.alt;
  if (metadata.folder !== undefined) updateData.folder = metadata.folder;

  const [updated] = await db.update(media).set(updateData).where(eq(media.id, id)).returning();
  return updated ?? null;
}

export async function moveMediaBatch(ids: string[], folderId: string | null) {
  const moved: string[] = [];

  for (const id of ids) {
    const [updated] = await db
      .update(media)
      .set({ folder: folderId })
      .where(eq(media.id, id))
      .returning();
    if (updated) moved.push(id);
  }

  return moved;
}

/** Supprime le fichier du disque. Disque et base peuvent diverger : c'est la base qui fait foi. */
async function removeFromDisk(filenameDisk: string) {
  try {
    await unlink(join(UPLOAD_DIR, filenameDisk));
  } catch {
    // Le fichier peut avoir déjà disparu du disque — la ligne, elle, doit partir.
  }
}

export async function deleteMedia(id: string) {
  const item = await findMedia(id);
  if (!item) return null;

  await removeFromDisk(item.filenameDisk);
  await db.delete(media).where(eq(media.id, id));

  return item;
}

export async function deleteMediaBatch(ids: string[]) {
  const deleted: string[] = [];

  for (const id of ids) {
    if (await deleteMedia(id)) deleted.push(id);
  }

  return deleted;
}

export type AssetLookup =
  | { outcome: 'found'; file: ReturnType<typeof Bun.file>; mimeType: string }
  /** Aucune ligne pour cet identifiant. */
  | { outcome: 'media-not-found' }
  /** La ligne existe mais le fichier a disparu du disque — les deux 404 ne disent pas la même chose. */
  | { outcome: 'file-missing' };

export async function readAsset(id: string): Promise<AssetLookup> {
  const item = await findMedia(id);
  if (!item) return { outcome: 'media-not-found' };

  const file = Bun.file(join(UPLOAD_DIR, item.filenameDisk));
  if (!(await file.exists())) return { outcome: 'file-missing' };

  return { outcome: 'found', file, mimeType: item.mimeType };
}

// ============================================
// ARBORESCENCE
// ============================================

export function listFolders() {
  return db.select().from(folder).orderBy(asc(folder.name));
}

export async function createFolder(input: { name: string; parent?: string | null }) {
  const [created] = await db
    .insert(folder)
    .values({ name: input.name, parent: input.parent || null })
    .returning();

  return created;
}

export async function updateFolder(id: string, input: { name: string; parent?: string | null }) {
  const [updated] = await db
    .update(folder)
    .set({ name: input.name, parent: input.parent || null })
    .where(eq(folder.id, id))
    .returning();

  return updated ?? null;
}

/** Supprime un dossier ; ses enfants — dossiers comme médias — remontent au parent. */
export async function deleteFolder(id: string) {
  const [current] = await db.select().from(folder).where(eq(folder.id, id));

  if (current) {
    await db.update(folder).set({ parent: current.parent }).where(eq(folder.parent, id));
    await db.update(media).set({ folder: current.parent }).where(eq(media.folder, id));
  }

  const [deleted] = await db.delete(folder).where(eq(folder.id, id)).returning();
  return deleted ?? null;
}
