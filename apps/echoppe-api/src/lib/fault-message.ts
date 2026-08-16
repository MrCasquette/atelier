import type { Fault } from '@echoppe/core';

// Catalogue de transition : rend un `message` français à partir d'une faute (ADR-0050).
//
// Sa place définitive est dans les SURFACES — l'administration nomme le prestataire, la boutique
// reste générique, la CLI affiche la faute brute. Celui-ci vit dans l'API parce que le champ
// `message` doit rester rempli tant que les huit vues de l'administration le lisent. Il disparaît
// avec lui.
//
// Il montre au passage ce que le contrat achète : l'accord en genre se règle ici, dans le catalogue,
// et le domaine n'a jamais à savoir que « commande » est féminin.

type Gender = 'm' | 'f';

/** Nom d'affichage d'une ressource, avec son genre — la seule chose qui demande du français. */
const RESOURCES: Record<string, [string, Gender]> = {
  address: ['adresse', 'f'],
  api_key: ['clé d’API', 'f'],
  cart: ['panier', 'm'],
  cart_item: ['article du panier', 'm'],
  category: ['catégorie', 'f'],
  collection: ['collection', 'f'],
  communication_provider: ['fournisseur d’e-mail', 'm'],
  country: ['pays', 'm'],
  customer: ['client', 'm'],
  definition: ['définition', 'f'],
  email_template: ['gabarit d’e-mail', 'm'],
  entity: ['entité', 'f'],
  entity_row: ['occurrence', 'f'],
  file: ['fichier', 'm'],
  folder: ['dossier', 'm'],
  invoice: ['facture', 'f'],
  legal_entity: ['entité légale', 'f'],
  media: ['média', 'm'],
  menu: ['menu', 'm'],
  option: ['option', 'f'],
  option_value: ['valeur d’option', 'f'],
  order: ['commande', 'f'],
  page: ['page', 'f'],
  payment: ['paiement', 'm'],
  payment_provider: ['moyen de paiement', 'm'],
  permission: ['permission', 'f'],
  personalization_field: ['champ de personnalisation', 'm'],
  product: ['produit', 'm'],
  product_media: ['média du produit', 'm'],
  product_option: ['option du produit', 'f'],
  reference_target: ['cible référençable', 'f'],
  role: ['rôle', 'm'],
  section: ['section', 'f'],
  session: ['session', 'f'],
  shipping_provider: ['transporteur', 'm'],
  site: ['site', 'm'],
  stock: ['stock', 'm'],
  tax_rate: ['taux de TVA', 'm'],
  user: ['utilisateur', 'm'],
  variant: ['variante', 'f'],
  wishlist: ['liste d’envies', 'f'],
};

/**
 * Les actes, à l'infinitif.
 *
 * Une faute porte l'action comme CODE — `deactivate`, jamais « se désactiver ». C'est ce qui permet
 * à une surface anglophone d'exister un jour, et c'est ici que le français se décide.
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

/** Ce qu'une étape destructive ferait, en français. Les `kind` viennent de `@repo/entities`. */
const DESTRUCTIVE: Record<string, string> = {
  recreate_table: 'refaire la table de',
  drop_column: 'supprimer la colonne',
  drop_table: 'supprimer la table de',
};

/** Les rangs, tels qu'on les nomme à l'utilisateur. */
const RANKS: Record<string, string> = {
  owner: 'au propriétaire de l’installation',
  first_rank: 'au premier rang',
};

/** Ce qu'une donnée refusée demande de corriger. Les raisons viennent de `@repo/fields`. */
const VALIDATION: Record<string, string> = {
  required: 'est requis',
  type: 'n’a pas le type attendu',
  not_allowed: 'porte une valeur non permise',
  too_small: 'est trop petit',
  too_large: 'est trop grand',
  format: 'n’a pas la forme attendue',
};

/** Ce qui empêche une déclaration poussée de tenir debout. */
const INCOHERENCE: Record<string, string> = {
  duplicate_field: 'est déclaré deux fois',
  unknown_component: 'cite un composant absent du registre',
  circular_component: 'entre dans une référence circulaire',
  invalid_name: 'porte un nom refusé (minuscules, chiffres et « _ », commençant par une lettre)',
  name_mismatch: 'est rangée sous une clé qui ne correspond pas à son nom',
  link_cardinality: 'a un lien qui contredit sa cardinalité',
  link_unknown_field: 'est cité par un lien mais n’est pas déclaré',
  link_field_type: 'n’a pas le type que son lien exige',
};

