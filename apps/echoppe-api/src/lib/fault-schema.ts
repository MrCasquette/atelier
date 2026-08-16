import type {
  EchoppeErrorResponse,
  EchoppeFault,
  EchoppeRank,
  EchoppeResource,
} from '@echoppe/core';
import { type Static, t } from 'elysia';

// La forme du contrat de faute telle qu'elle SORT SUR LE FIL (ADR-0050).
//
// Ce fichier vit dans l'application, et pas dans `@repo/shared` avec le type qu'il décrit, pour deux
// raisons distinctes :
//
// 1. TypeBox est une préoccupation de TRANSPORT — OpenAPI, validation de réponse, inférence Eden.
//    Le faire remonter dans le paquet le plus bas du socle, qui n'a aujourd'hui aucune dépendance,
//    imposerait une dépendance de frontière à tout paquet qui refuse quelque chose, y compris ceux
//    qui ne servent jamais de HTTP.
// 2. Le schéma est SPÉCIALISÉ PAR PRODUIT, parce que le vocabulaire qu'il énumère l'est. Ce qui
//    sort sur le fil ici est un `EchoppeFault` ; `prisme-api` écrira le sien sur `PrismeResource`,
//    avec les mêmes 19 codes et une autre liste de ressources. Un schéma unique dans le socle
//    devrait retomber sur `t.String()` et ne documenterait plus rien.
//
// Le prix est une seconde écriture de la forme. Il est payé une fois et VERROUILLÉ : les gardes de
// compilation en bas de fichier font échouer `type-check` dès que le type et le schéma divergent —
// un code ajouté, un champ renommé, une ressource déclarée par un paquet partagé.

/**
 * Le vocabulaire de ressources d'Échoppe, en valeurs.
 *
 * Les paquets déclarent leurs ressources comme des TYPES (`AssetsResource = 'media' | …`) : rien
 * n'en subsiste à l'exécution, et un schéma a besoin de valeurs.
 *
 * Les littéraux sont écrits un par un, et non dérivés d'une liste par `.map` : `Static` s'en sort,
 * mais Elysia, en typant la réponse d'une route, résout un `t.Union` construit sur un tableau
 * non-tuple en `never`. La verbosité est le prix de l'inférence ; la garde de compilation en bas de
 * fichier interdit qu'elle dérive.
 *
 * Cette union reste INLINE dans `faultSchema` plutôt que d'être un modèle nommé de plus : un `t.Ref`
 * imbriqué ne se résout pas dans `Static`, ce qui ferait tomber les gardes ci-dessous. On échange
 * ~1 000 lignes dans UN composant du contrat contre le verrou qui empêche schéma et type de
 * diverger — le composant, lui, ne se recopie pas d'une route à l'autre.
 */
const resourceSchema = t.Union(
  [
    // @repo/assets
    t.Literal('media'),
    t.Literal('folder'),
    t.Literal('file'),
    // @repo/auth
    t.Literal('user'),
    t.Literal('role'),
    t.Literal('permission'),
    t.Literal('api_key'),
    t.Literal('session'),
    // @repo/communication
    t.Literal('email_template'),
    t.Literal('communication_provider'),
    // @repo/entities
    t.Literal('entity'),
    t.Literal('entity_row'),
    // @repo/identity
    t.Literal('site'),
    t.Literal('legal_entity'),
    t.Literal('country'),
    // @repo/menus
    t.Literal('menu'),
    // @repo/pages
    t.Literal('page'),
    t.Literal('section'),
    t.Literal('definition'),
    // @repo/references
    t.Literal('reference_target'),
    // Échoppe — le commerce
    t.Literal('product'),
    t.Literal('product_media'),
    t.Literal('product_option'),
    t.Literal('category'),
    t.Literal('collection'),
    t.Literal('variant'),
    t.Literal('option'),
    t.Literal('option_value'),
    t.Literal('personalization_field'),
    t.Literal('tax_rate'),
    t.Literal('order'),
    t.Literal('invoice'),
    t.Literal('cart'),
    t.Literal('cart_item'),
    t.Literal('wishlist'),
    t.Literal('customer'),
    t.Literal('address'),
    t.Literal('payment'),
    t.Literal('payment_provider'),
    t.Literal('shipping_provider'),
    t.Literal('stock'),
  ],
  { description: 'Ressource concernée par la faute' },
);

