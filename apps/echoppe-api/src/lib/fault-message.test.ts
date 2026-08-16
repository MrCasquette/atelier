import { describe, expect, it } from 'bun:test';
import type { Fault } from '@echoppe/core';
import { faultMessage } from './fault-message';

// Ce que le contrat de faute achète, vérifié plutôt qu'affirmé : le domaine émet un code et des
// données, le catalogue produit le français — accords compris. Aucun de ces accords n'existe dans le
// domaine, et c'est le but.

describe('accord en genre, réglé par le catalogue', () => {
  it('accorde l’article indéfini sur la ressource', () => {
    expect(faultMessage({ code: 'already_exists', resource: 'user', field: 'email' })).toBe(
      'Un utilisateur existe déjà avec ce email',
    );
    expect(faultMessage({ code: 'already_exists', resource: 'page', field: 'slug' })).toBe(
      'Une page existe déjà avec ce slug',
    );
  });

  it('accorde le démonstratif et le participe', () => {
    expect(faultMessage({ code: 'in_use', resource: 'option', usedBy: 'variant' })).toBe(
      'Cette option est utilisée par au moins une variante — détachez-la d’abord',
    );
    expect(faultMessage({ code: 'in_use', resource: 'role', usedBy: 'user' })).toBe(
      'Ce rôle est utilisé par au moins un utilisateur — détachez-le d’abord',
    );
  });

  it('accorde le pronom d’un état invalide', () => {
    expect(
      faultMessage({
        code: 'invalid_state',
        resource: 'order',
        current: 'payée',
        expected: 'en attente',
      }),
    ).toBe('Action impossible : cette commande est « payée », elle doit être « en attente »');
  });
});

describe('not_found couvre à lui seul la moitié des refus', () => {
  it('rend un nom français propre pour chaque ressource', () => {
    const cases: Array<[string, string]> = [
      ['product', 'Produit introuvable'],
      ['order', 'Commande introuvable'],
      ['media', 'Média introuvable'],
      ['folder', 'Dossier introuvable'],
      ['entity_row', 'Occurrence introuvable'],
      ['api_key', 'Clé d’API introuvable'],
    ];

    for (const [resource, expected] of cases) {
      expect(faultMessage({ code: 'not_found', resource })).toBe(expected);
    }
  });

  // Le repli est obligatoire : l'API livrera un jour une ressource qu'une surface déployée plus tôt
  // ne connaît pas. Sans lui, l'utilisateur lirait une clé brute.
  it('replie sur la clé lisible pour une ressource inconnue', () => {
    expect(faultMessage({ code: 'not_found', resource: 'gift_card' })).toBe(
      'Gift card introuvable',
    );
  });
});

describe('les listes restent des listes jusqu’au rendu', () => {
  // Joindre est une décision de LANGUE : le domaine rend un tableau, le catalogue choisit le
  // séparateur.
  it('joint les détails de validation au moment du rendu seulement', () => {
    expect(
      faultMessage({
        code: 'validation_failed',
        details: [
          { path: '/titre', reason: 'required' },
          { path: '/vues', reason: 'type' },
        ],
      }),
    ).toBe('/titre est requis · /vues n’a pas le type attendu');
    expect(
      faultMessage({ code: 'unknown_reference_targets', targets: ['article', 'auteur'] }),
    ).toBe('Cibles référençables inconnues : article, auteur');
  });
});

describe('les fautes volontairement indistinctes le restent', () => {
  // `invalid_credentials` ne dit pas laquelle des deux causes s'applique : les distinguer ferait de
  // l'endpoint un oracle d'énumération. Aucun catalogue ne peut rattraper ce que le domaine n'émet
  // pas — c'est précisément ce qui rend la fusion sûre.
  it('ne laisse filtrer aucune cause', () => {
    const message = faultMessage({ code: 'invalid_credentials' });

    expect(message).toBe('Identifiants incorrects');
    expect(message).not.toMatch(/compte|utilisateur|mot de passe|inconnu/i);
  });
});

describe('exhaustivité du catalogue', () => {
  // Le `switch` de `faultMessage` n'a pas de branche par défaut : ajouter un code à l'union sans
  // l'ajouter ici échoue à la compilation. Ce test vérifie l'autre moitié — qu'aucune branche ne
  // rend une chaîne vide.
  it('rend un message non vide pour chaque code', () => {
    const samples: Fault[] = [
      { code: 'not_found', resource: 'product' },
      { code: 'already_exists', resource: 'user', field: 'email' },
      { code: 'in_use', resource: 'role', usedBy: 'user' },
      { code: 'invalid_state', resource: 'order', current: 'a', expected: 'b' },
      { code: 'insufficient_stock', variant: '9f1c', available: 1, requested: 3 },
      { code: 'unauthenticated' },
      { code: 'invalid_credentials' },
      { code: 'invalid_token' },
      { code: 'permission_denied', action: 'update', resource: 'product' },
      { code: 'protected_subject', resource: 'user' },
      { code: 'self_action_forbidden', action: 'deactivate' },
      { code: 'self_only', action: 'update_password' },
      { code: 'rank_reserved', action: 'revoke', requires: 'first_rank' },
      {
        code: 'undelegatable_grants',
        grants: [
          { grant: 'schema', reason: 'rank_bound' },
          { grant: 'product:update', reason: 'not_held' },
        ],
      },
      { code: 'forbidden_resource', resource: 'order' },
      { code: 'redirect_url_rejected', field: 'successUrl' },
      { code: 'personalization_rejected', field: 'gravure', reason: 'required' },
      { code: 'configuration_missing', target: 'ENCRYPTION_KEY' },
      { code: 'required_data_missing', field: 'billingAddress' },
      { code: 'validation_failed', details: [{ path: '/x', reason: 'required' }] },
      { code: 'empty_patch' },
      { code: 'registry_incoherent', issues: [{ path: 'hero.x', reason: 'duplicate_field' }] },
      { code: 'blocked_plan', blockers: [{ reason: 'rows_present', target: 'article' }] },
      { code: 'unknown_reference_targets', targets: ['x'] },
      { code: 'unknown_scopes', scopes: ['x'] },
      { code: 'external_operation_failed', operation: 'webhook' },
    ];

    for (const fault of samples) {
      expect(faultMessage(fault).length).toBeGreaterThan(0);
    }
    expect(samples).toHaveLength(26);
  });
});
