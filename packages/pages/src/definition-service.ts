// Le registre stocké : le charger, le mettre en cache, le remplacer.
//
// Ce qui se CALCULE à partir d'une définition — traduction en schéma, compilation, diagnostic,
// verdict — vit dans `@repo/pages-registry` et n'a besoin d'aucune base. Ne subsiste ici que ce qui
// touche au stockage (ADR-0059).
//
// La source d'autorité, ce sont les fichiers du dev ; la table `content_definition` n'en est que le
// miroir.

import { db } from '@repo/db';
import {
  compileSections,
  type Registry,
  registryIssues,
  registryToRows,
  rowsToRegistry,
  type SectionChecks,
  unknownRefTargets,
  type ValidationResult,
  checkSection,
} from '@repo/pages-registry';
import type { RegistryIssue } from '@repo/shared';
import { contentDefinition } from './schema';

// ── Cache (registre chargé + validateurs compilés par type de section) ────────────────────────
type Cache = { registry: Registry; sectionChecks: SectionChecks };
let cache: Cache | null = null;

async function ensureLoaded(): Promise<Cache> {
  if (!cache) {
    const rows = await db.select().from(contentDefinition);
    const registry = rowsToRegistry(rows);
    cache = { registry, sectionChecks: compileSections(registry) };
  }
  return cache;
}

/** Vide le cache — à appeler après tout `PUT /content/registry`. */
export function invalidateRegistryCache(): void {
  cache = null;
}

/** Registre stocké (pour l'admin / le type-gen). */
export async function loadRegistry(): Promise<Registry> {
  return (await ensureLoaded()).registry;
}

export type SyncRegistryOutcome =
  | { outcome: 'synced' }
  /** Champs en double, `component` introuvable ou cycle : refusé AVANT de persister quoi que ce soit. */
  | { outcome: 'incoherent'; issues: RegistryIssue[] }
  /**
   * Une cible de `ref` que le produit n'a pas inscrite (ADR-0032).
   *
   * Séparée de `incoherent`, et pas par goût du détail : le registre est bien formé, c'est son
   * ENVIRONNEMENT qui ne fournit pas la cible. Le dev corrige ailleurs, et le contrat a déjà un code
   * pour ça — `unknown_reference_targets`.
   */
  | { outcome: 'unknown_targets'; targets: string[] };

/**
 * Remplace le registre stocké d'un bloc. L'incohérence est une issue métier, pas une exception qui
 * remonte — et elle est constatée avant que la moindre ligne ne bouge.
 *
 * `knownTargets` : les cibles référençables que le produit a inscrites. Passées en argument plutôt
 * que lues ici — ce service ne doit pas connaître le registre d'Échoppe.
 */
export async function syncRegistry(
  registry: Registry,
  knownTargets: string[],
): Promise<SyncRegistryOutcome> {
  const issues = registryIssues(registry);
  if (issues.length > 0) return { outcome: 'incoherent', issues };

  const targets = unknownRefTargets(registry, knownTargets);
  if (targets.length > 0) return { outcome: 'unknown_targets', targets };

  await db.transaction(async (tx) => {
    await tx.delete(contentDefinition);
    const rows = registryToRows(registry);
    if (rows.length > 0) {
      await tx.insert(contentDefinition).values(rows);
    }
  });

  invalidateRegistryCache();
  return { outcome: 'synced' };
}

/** Valide le `data` d'une section contre la définition de son `type` dans le registre stocké. */
export async function validateSectionData(type: string, data: unknown): Promise<ValidationResult> {
  const { sectionChecks } = await ensureLoaded();
  return checkSection(sectionChecks, type, data);
}
