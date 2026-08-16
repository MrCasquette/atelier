import { describe, expect, it } from 'bun:test';
import type { FaultCode } from '@repo/shared';
import * as faults from './fault';
import type { EchoppeFault } from './fault-resources';

// Ce qu'on vérifie ici n'est pas que `notFound('product')` rend `{ code: 'not_found' }` — le type le
// dit déjà. Ce sont les deux propriétés que le contrat achète et que rien d'autre ne garantit :
//
// 1. l'union et les constructeurs ne divergent pas — ajouter un code sans son constructeur doit
//    casser quelque chose, ici et tout de suite ;
// 2. le vocabulaire est réellement FERMÉ, en entrée comme en sortie.
//
// Le reste — l'accord en genre, la ponctuation — appartient au catalogue de la surface qui rend, et
// se teste là-bas (`apps/echoppe-api/src/lib/fault-message.test.ts`).

/**
 * Un échantillon par code, produit PAR le constructeur correspondant.
 *
 * `Record<FaultCode, …>` est le verrou : ajouter un membre à l'union sans lui donner de constructeur
 * ne compile plus. C'est la seule façon de tenir l'exhaustivité — une liste écrite à la main se
 * périme en silence.
 */
const SAMPLES: Record<FaultCode, EchoppeFault> = {
  not_found: faults.notFound('product'),
  already_exists: faults.alreadyExists('product', 'slug'),
  in_use: faults.inUse('option', 'variant'),
  invalid_state: faults.invalidState('order', 'paid', 'pending'),
  insufficient_stock: faults.insufficientStock('9f1c-variant', 2, 5),
  unauthenticated: faults.unauthenticated(),
  invalid_credentials: faults.invalidCredentials(),
  invalid_token: faults.invalidToken(),
  permission_denied: faults.permissionDenied('update', 'entity:article'),
  protected_subject: faults.protectedSubject('user'),
  // Les actions sont des CODES, pas des verbes français : c'est la surface qui conjugue.
  self_action_forbidden: faults.selfActionForbidden('deactivate'),
  self_only: faults.selfOnly('update_password'),
  rank_reserved: faults.rankReserved('transfer_ownership', 'owner'),
  undelegatable_grants: faults.undelegatableGrants([
    { grant: 'schema', reason: 'rank_bound' },
    { grant: 'product:update', reason: 'not_held' },
  ]),
  forbidden_resource: faults.forbiddenResource('address'),
  redirect_url_rejected: faults.redirectUrlRejected('successUrl'),
  personalization_rejected: faults.personalizationRejected('gravure', 'too_long'),
  cardinality_exceeded: faults.cardinalityExceeded('entity'),
  destructive_plan: faults.destructivePlan([{ kind: 'drop_column', target: 'article.prix' }]),
  configuration_missing: faults.configurationMissing('STRIPE_SECRET_KEY'),
  required_data_missing: faults.requiredDataMissing('shippingAddress'),
  validation_failed: faults.validationFailed([{ path: '/name', reason: 'required' }]),
  empty_patch: faults.emptyPatch(),
  registry_incoherent: faults.registryIncoherent([
    { path: 'hero.titre', reason: 'duplicate_field' },
  ]),
  blocked_plan: faults.blockedPlan([
    { reason: 'still_referenced', target: 'article', holders: ['recette.source'] },
  ]),
  unknown_reference_targets: faults.unknownReferenceTargets(['page']),
  unknown_scopes: faults.unknownScopes(['catalog']),
  external_operation_failed: faults.externalOperationFailed('payment.capture'),
};

describe('le catalogue de constructeurs couvre l’union', () => {
  it('range chaque échantillon sous son propre code', () => {
    // Le `Record` garantit qu'il existe une entrée par code ; ceci garantit que l'entrée a bien été
    // produite par le constructeur de CE code, et non recopiée d'une ligne voisine.
    for (const [code, fault] of Object.entries(SAMPLES)) {
      expect(fault.code).toBe(code as FaultCode);
    }
  });

  it('n’émet aucune prose — ni phrase, ni ponctuation d’affichage', () => {
    // ADR-0050 §3 : un paquet de domaine n'écrit pas d'interface. Les opérandes sont des noms et des
    // valeurs ; la mise en forme appartient à la surface. Le test gèle l'intention, pas un texte.
    const rendered = Object.values(SAMPLES).flatMap((fault) =>
      Object.entries(fault)
        .filter(([key]) => key !== 'code')
        .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
        .filter((value): value is string => typeof value === 'string'),
    );

    for (const value of rendered) {
      expect(value).not.toMatch(/[«»—·]/);
    }
  });
});

