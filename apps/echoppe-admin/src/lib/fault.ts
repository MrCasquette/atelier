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
  category: ['catégorie', 'f'],
  collection: ['collection', 'f'],
  media: ['média', 'm'],
  option: ['option', 'f'],
  option_value: ['valeur d’option', 'f'],
  personalization_field: ['champ de personnalisation', 'm'],
  product: ['produit', 'm'],
  product_media: ['média du produit', 'm'],
  product_option: ['option du produit', 'f'],
  tax_rate: ['taux de TVA', 'm'],
  variant: ['variante', 'f'],
};

function label(resource: FaultResource): [string, Gender] {
  return RESOURCES[resource] ?? [resource.replace(/_/g, ' '), 'm'];
}

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** L'accord se règle ICI. Le domaine n'a jamais à savoir que « variante » est féminin. */
const demonstrative = (gender: Gender): string => (gender === 'f' ? 'Cette' : 'Ce');
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
      return `${demonstrative(gender)} ${name} est ${used} par au moins un élément « ${by} » — détachez-${detach} d’abord`;
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
