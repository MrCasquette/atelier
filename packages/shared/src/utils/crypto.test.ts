import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { decrypt, encrypt, generateEncryptionKey, isEncryptionConfigured } from './crypto';

// Ce qui protège les credentials de paiement, de livraison et de communication — trois paquets en
// dépendent. La clé se lit à CHAQUE appel, jamais au chargement du module : c'est ce qui rend ces
// tests possibles sans réimporter, et un changement là-dessus les casserait tous d'un coup.

const KEY = 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY=';

let saved: string | undefined;

beforeEach(() => {
  saved = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = KEY;
});

afterEach(() => {
  if (saved === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = saved;
});

describe('un secret chiffré se relit à l’identique', () => {
  it('fait l’aller-retour', () => {
    expect(decrypt(encrypt('sk_live_42'))).toBe('sk_live_42');
  });

  it('préserve l’unicode et la chaîne vide', () => {
    expect(decrypt(encrypt('clé « éàü » 🔑'))).toBe('clé « éàü » 🔑');
    expect(decrypt(encrypt(''))).toBe('');
  });

  it('ne produit jamais deux fois le même chiffré — l’IV est tiré au hasard', () => {
    const [a, b] = [encrypt('même secret'), encrypt('même secret')];

    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });
});

describe('un chiffré altéré est refusé, pas déchiffré de travers', () => {
  // La propriété qui justifie GCM plutôt que CBC : l'authentification est vérifiée au
  // déchiffrement. Sans elle, un credential modifié en base passerait pour valide.
  it('refuse un ciphertext modifié', () => {
    const raw = Buffer.from(encrypt('sk_live_42'), 'base64');
    raw[raw.length - 1] ^= 0xff;

    expect(() => decrypt(raw.toString('base64'))).toThrow();
  });

  it('refuse un authTag modifié', () => {
    const raw = Buffer.from(encrypt('sk_live_42'), 'base64');
    raw[12] ^= 0xff;

    expect(() => decrypt(raw.toString('base64'))).toThrow();
  });

  it('refuse un chiffré produit avec une autre clé', () => {
    const encrypted = encrypt('sk_live_42');
    process.env.ENCRYPTION_KEY = generateEncryptionKey();

    expect(() => decrypt(encrypted)).toThrow();
  });
});

describe('la clé est validée avant tout usage', () => {
  it('refuse une clé absente en disant comment en produire une', () => {
    delete process.env.ENCRYPTION_KEY;

    expect(() => encrypt('x')).toThrow(/openssl rand -base64 32/);
  });

  it('refuse une clé qui ne fait pas 32 octets', () => {
    process.env.ENCRYPTION_KEY = Buffer.from('trop court').toString('base64');

    expect(() => encrypt('x')).toThrow(/32 bytes/);
  });

  it('produit une clé de 32 octets, directement utilisable', () => {
    process.env.ENCRYPTION_KEY = generateEncryptionKey();

    expect(Buffer.from(process.env.ENCRYPTION_KEY, 'base64')).toHaveLength(32);
    expect(decrypt(encrypt('x'))).toBe('x');
  });

  it('rend la configuration lisible sans lever', () => {
    expect(isEncryptionConfigured()).toBe(true);

    delete process.env.ENCRYPTION_KEY;
    expect(isEncryptionConfigured()).toBe(false);
  });
});

describe('la disposition des octets est un contrat de compatibilité', () => {
  // Elle est annoncée dans la docstring d'`encrypt` et le stockage en dépend : un chiffré écrit en
  // base hier doit rester lisible demain. Si ce test casse, les credentials déjà stockés sont
  // illisibles — ce n'est pas un détail d'implémentation.
  it('place iv (12) puis authTag (16) devant le ciphertext', () => {
    const raw = Buffer.from(encrypt('abc'), 'base64');

    expect(raw.length).toBe(12 + 16 + 3);
  });
});
