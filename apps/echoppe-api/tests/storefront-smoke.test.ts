import { beforeAll, describe, expect, it } from 'bun:test';
import { option, optionValue } from '@echoppe/core';
import { db, eq } from '@repo/db';
import { app } from '../src/app';
import {
  migrate,
  record,
  records,
  requireDisposableDb,
} from './harness';

// Smoke « base vierge depuis les migrations » (T2 du runbook). Régression directe de
// l'incident 0.4.0 : les colonnes option.type / option_value.metadata, poussées en dev
// via db:push sans migration générée, manquaient de l'image → 500 sur /products/ et
// /countries/ vide. Ce test migre une base JETABLE puis vérifie que les routes clés
// répondent.
//
// ⚠️ Il ne s'exécute QUE via `bun run test:api` (scripts/test-api.ts), qui provisionne une
// base disposable, injecte un DATABASE_URL explicite (écrasant le .env de dev) et pose le
// drapeau requireDisposableDb. Un `bun test` direct hériterait du DATABASE_URL de dev via .env —
// la migrer serait destructeur, d'où le refus.

requireDisposableDb();


beforeAll(async () => {
  await migrate();
});

describe('storefront smoke — base vierge migrée', () => {
  it('GET /countries/ → 200 et contient la France (seed migration prod)', async () => {
    const res = await app.handle(new Request('http://localhost/countries/'));
    expect(res.status).toBe(200);
    const body = records(await res.json());
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((c) => c.code === 'FR')).toBe(true);
  });

  it('GET /products/ → 200 (pas de 500 : colonnes option.type/metadata présentes)', async () => {
    const res = await app.handle(new Request('http://localhost/products/'));
    expect(res.status).toBe(200);
    const body = record(await res.json());
    expect(Array.isArray(body.data)).toBe(true);
    expect(record(body.meta, 'meta')).toBeDefined();
    expect(typeof record(body.meta, 'meta').hasNextPage).toBe('boolean');
  });

  it('option.type + option_value.metadata acceptent la forme oklch (round-trip)', async () => {
    const [axis] = await db.insert(option).values({ name: 'Couleur', type: 'color' }).returning();
    expect(axis.type).toBe('color');

    const metadata = { l: 0.7, c: 0.15, h: 30, alpha: 1 };
    const [value] = await db
      .insert(optionValue)
      .values({ option: axis.id, value: 'Terracotta', metadata })
      .returning();
    expect(value.metadata).toEqual(metadata);

    // Nettoyage (la cascade sur option supprime la valeur).
    await db.delete(option).where(eq(option.id, axis.id));
  });
});
