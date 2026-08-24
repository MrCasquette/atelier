import { expect, test } from 'bun:test';
import { getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import * as manifest from './migrations';

// Ce que Prisme migre est une DÉCISION, pas une conséquence.
//
// Le manifeste réexporte des tables qui appartiennent aux paquets partagés. Sans ce test, une table
// ajoutée à `@repo/auth` ou `@repo/pages` entrerait dans les migrations de Prisme au prochain
// `db:generate` sans que personne l'ait voulu — et une migration, une fois publiée, ne se retire
// plus. On fige donc la surface : l'élargir demande de toucher cette liste, ce qui est exactement
// le geste qu'on veut rendre conscient.
const EMBARQUÉES = [
  'api_key',
  'audit_log',
  'content_definition',
  'country',
  'entity_definition',
  'folder',
  'legal_entity',
  'media',
  'menu',
  'page',
  'permission',
  'role',
  'section',
  'session',
  'site',
  'user',
  'user_password_token',
];

function tables(): readonly string[] {
  return Object.values(manifest)
    .filter((value) => is(value, PgTable))
    .map((table) => getTableName(table))
    .sort();
}

test('Prisme embarque exactement les tables de contenu qu’il a décidé de porter', () => {
  expect(tables()).toEqual(EMBARQUÉES);
});

test('aucune table du commerce n’entre dans les migrations de Prisme', () => {
  // La frontière entre produits, lue là où elle se paie vraiment : le schéma d'une installation.
  // `product-isolation` garde les dépendances ; celle-ci garde ce qui finit dans la base.
  const commerce = ['cart', 'order', 'product', 'stock', 'payment', 'shipping', 'tax_rate'];
  for (const nom of commerce) {
    expect(tables()).not.toContain(nom);
  }
});
