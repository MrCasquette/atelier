import type { EchoppeErrorResponse, EchoppeFault, EchoppeResource } from '@echoppe/core';
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
 * Les littéraux sont écrits un par un, et non dérivés d'une liste par `.map` : Elysia, en typant la
 * réponse d'une route, résout un `t.Union` construit à partir d'un tableau non-tuple en `never` —
 * le schéma valide toujours à l'exécution, mais toute route qui le rend devient intypable. La
 * verbosité est le prix de l'inférence ; la garde de compilation en bas de fichier interdit qu'elle
 * dérive.
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
    t.Object({ code: t.Literal('owner_only'), action: t.String() }),
    t.Object({ code: t.Literal('forbidden_resource'), resource: resourceSchema }),
    t.Object({ code: t.Literal('configuration_missing'), target: t.String() }),
    t.Object({ code: t.Literal('required_data_missing'), field: t.String() }),
    t.Object({ code: t.Literal('validation_failed'), details: t.Array(t.String()) }),
    t.Object({ code: t.Literal('unknown_reference_targets'), targets: t.Array(t.String()) }),
    t.Object({ code: t.Literal('unknown_scopes'), scopes: t.Array(t.String()) }),
    t.Object({ code: t.Literal('external_operation_failed'), operation: t.String() }),
  ],
  {
    description:
      'Faute structurée : `code` est le discriminant, les autres champs sont ses opérandes.',
  },
);

/** Ce qu'une route rend quand elle refuse. `message` reste rempli le temps de la migration. */
export const errorResponseSchema = t.Object(
  {
    fault: faultSchema,
    incident: t.Optional(
      t.String({
        description: 'Corrélation opaque vers la trace serveur, si des champs ont été retirés',
      }),
    ),
    message: t.String({ description: 'Rendu français — format hérité, lire `fault`' }),
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
  /** Le schéma décrit EXACTEMENT la faute qu'Échoppe émet. */
  Expect<Equal<Static<typeof faultSchema>, EchoppeFault>>,
  /** Et l'enveloppe, de même. */
  Expect<Equal<Static<typeof errorResponseSchema>, EchoppeErrorResponse>>,
];
