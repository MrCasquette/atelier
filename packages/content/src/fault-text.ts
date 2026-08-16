// Le catalogue de la CLI (ADR-0050 §6).
//
// Troisième surface après l'API et l'administration, et la plus sobre : son lecteur est le
// développeur qui vient de pousser un registre, dans un terminal. Il n'a pas d'écran pour surligner
// un champ, donc le chemin s'écrit en clair ; il connaît ses propres fichiers, donc rien n'a besoin
// d'être expliqué deux fois.
//
// Ce paquet est PUBLIÉ et n'a aucune dépendance de production — c'est délibéré. Les types du contrat
// y sont donc redéclarés en structurel, comme `PlanStep` l'est déjà dans `sync.ts` : on décrit ce
// qu'on lit sur le fil, on ne l'importe pas.

/** Ce qu'une réponse d'erreur de l'API porte, vu d'ici : un code, et ce que ce code transporte. */
export type Fault = { code: string } & Record<string, unknown>;

const REGISTRY: Record<string, string> = {
  duplicate_field: 'est déclaré deux fois',
  unknown_component: 'cite un composant absent du registre',
  circular_component: 'entre dans une référence circulaire',
  invalid_name: 'porte un nom refusé (minuscules, chiffres et « _ », commençant par une lettre)',
  name_mismatch: 'est rangée sous une clé qui ne correspond pas à son nom',
  link_cardinality: 'a un lien qui contredit sa cardinalité',
  link_unknown_field: 'est cité par un lien mais n’est pas déclaré',
  link_field_type: 'n’a pas le type que son lien exige',
};

const VALIDATION: Record<string, string> = {
  required: 'est requis',
  type: 'n’a pas le type attendu',
  not_allowed: 'porte une valeur non permise',
  too_small: 'est trop petit',
  too_large: 'est trop grand',
  format: 'n’a pas la forme attendue',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string => (typeof value === 'string' ? value : '?');

/** Les entrées d'une liste d'opérandes, à plat — une faute mal formée ne fait pas tomber la CLI. */
const entries = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

/** Ce qui empêche un plan de s'appliquer. Chaque raison porte ses propres opérandes. */
export function blockerText(blocker: Record<string, unknown>): string {
  const target = str(blocker.target);
  switch (blocker.reason) {
    case 'rows_present':
      return `« ${target} » contient des lignes — videz la table d’abord`;
    case 'dangling_rows':
      return `« ${target} » porte des valeurs qui ne désignent plus rien dans « ${str(blocker.references)} »`;
    case 'still_referenced': {
      const holders = Array.isArray(blocker.holders) ? blocker.holders.map(str).join(', ') : '?';
      return `« ${target} » est encore référencée par ${holders} — retirez ces champs, jamais de cascade`;
    }
    case 'unmanaged_column':
      return `« ${target} » n’a pas été créée par ce mécanisme : intervention manuelle requise`;
    default:
      return `« ${target} » : ${str(blocker.reason)}`;
  }
}

/**
 * Rend une faute en une ligne de terminal, ou `null` si ce catalogue ne connaît pas son code.
 *
 * `null` plutôt qu'un texte creux : l'appelant sait mieux quoi dire, et il affichera au pire le code
 * brut — qui reste actionnable pour un développeur, contrairement à un « une erreur est survenue ».
 */
export function faultText(fault: Fault): string | null {
  switch (fault.code) {
    case 'registry_incoherent': {
      const issues = entries(fault.issues)
        .map(
          (issue) => `« ${str(issue.path)} » ${REGISTRY[str(issue.reason)] ?? str(issue.reason)}`,
        )
        .join(' · ');
      return `Déclaration refusée : ${issues}`;
    }
    case 'blocked_plan':
      return `Migration impossible en l’état : ${entries(fault.blockers).map(blockerText).join(' · ')}`;
    case 'destructive_plan': {
      const steps = entries(fault.steps)
        .map((step) => `${str(step.kind)} « ${str(step.target)} »`)
        .join(' · ');
      return `Ce push détruirait des données : ${steps} — relancez avec « --force » si c’est voulu`;
    }
    case 'validation_failed': {
      const details = entries(fault.details)
        .map((issue) => `${str(issue.path)} ${VALIDATION[str(issue.reason)] ?? str(issue.reason)}`)
        .join(' · ');
      return `Données refusées : ${details}`;
    }
    case 'unknown_reference_targets':
      return `Cibles référençables inconnues : ${(Array.isArray(fault.targets) ? fault.targets : []).map(str).join(', ')}`;
    case 'unknown_scopes':
      return `Portées inconnues : ${(Array.isArray(fault.scopes) ? fault.scopes : []).map(str).join(', ')}`;
    case 'unauthenticated':
      return 'Clé d’API refusée — vérifiez ECHOPPE_API_KEY';
    case 'permission_denied':
      return `Droit manquant : ${str(fault.action)} sur « ${str(fault.resource)} » — la clé doit porter « write:schema »`;
    case 'not_found':
      return `Introuvable : ${str(fault.resource)}`;
    case 'service_unavailable':
      return 'Service indisponible — réessayez plus tard';
    default:
      return null;
  }
}

/** La faute portée par un corps de réponse, si la route qui l'a rendue en produit une. */
export function faultOf(body: unknown): Fault | null {
  if (!isRecord(body) || !isRecord(body.fault) || typeof body.fault.code !== 'string') return null;
  return { ...body.fault, code: body.fault.code };
}
