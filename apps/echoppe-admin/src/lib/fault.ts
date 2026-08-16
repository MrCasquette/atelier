import type { ErrorResponse, Fault } from '@echoppe/api';

// Le catalogue de l'ADMINISTRATION (ADR-0050 §6).
//
// C'est ici que le texte est écrit, pas dans l'API : la même faute ne se dit pas de la même façon à
// un gestionnaire de boutique et à un acheteur. L'administration nomme précisément la ressource et
// va jusqu'à dire quoi faire ; la boutique restera générique.
//
// Il est PARTIEL, et c'est correct. La migration avance par tranche verticale ; les codes qu'aucune
// route migrée n'émet encore ne sont pas devinés d'avance. Le repli couvre le reste — et il ne
// couvre pas seulement les trous d'aujourd'hui : l'API livrera un jour un code que cette
// administration, déployée plus tôt, ne connaîtra pas.

type Gender = 'm' | 'f';

/**
 * Le vocabulaire de ressources, tel que le contrat le publie.
 *
 * Extrait du membre `not_found` plutôt que réécrit : c'est le même verrou que côté serveur, une
 * ressource renommée casse ce fichier au lieu de le laisser afficher une clé brute.
 */
type FaultResource = Extract<Fault, { code: 'not_found' }>['resource'];

/** Nom d'affichage et genre — la seule chose qui demande du français. */
const RESOURCES: Partial<Record<FaultResource, [string, Gender]>> = {
  address: ['adresse', 'f'],
  api_key: ['clé d’API', 'f'],
  cart: ['panier', 'm'],
  cart_item: ['article du panier', 'm'],
  category: ['catégorie', 'f'],
  collection: ['collection', 'f'],
  customer: ['client', 'm'],
  entity: ['entité', 'f'],
  entity_row: ['occurrence', 'f'],
  file: ['fichier', 'm'],
  folder: ['dossier', 'm'],
  invoice: ['facture', 'f'],
  media: ['média', 'm'],
  menu: ['menu', 'm'],
  option: ['option', 'f'],
  option_value: ['valeur d’option', 'f'],
  order: ['commande', 'f'],
  page: ['page', 'f'],
  payment: ['paiement', 'm'],
  payment_provider: ['moyen de paiement', 'm'],
  personalization_field: ['champ de personnalisation', 'm'],
  product: ['produit', 'm'],
  product_media: ['média du produit', 'm'],
  product_option: ['option du produit', 'f'],
  reference_target: ['cible référençable', 'f'],
  role: ['rôle', 'm'],
  tax_rate: ['taux de TVA', 'm'],
  user: ['utilisateur', 'm'],
  variant: ['variante', 'f'],
};

/**
 * Les actes, à l'infinitif.
 *
 * Une faute porte l'action comme CODE — `deactivate`, jamais « se désactiver ». Le français se
 * décide ici, et une surface anglophone écrirait le sien sans que l'API bouge.
 */
const ACTIONS: Record<string, string> = {
  create: 'créer',
  read: 'consulter',
  update: 'modifier',
  delete: 'supprimer',
  deactivate: 'désactiver',
  update_password: 'changer le mot de passe',
  transfer_ownership: 'transférer la propriété',
  revoke: 'retirer un droit',
  invite: 'réémettre une invitation',
};

/** Les rangs, tels qu'on les nomme au gestionnaire. */
const RANKS: Record<string, string> = {
  owner: 'au propriétaire de l’installation',
  first_rank: 'au premier rang',
};

/** Pourquoi un droit ne peut pas être délégué. Trois règles distinctes, trois corrections. */
const UNDELEGATABLE: Record<string, string> = {
  not_held: 'que vous ne détenez pas',
  rank_bound: 'qui tiennent au rang et ne se délèguent jamais',
  self_only_widened: 'que vous ne détenez que sur vos propres lignes',
};

const verb = (action: string): string => ACTIONS[action] ?? action.replace(/_/g, ' ');

function label(resource: FaultResource): [string, Gender] {
  return RESOURCES[resource] ?? [resource.replace(/_/g, ' '), 'm'];
}

/**
 * Les états, tels qu'on les nomme à l'utilisateur.
 *
 * `invalid_state` porte `current` et `expected` comme CODES — `disabled`, `published` — parce que le
 * domaine ne parle aucune langue. Sans cette table, le rendu servait « est « disabled », il doit
 * être « active » » : la moitié de la phrase en anglais, sur un écran français.
 */
const STATES: Record<string, string> = {
  active: 'actif',
  disabled: 'désactivé',
  draft: 'brouillon',
  published: 'publié',
  archived: 'archivé',
  paid: 'payée',
  unpaid: 'non payée',
  completed: 'abouti',
  pending: 'en attente',
  failed: 'échoué',
  refunded: 'remboursé',
  owner: 'déjà propriétaire',
  not_owner: 'un compte ordinaire',
  empty: 'vide',
};

const state = (code: string): string => STATES[code] ?? code;

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** L'accord se règle ICI. Le domaine n'a jamais à savoir que « variante » est féminin. */
/**
 * L'élision se décide ici aussi : « ce utilisateur » est la faute que le premier rendu de
 * `invalid_state` a produite. Le genre ne suffit pas — il faut la première lettre du mot.
 */
