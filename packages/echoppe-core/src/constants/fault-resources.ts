import type { AssetsResource } from '@repo/assets';
import type { AuthResource } from '@repo/auth';
import type { CommunicationResource } from '@repo/communication';
import type { EntitiesResource } from '@repo/entities';
import type { IdentityResource } from '@repo/identity';
import type { MenusResource } from '@repo/menus';
import type { PagesResource } from '@repo/pages';
import type { ReferencesResource } from '@repo/references';
import type { ErrorResponse, Fault } from '@repo/shared';

// Le vocabulaire de ressources d'Échoppe, tel qu'une faute le nomme (ADR-0050).
//
// COMPOSITION, jamais héritage entre produits. Le socle apporte ce que ses paquets possèdent ;
// Échoppe y ajoute le commerce. Prisme composera le même socle avec le sien, sans qu'aucun des deux
// n'importe l'autre — la flèche d'ADR-0025 reste intacte.
//
// Ce vocabulaire est DISTINCT de `ProtectedResource` (RBAC, ADR-0038), et ce n'est pas un oubli :
// les deux répondent à deux questions différentes. Le RBAC dit « qu'est-ce que je protège » et reste
// volontairement grossier — `content` couvre les pages ET les menus, `media` couvre les dossiers.
// Une faute dit « de quoi je parle à l'utilisateur », et doit distinguer « Page introuvable » de
// « Menu introuvable ». Les fusionner coupleraient la granularité des messages à celle des droits.

/** Ce que les paquets partagés possèdent. Prisme aura exactement cette base. */
export type SharedResource =
  | AssetsResource
  | AuthResource
  | CommunicationResource
  | EntitiesResource
  | IdentityResource
  | MenusResource
  | PagesResource
  | ReferencesResource;

/** Ce qu'Échoppe ajoute : le commerce, et rien qu'un CMS aurait à connaître. */
export type CommerceResource =
  | 'product'
  | 'product_media'
  | 'product_option'
  | 'category'
  | 'collection'
  | 'variant'
  | 'option'
  | 'option_value'
  | 'personalization_field'
  | 'tax_rate'
  | 'order'
  | 'invoice'
  | 'cart'
  | 'cart_item'
  | 'wishlist'
  | 'customer'
  | 'address'
  | 'payment'
  | 'payment_provider'
  | 'shipping_provider'
  | 'stock';

/**
 * Le vocabulaire fermé d'Échoppe.
 *
 * La fermeture vit ICI, au point d'usage, et non dans le socle : `Fault.resource` est une chaîne
 * parce qu'un paquet partagé ne peut pas connaître `product` sans refaire ce qu'ADR-0032 a corrigé.
 * Ce sont les constructeurs de `fault.ts` qui imposent cette union — une faute de frappe s'y voit à
 * la compilation, ce qui est ce que la fermeture achète.
 */
export type EchoppeResource = SharedResource | CommerceResource;

/**
 * L'échelle des rangs d'Échoppe — qui gouverne, et à quelle hauteur.
 *
 * Le socle n'en connaît aucun, et pas par omission : `@repo/auth` ne sait décrire que des ÉTENDUES
 * de droits (`Authority`, trois formes), qui disent ce qu'on détient, jamais si on gouverne. Le
 * rang est ailleurs, dans `FIRST_RANK_ROLE_KEYS` (`apps/echoppe-api/src/modules/auth/rbac.ts`), et
 * il tient à `key`, immuable et portée par le code — jamais aux permissions, qu'un rôle sur mesure
 * peut recopier à l'identique sans pour autant gouverner (ADR-0047, décision 4).
 *
 * Deux valeurs aujourd'hui, parce que deux gardes seulement s'y réfèrent : `isTheOwner` et
 * `isFirstRank`. L'union est additive, et `rbac.ts` annonce déjà qu'un rang sur mesure viendra —
 * il s'ajoutera ici, sans que rien de ce qui lit n'ait à changer.
 */
export type EchoppeRank =
  /** Le propriétaire de l'installation. `authority.kind === 'total'`, indépendant de tout rôle. */
  | 'owner'
  /** Le propriétaire, ou un rôle dont la `key` est du premier rang (`admin` aujourd'hui). */
  | 'first_rank';

/**
 * La forme du socle, instanciée sur les deux vocabulaires d'Échoppe.
 *
 * C'est ce que les constructeurs RENDENT, et la raison pour laquelle `Fault` est paramétré : sans
 * cette instanciation, la fermeture ne vaudrait qu'à l'entrée, et tout ce qui vit en aval —
 * le schéma qui sort sur le fil, le catalogue d'une surface — retrouverait une `string` ouverte,
 * donc rien à énumérer ni à vérifier.
 */
export type EchoppeFault = Fault<EchoppeResource, EchoppeRank>;

/** Ce qu'une route d'Échoppe met dans un corps d'erreur. */
export type EchoppeErrorResponse = ErrorResponse<EchoppeResource, EchoppeRank>;
