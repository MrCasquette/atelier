import { db, inArray, media } from '@echoppe/core';

// Référence image storefront : UUID du média + ses dimensions intrinsèques (pixels). Le framework
// n'optimise PAS les images (pas de resize serveur) — il expose l'original ET ses dimensions, à
// charge du storefront de construire son propre composant <Image> (srcset/ratio, anti-CLS). Cf.
// ADR-0021. Forme partagée par les cartes (product-cards) et le détail produit (public).
export interface ImageRef {
  id: string;
  width: number | null;
  height: number | null;
}

type Dimensions = Pick<ImageRef, 'width' | 'height'>;

// Charge les dimensions (px) d'un lot de médias en une requête → map id → {width,height}.
// Évite le N+1 : appeler une fois avec tous les ids référencés, puis bâtir les refs via `imageRef`.
export async function loadMediaDimensions(
  mediaIds: Array<string | null | undefined>,
): Promise<Map<string, Dimensions>> {
  const ids = [...new Set(mediaIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: media.id, width: media.width, height: media.height })
    .from(media)
    .where(inArray(media.id, ids));
  return new Map(rows.map((r) => [r.id, { width: r.width, height: r.height }]));
}

// Construit une référence image (id + dimensions depuis la map) ; null si aucun id.
export function imageRef(
  id: string | null | undefined,
  dims: Map<string, Dimensions>,
): ImageRef | null {
  if (!id) return null;
  const d = dims.get(id);
  return { id, width: d?.width ?? null, height: d?.height ?? null };
}