/**
 * L'échelle des rangs, en valeurs.
 *
 * Deux littéraux seulement, mais la même règle que ci-dessus : écrits à la main, jamais dérivés
 * d'une liste. Ils énumèrent `EchoppeRank`, et la garde de compilation le vérifie.
 */
const rankSchema = t.Union([t.Literal('owner'), t.Literal('first_rank')], {
  description: 'Rang exigé pour cet acte',
});

/**
 * Union discriminée sur `code`, plate — la forme d'ADR-0050.
 *
 * `additionalProperties: false` n'est PAS demandé : Elysia valide les réponses, et un membre plus
 * riche servi par une version plus récente doit passer, pas échouer. La compatibilité additive
 * promise par l'ADR se joue ici.
 */
export const faultSchema = t.Union(
  [
    t.Object({ code: t.Literal('not_found'), resource: resourceSchema }),
    t.Object({
      code: t.Literal('already_exists'),
      resource: resourceSchema,
      field: t.String(),
    }),
    t.Object({ code: t.Literal('in_use'), resource: resourceSchema, usedBy: resourceSchema }),
    t.Object({
      code: t.Literal('invalid_state'),
      resource: resourceSchema,
      current: t.String(),
      expected: t.String(),
    }),
    t.Object({
      code: t.Literal('insufficient_stock'),
      variant: t.String(),
      available: t.Number(),
      requested: t.Number(),
    }),
    t.Object({ code: t.Literal('unauthenticated') }),
    t.Object({ code: t.Literal('invalid_credentials') }),
    t.Object({ code: t.Literal('invalid_token') }),
    // `resource` libre : le RBAC porte l'espace ouvert `entity:<nom>` (ADR-0038).
    t.Object({
      code: t.Literal('permission_denied'),
      action: t.String(),
      resource: t.String(),
    }),
    t.Object({ code: t.Literal('protected_subject'), resource: resourceSchema }),
    t.Object({ code: t.Literal('self_action_forbidden'), action: t.String() }),
    t.Object({ code: t.Literal('self_only'), action: t.String() }),
    t.Object({
      code: t.Literal('rank_reserved'),
      action: t.String(),
      requires: rankSchema,
      // Rempli par la seule révocation en masse, où l'appelant ne voit pas ce qu'il retire.
      grants: t.Optional(t.Array(t.String())),
    }),
    t.Object({
      code: t.Literal('undelegatable_grants'),
      grants: t.Array(
        t.Object({
          grant: t.String(),
          reason: t.Union([
            t.Literal('not_held'),
            t.Literal('rank_bound'),
            t.Literal('self_only_widened'),
          ]),
        }),
      ),
    }),
    t.Object({ code: t.Literal('forbidden_resource'), resource: resourceSchema }),
    t.Object({ code: t.Literal('redirect_url_rejected'), field: t.String() }),
    t.Object({
      code: t.Literal('personalization_rejected'),
      field: t.String(),
      reason: t.Union([t.Literal('unknown'), t.Literal('required'), t.Literal('too_long')]),
    }),
    t.Object({ code: t.Literal('cardinality_exceeded'), resource: resourceSchema }),
    t.Object({
      code: t.Literal('destructive_plan'),
      steps: t.Array(
        t.Object({
          kind: t.Union([
            t.Literal('recreate_table'),
            t.Literal('drop_column'),
            t.Literal('drop_table'),
          ]),
          target: t.String(),
        }),
      ),
    }),
    t.Object({ code: t.Literal('configuration_missing'), target: t.String() }),
    t.Object({ code: t.Literal('required_data_missing'), field: t.String() }),
    t.Object({
      code: t.Literal('validation_failed'),
      details: t.Array(
        t.Object({
          path: t.String(),
          reason: t.Union([
            t.Literal('required'),
            t.Literal('type'),
            t.Literal('not_allowed'),
            t.Literal('too_small'),
            t.Literal('too_large'),
            t.Literal('format'),
          ]),
        }),
      ),
    }),
    t.Object({ code: t.Literal('empty_patch') }),
    t.Object({
      code: t.Literal('registry_incoherent'),
      issues: t.Array(
        t.Object({
          path: t.String(),
          reason: t.Union([
            t.Literal('duplicate_field'),
            t.Literal('unknown_component'),
            t.Literal('circular_component'),
            t.Literal('invalid_name'),
            t.Literal('name_mismatch'),
            t.Literal('link_cardinality'),
            t.Literal('link_unknown_field'),
            t.Literal('link_field_type'),
          ]),
        }),
      ),
    }),
    t.Object({
      code: t.Literal('blocked_plan'),
      blockers: t.Array(
        t.Union([
          t.Object({ reason: t.Literal('rows_present'), target: t.String() }),
          t.Object({
            reason: t.Literal('dangling_rows'),
            target: t.String(),
            references: t.String(),
          }),
          t.Object({
            reason: t.Literal('still_referenced'),
            target: t.String(),
            holders: t.Array(t.String()),
          }),
          t.Object({ reason: t.Literal('unmanaged_column'), target: t.String() }),
        ]),
      ),
    }),
    t.Object({ code: t.Literal('unknown_reference_targets'), targets: t.Array(t.String()) }),
    t.Object({ code: t.Literal('unknown_scopes'), scopes: t.Array(t.String()) }),
    t.Object({ code: t.Literal('external_operation_failed'), operation: t.String() }),
    t.Object({ code: t.Literal('service_unavailable') }),
  ],
  {
    description:
      'Faute structurée : `code` est le discriminant, les autres champs sont ses opérandes.',
  },
);

