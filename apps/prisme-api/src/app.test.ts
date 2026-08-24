import { expect, test } from 'bun:test';
import { app } from './app';

// L'application PURE se teste sans base ni port : c'est tout l'intérêt de la séparer du bootstrap.
// Ces deux tests ne prouvent pas grand-chose du produit — ils prouvent que le squelette tient, et
// c'est exactement ce que ce lot livre.

test("la racine annonce l'API", async () => {
  const response = await app.handle(new Request('http://localhost/'));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ name: 'Prisme API' });
});

test('la sonde de santé vit dans l’espace réservé', async () => {
  const response = await app.handle(new Request('http://localhost/-/health'));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: 'ok' });
});