/** Pourquoi un droit ne peut pas être délégué — un code, une phrase. */
const UNDELEGATABLE: Record<string, string> = {
  not_held: 'non détenus',
  rank_bound: 'tiennent au rang, donc non délégables',
  self_only_widened: 'détenus seulement sur vos propres lignes',
};

/**
 * Repli obligatoire : l'API livrera un jour une ressource qu'un catalogue déployé plus tôt ne
 * connaît pas. Sans lui, l'utilisateur lirait une clé brute.
 */
function label(resource: string): [string, Gender] {
  return RESOURCES[resource] ?? [resource.replace(/_/g, ' '), 'm'];
}

/** Même repli, pour les mêmes raisons : un acte inconnu se lit encore, faute de mieux. */
const verb = (action: string): string => ACTIONS[action] ?? action.replace(/_/g, ' ');

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

/** L'accord se règle ICI. Le domaine n'a jamais à savoir que « commande » est féminin. */
/**
 * L'élision se décide ici aussi : « ce utilisateur » est la faute que le premier rendu de
 * `invalid_state` a produite. Le genre ne suffit pas — il faut la première lettre du mot.
 */
const elides = (word: string): boolean => /^[aeiouyàâéèêëîïôöùûü]/i.test(word);

const demonstrative = (gender: Gender, word: string): string =>
  gender === 'f' ? 'Cette' : elides(word) ? 'Cet' : 'Ce';
const indefinite = (gender: Gender): string => (gender === 'f' ? 'Une' : 'Un');

/**
 * Ce qu'un blocage de plan demande de faire. Chaque raison porte des opérandes différents, donc
 * chacune a sa phrase — c'est précisément ce que l'union discriminée permet de dire sans deviner.
 */
function blocker(item: Extract<Fault, { code: 'blocked_plan' }>['blockers'][number]): string {
  switch (item.reason) {
    case 'rows_present':
      return `« ${item.target} » contient des lignes — videz la table d’abord`;
    case 'dangling_rows':
      return `« ${item.target} » porte des valeurs qui ne désignent plus rien dans « ${item.references} »`;
    case 'still_referenced':
      return `« ${item.target} » est encore référencée par ${item.holders.join(', ')} — retirez ces champs, jamais de cascade`;
    case 'unmanaged_column':
      return `« ${item.target} » n’a pas été créée par ce mécanisme : intervention manuelle requise`;
  }
}