/** Ce qu'une route rend quand elle refuse : la faute, et rien qu'elle. */
export const errorResponseSchema = t.Object(
  {
    fault: faultSchema,
    incident: t.Optional(
      t.String({
        description: 'Corrélation opaque vers la trace serveur, si des champs ont été retirés',
      }),
    ),
  },
  { description: 'Réponse d’erreur (ADR-0050)' },
);

// ============================================
// Gardes de compilation
// ============================================
//
// Le seul mécanisme qui empêche le schéma et le type de diverger. `Equal` est strict : une union
// élargie, un champ devenu optionnel ou une ressource oubliée cassent `type-check`, jamais un test
// d'exécution qu'on pourrait ne pas lancer.

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

/**
 * Exporté parce qu'un type local inutilisé est une erreur (`noUnusedLocals`) — pas parce qu'un
 * appelant en a l'usage. Aucune valeur ne traverse : ces trois lignes n'existent que pour être
 * vérifiées.
 */
export type ContractGuards = [
  /** Les littéraux couvrent EXACTEMENT le vocabulaire déclaré par les paquets et le commerce. */
  Expect<Equal<Static<typeof resourceSchema>, EchoppeResource>>,
  /** Et l'échelle de rang, qui grandira le jour où un rang sur mesure arrivera. */
  Expect<Equal<Static<typeof rankSchema>, EchoppeRank>>,
  /** Le schéma décrit EXACTEMENT la faute qu'Échoppe émet. */
  Expect<Equal<Static<typeof faultSchema>, EchoppeFault>>,
  /** Et l'enveloppe, de même. */
  Expect<Equal<Static<typeof errorResponseSchema>, EchoppeErrorResponse>>,
];