const elides = (word: string): boolean => /^[aeiouyàâéèêëîïôöùûü]/i.test(word);

const demonstrative = (gender: Gender, word: string): string =>
  gender === 'f' ? 'Cette' : elides(word) ? 'Cet' : 'Ce';
const indefinite = (gender: Gender): string => (gender === 'f' ? 'Une' : 'Un');

/**
 * Rend une faute, ou `null` si ce catalogue ne la connaît pas encore.
 *
 * `null` plutôt qu'un texte générique : c'est l'appelant qui décide de son repli, et il en a un
 * meilleur — `message`, encore rempli par l'API pendant la transition.
 */
export function faultText(fault: Fault): string | null {
  switch (fault.code) {
    case 'not_found':
      return `${capitalize(label(fault.resource)[0])} introuvable`;
    case 'already_exists': {
      const [name, gender] = label(fault.resource);
      return `${indefinite(gender)} ${name} existe déjà avec ce ${fault.field}`;
    }
    case 'in_use': {
      const [name, gender] = label(fault.resource);
      const [by] = label(fault.usedBy);
      const used = gender === 'f' ? 'utilisée' : 'utilisé';
      const detach = gender === 'f' ? 'la' : 'le';
      return `${demonstrative(gender, name)} ${name} est ${used} par au moins un élément « ${by} » — détachez-${detach} d’abord`;
    }
    case 'invalid_state': {
      const [name, gender] = label(fault.resource);
      const pronoun = gender === 'f' ? 'elle' : 'il';
      return `Action impossible : ${demonstrative(gender, name).toLowerCase()} ${name} est « ${state(fault.current)} », ${pronoun} doit être « ${state(fault.expected)} »`;
    }
    case 'insufficient_stock':
      return `Stock insuffisant : ${fault.available} disponible(s) pour ${fault.requested} demandé(s)`;
    case 'configuration_missing':
      return `${fault.target} n’est pas configuré`;
    case 'external_operation_failed':
      // Le tiers a répondu, mal. On nomme l'opération sans relayer son diagnostic.
      return `L’opération « ${fault.operation} » a échoué — réessayez ou vérifiez la configuration`;
    case 'unauthenticated':
      return 'Votre session a expiré — reconnectez-vous';
    case 'invalid_credentials':
      return 'Identifiants incorrects';
    case 'invalid_token':
      return 'Lien invalide ou expiré';
    case 'permission_denied':
      return `Vous n’avez pas le droit de ${verb(fault.action)} « ${fault.resource} »`;
    case 'protected_subject': {
      const [name, gender] = label(fault.resource);
      const suffix = gender === 'f' ? 'protégée' : 'protégé';
      return `${demonstrative(gender, name)} ${name} est ${suffix} et ne peut pas être modifié${gender === 'f' ? 'e' : ''}`;
    }
    case 'self_action_forbidden':
      return `Vous ne pouvez pas ${verb(fault.action)} votre propre compte`;
    case 'self_only':
      return `Vous ne pouvez ${verb(fault.action)} que sur votre propre compte`;
    case 'rank_reserved':
      // « Cet acte » plutôt que le verbe seul : la garde refuse CETTE tentative, pas l'acte en
      // général. « Supprimer est réservé au propriétaire » serait faux.
      return fault.grants?.length
        ? `Cet acte — ${verb(fault.action)} — est réservé ${RANKS[fault.requires] ?? fault.requires} : ${fault.grants.join(', ')}`
        : `Cet acte — ${verb(fault.action)} — est réservé ${RANKS[fault.requires] ?? fault.requires}`;
    case 'undelegatable_grants': {
      // Groupé par raison : trois règles se croisent, et chacune se corrige autrement. On ne peut
      // pas accorder ce qu'on n'a pas, mais `rank_bound` ne s'obtient par aucune permission.
      const byReason = new Map<string, string[]>();
      for (const { grant, reason } of fault.grants) {
        byReason.set(reason, [...(byReason.get(reason) ?? []), grant]);
      }
      return [...byReason]
        .map(
          ([reason, grants]) =>
            `Droits ${UNDELEGATABLE[reason] ?? reason} : ${grants.join(', ')}`,
        )
        .join(' · ');
    }
    default:
      return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Garde de frontière : on ne vérifie que le DISCRIMINANT.
 *
 * Vérifier chaque membre reviendrait à réécrire le schéma dans le client, pour une garantie que le
 * `switch` donne déjà — un code inconnu tombe dans le repli, un code connu a ses champs parce que
 * le serveur les a mis. Le typage tient la forme, ce guard tient l'hypothèse « c'est bien une faute ».
 */
function isFault(value: unknown): value is Fault {
  return isRecord(value) && typeof value.code === 'string';
}

/** La faute portée par une réponse d'erreur Eden, si la route qui l'a rendue est migrée. */
export function faultOf(error: { value: unknown }): Fault | null {
  const value = error.value;
  if (!isRecord(value) || !isFault(value.fault)) return null;
  return value.fault;
}

export type { ErrorResponse, Fault };