export function faultMessage(fault: Fault): string {
  switch (fault.code) {
    case 'not_found':
      // « introuvable » est invariable : le genre ne sert pas ici, mais il sert juste en dessous.
      return `${capitalize(label(fault.resource)[0])} introuvable`;
    case 'already_exists': {
      const [name, gender] = label(fault.resource);
      return `${indefinite(gender)} ${name} existe déjà avec ce ${fault.field}`;
    }
    case 'in_use': {
      const [name, gender] = label(fault.resource);
      const [by, byGender] = label(fault.usedBy);
      const used = gender === 'f' ? 'utilisée' : 'utilisé';
      return `${demonstrative(gender, name)} ${name} est ${used} par au moins ${indefinite(byGender).toLowerCase()} ${by} — détachez-${gender === 'f' ? 'la' : 'le'} d’abord`;
    }
    case 'invalid_state': {
      const [name, gender] = label(fault.resource);
      const pronoun = gender === 'f' ? 'elle' : 'il';
      return `Action impossible : ${demonstrative(gender, name).toLowerCase()} ${name} est « ${state(fault.current)} », ${pronoun} doit être « ${state(fault.expected)} »`;
    }
    case 'insufficient_stock':
      // Le NOM du produit n'est pas ici, et n'y sera pas : c'est une donnée saisie par le marchand.
      // La surface a affiché le panier, donc elle a la ligne, donc elle a le libellé.
      return `Stock insuffisant : ${fault.available} disponible(s) pour ${fault.requested} demandé(s)`;
    case 'unauthenticated':
      return 'Non authentifié';
    case 'invalid_credentials':
      return 'Identifiants incorrects';
    case 'invalid_token':
      return 'Lien invalide ou expiré';
    case 'permission_denied':
      return `Permission refusée : ${fault.action} sur ${fault.resource}`;
    case 'protected_subject': {
      const [name, gender] = label(fault.resource);
      const suffix = gender === 'f' ? 'protégée' : 'protégé';
      return `${demonstrative(gender, name)} ${name} est ${suffix} et ne peut pas être modifié${gender === 'f' ? 'e' : ''}`;
    }
    case 'self_action_forbidden':
      return `Impossible de ${verb(fault.action)} sur votre propre compte`;
    case 'self_only':
      return `Vous ne pouvez ${verb(fault.action)} que sur votre propre compte`;
    case 'rank_reserved':
      // « Cet acte », et non « Supprimer » : la garde ne refuse pas l'acte en général — supprimer un
      // utilisateur ordinaire reste permis — mais CETTE tentative-ci, sur ce sujet-là. Nommer le
      // verbe seul retournerait le sens.
      return fault.grants?.length
        ? `Cet acte — ${verb(fault.action)} — est réservé ${RANKS[fault.requires] ?? fault.requires} : ${fault.grants.join(', ')}`
        : `Cet acte — ${verb(fault.action)} — est réservé ${RANKS[fault.requires] ?? fault.requires}`;
    case 'undelegatable_grants': {
      // Groupé par raison : trois règles distinctes se croisent, et l'utilisateur doit savoir
      // laquelle corriger. Le domaine, lui, n'a jamais eu à formuler ça.
      const byReason = new Map<string, string[]>();
      for (const { grant, reason } of fault.grants) {
        byReason.set(reason, [...(byReason.get(reason) ?? []), grant]);
      }
      return [...byReason]
        .map(([reason, grants]) => `${grants.join(', ')} : ${UNDELEGATABLE[reason] ?? reason}`)
        .join(' · ');
    }
    case 'forbidden_resource': {
      const [name, gender] = label(fault.resource);
      return `Accès non autorisé à ${demonstrative(gender, name).toLowerCase()} ${name}`;
    }
    case 'redirect_url_rejected':
      return `URL de redirection refusée : ${fault.field}`;
    case 'personalization_rejected':
      // Le libellé du champ n'est pas ici : ce catalogue ne connaît pas la déclaration du produit.
      // C'est la surface qui l'a affichée qui sait le retrouver depuis l'identifiant.
      return {
        unknown: `Champ de personnalisation inconnu : ${fault.field}`,
        required: `Champ de personnalisation requis : ${fault.field}`,
        too_long: `Champ de personnalisation trop long : ${fault.field}`,
      }[fault.reason];
    case 'cardinality_exceeded': {
      const [name, gender] = label(fault.resource);
      return `${demonstrative(gender, name)} ${name} n’admet qu’une seule occurrence, et elle existe déjà`;
    }
    case 'destructive_plan':
      // Les `kind` deviennent des phrases ICI. La CLI a son propre `summary`, plus riche, qui ne
      // traverse jamais HTTP.
      return `Ce push détruirait des données : ${fault.steps
        .map((step) => `${DESTRUCTIVE[step.kind] ?? step.kind} « ${step.target} »`)
        .join(' · ')} — relancez avec confirmation si c’est voulu`;
    case 'configuration_missing':
      return `${fault.target} n’est pas configuré`;
    case 'required_data_missing':
      return `Champ requis manquant : ${fault.field}`;
    case 'validation_failed':
      // Le chemin est un pointeur JSON : on le rend tel quel, c'est ce que l'auteur reconnaît dans
      // son formulaire. La raison, elle, se dit en français — le domaine ne l'a jamais formulée.
      return fault.details
        .map((issue) => `${issue.path} ${VALIDATION[issue.reason] ?? issue.reason}`)
        .join(' · ');
    case 'empty_patch':
      return 'Aucun champ à modifier';
    case 'registry_incoherent':
      return `Déclaration refusée : ${fault.issues
        .map((issue) => `« ${issue.path} » ${INCOHERENCE[issue.reason] ?? issue.reason}`)
        .join(' · ')}`;
    case 'blocked_plan':
      return `Migration impossible en l’état : ${fault.blockers.map(blocker).join(' · ')}`;
    case 'unknown_reference_targets':
      return `Cibles référençables inconnues : ${fault.targets.join(', ')}`;
    case 'unknown_scopes':
      return `Portées inconnues : ${fault.scopes.join(', ')}`;
    case 'external_operation_failed':
      return `L’opération « ${fault.operation} » a échoué`;
  }
}