describe('les opérandes traversent intactes', () => {
  it('transporte les deux ressources d’une faute in_use', () => {
    expect(faults.inUse('tax_rate', 'product')).toEqual({
      code: 'in_use',
      resource: 'tax_rate',
      usedBy: 'product',
    });
  });

  it('garde `details` en LISTE de fautes LOCALISÉES, jamais de phrases', () => {
    // Le domaine ne choisit ni le séparateur ni les mots : il rend un chemin et un code. La forme
    // précédente — `${path} ${message}` — servait la prose anglaise de TypeBox à un écran français.
    const fault = faults.validationFailed([
      { path: '/name', reason: 'required' },
      { path: '/price', reason: 'too_small' },
    ]);
    expect(fault).toEqual({
      code: 'validation_failed',
      details: [
        { path: '/name', reason: 'required' },
        { path: '/price', reason: 'too_small' },
      ],
    });
  });

  it('ne transporte QUE ce que l’appelant ne peut pas reconstruire (ADR-0050 §5)', () => {
    // `still_referenced` porte `holders` : ce sont d'AUTRES entités que celle soumise, donc
    // introuvables depuis la requête. Les autres raisons ne portent que leur cible — le compte de
    // lignes, lui, ne changerait aucun geste.
    expect(
      faults.blockedPlan([
        { reason: 'rows_present', target: 'article' },
        { reason: 'still_referenced', target: 'auteur', holders: ['article.auteur'] },
      ]),
    ).toEqual({
      code: 'blocked_plan',
      blockers: [
        { reason: 'rows_present', target: 'article' },
        { reason: 'still_referenced', target: 'auteur', holders: ['article.auteur'] },
      ],
    });
  });

  it('rend les quantités d’un stock insuffisant en NOMBRES, et nomme la variante', () => {
    // L'identifiant est OBLIGATOIRE : les quatre gardes qui émettent cette faute l'ont sous la
    // main, et deux d'entre elles servent un appelant qui ne peut pas le déduire de sa requête.
    expect(faults.insufficientStock('9f1c-variant', 2, 5)).toEqual({
      code: 'insufficient_stock',
      variant: '9f1c-variant',
      available: 2,
      requested: 5,
    });
  });
});

describe('le vocabulaire est fermé', () => {
  it('refuse une ressource hors vocabulaire à la compilation', () => {
    // @ts-expect-error `produit` est du français, pas du vocabulaire de ressources.
    faults.notFound('produit');
    // @ts-expect-error `usedBy` est une ressource, pas une phrase.
    faults.inUse('option', 'des variantes du produit');
    // @ts-expect-error l'échelle de rang est fermée : `admin` est une clé de rôle, pas un rang.
    faults.rankReserved('revoke', 'admin');
    // @ts-expect-error la raison d'un refus de délégation est un code du contrat, pas une phrase.
    faults.undelegatableGrants([{ grant: 'schema', reason: 'tient au rang' }]);

    // Le test ne s'exécute pas vraiment : ce sont les `@ts-expect-error` ci-dessus qui portent
    // l'assertion. Si la fermeture tombait, `tsc` échouerait sur une directive devenue inutile.
    expect(true).toBe(true);
  });

  it('ferme aussi l’échelle des rangs, qui est du produit et non du socle', () => {
    // `@repo/auth` ne sait décrire que des ÉTENDUES de droits ; le rang vit dans
    // `FIRST_RANK_ROLE_KEYS`. Le contrat le porte donc en paramètre, comme les ressources.
    expect(faults.rankReserved('revoke', 'first_rank')).toEqual({
      code: 'rank_reserved',
      action: 'revoke',
      requires: 'first_rank',
    });
  });

  it('laisse permission_denied ouvert, parce que le RBAC l’est', () => {
    // ADR-0038 : l'espace `entity:<nom>` est déclaré par le développeur, donc inconnu à la
    // compilation. C'est la seule exception, et elle est délibérée.
    expect(faults.permissionDenied('read', 'entity:recette')).toEqual({
      code: 'permission_denied',
      action: 'read',
      resource: 'entity:recette',
    });
  });
});
