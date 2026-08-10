import { db } from '@repo/db';
import { eq } from 'drizzle-orm';
import { storeSettings } from '../db/schema/settings';

export type StoreSettings = typeof storeSettings.$inferSelect;
export type StoreSettingsValues = Omit<StoreSettings, 'id' | 'singleton'>;

/**
 * Valeurs par défaut, alignées sur les `default()` du schéma. Servies en lecture tant qu'aucune
 * ligne n'existe, pour ne rien écrire depuis une route publique.
 */
export const DEFAULT_STORE_SETTINGS: StoreSettingsValues = {
  documentPrefix: 'REC',
  documentNextNumber: 1,
  invoicePrefix: 'FA',
  invoiceNextNumber: 1,
  taxExempt: false,
};

/**
 * Lecture seule des réglages de la boutique. N'écrit jamais — appelable depuis une route publique.
 */
export async function readStoreSettings(): Promise<StoreSettingsValues> {
  const [existing] = await db.select().from(storeSettings).limit(1);
  return existing ?? DEFAULT_STORE_SETTINGS;
}

/**
 * Réglages de la boutique, singleton (ADR-0039 — borne haute, au plus une ligne).
 *
 * Crée la ligne si elle n'existe pas. C'est un écart assumé au « on ne fabrique rien d'office »
 * d'ADR-0039 : celui-ci vise les fiches de contenu, dont les champs obligatoires seraient vides.
 * Ici tous les champs ont un défaut sensé, et la numérotation des factures a besoin d'un compteur
 * persistant. La contrainte d'unicité rend l'insertion concurrente sûre — le second appel ne crée
 * rien et relit la ligne existante.
 *
 * Réservé aux chemins qui écrivent (facturation, enregistrement des réglages).
 */
export async function getStoreSettings(): Promise<StoreSettings> {
  const [existing] = await db.select().from(storeSettings).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(storeSettings).values({}).onConflictDoNothing().returning();
  if (created) return created;

  const [concurrent] = await db.select().from(storeSettings).limit(1);
  if (!concurrent) throw new Error('Store settings could not be initialised');
  return concurrent;
}

/**
 * Enregistre les réglages, en créant la ligne au besoin.
 */
export async function saveStoreSettings(
  values: Partial<StoreSettingsValues>,
): Promise<StoreSettings> {
  const current = await getStoreSettings();
  const [updated] = await db
    .update(storeSettings)
    .set(values)
    .where(eq(storeSettings.id, current.id))
    .returning();
  return updated;
}
