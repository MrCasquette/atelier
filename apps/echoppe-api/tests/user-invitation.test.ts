import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { role, session, user, userPasswordToken } from '@repo/auth';
import { db, eq } from '@repo/db';
import { authenticateAdmin } from '@repo/auth';
import {
  createAdminSession,
  migrate,
  record,
  req,
  requireDisposableDb,
  resetRateLimits,
  text,
} from './harness';

// Inviter un utilisateur (ADR-0048).
//
// Ce qui se vérifie ici n'est pas qu'un courriel part — aucun fournisseur n'est configuré dans le
// bac à sable, et c'est justement le cas intéressant. C'est que **le créateur ne connaît jamais le
// mot de passe** : le compte naît inutilisable, et seul celui qui tient le lien peut l'ouvrir.
//
// Les surfaces d'authentification sont rate-limitées (10 / 15 min par IP) et tous les fichiers
// partagent la même IP : on remet les compteurs à zéro avant chaque cas, et l'on vérifie un mot de
// passe par le chemin d'authentification plutôt qu'en frappant `/auth/login` douze fois.
//
// ⚠️ Base JETABLE via `bun run integration echoppe api` uniquement.
requireDisposableDb();

let ownerCookie: string;
let ordinaryRoleId: string;

const tokenOf = (url: string): string => new URL(url).searchParams.get('token') ?? '';

const sha256 = (value: string): string =>
  new Bun.CryptoHasher('sha256').update(value).digest('hex');

/** Ce mot de passe ouvre-t-il ce compte ? Lu en base, sans passer par la route limitée. */
async function opens(userId: string, password: string): Promise<boolean> {
  const [found] = await db
    .select({ passwordHash: user.passwordHash })
    .from(user)
    .where(eq(user.id, userId));
  return Bun.password.verify(password, found.passwordHash);
}

async function createUser(
  email: string,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown> & { status: number }> {
  const res = await req('POST', '/users', {
    cookie: ownerCookie,
    body: { email, firstName: 'Invité', lastName: 'Test', role: ordinaryRoleId, ...extra },
  });
  return { ...(record(await res.json())), status: res.status };
}

const accept = (token: string, password: string) =>
  req('POST', '/auth/accept-invitation', { body: { token, password } });

beforeAll(async () => {
  await migrate();
  ownerCookie = await createAdminSession();

  const [created] = await db
    .insert(role)
    .values({ name: `Invitation ${crypto.randomUUID().slice(0, 8)}`, scope: 'admin' })
    .returning();
  ordinaryRoleId = text(created.id, 'id');
});

beforeEach(resetRateLimits);

describe('créer un utilisateur ne pose plus son mot de passe', () => {
  it('ignore un `password` glissé dans le corps — le champ n’existe plus', async () => {
    const created = await createUser(`refus-${crypto.randomUUID().slice(0, 8)}@echoppe.test`, {
      password: 'choisi-par-le-createur',
    });

    expect(created.status).toBe(200);
    // C'est LE point : quoi qu'il envoie, le créateur n'a pas posé de secret.
    expect(await opens(text(created.id, 'id'), 'choisi-par-le-createur')).toBe(false);
  });

  it('rend le lien faute de fournisseur, plutôt que de laisser l’invitation dans le vide', async () => {
    const created = await createUser(`lien-${crypto.randomUUID().slice(0, 8)}@echoppe.test`);

    const invitation = record(created.invitation, 'invitation');
    expect(text(invitation.url, 'url')).toContain('/invitation?token=');
    expect(new Date(text(invitation.expiresAt, 'expiresAt')).getTime()).toBeGreaterThan(Date.now());
  });

  it('pose une empreinte que rien ne satisfait, plutôt qu’une sentinelle', async () => {
    const created = await createUser(`muet-${crypto.randomUUID().slice(0, 8)}@echoppe.test`);

    const [found] = await db
      .select({ passwordHash: user.passwordHash })
      .from(user)
      .where(eq(user.id, text(created.id, 'id')));

    // Une chaîne qui n'est pas une empreinte bcrypt ferait LEVER `verify` au lieu de rendre false,
    // et la connexion planterait au lieu de refuser.
    expect(found.passwordHash).toStartWith('$2');
    expect(await opens(text(created.id, 'id'), '')).toBe(false);
  });
});

/** L'URL d'invitation d'un compte créé — vérifiée une fois, lue partout. */
const invitationUrl = (created: Record<string, unknown>): string =>
  text(record(created.invitation, 'invitation').url, 'invitation.url');

describe('poser son mot de passe', () => {
  it('ouvre le compte — vérifié par le chemin d’authentification, pas par l’empreinte', async () => {
    const email = `pose-${crypto.randomUUID().slice(0, 8)}@echoppe.test`;
    const created = await createUser(email);

    expect((await accept(tokenOf(invitationUrl(created)), 'mon-secret-a-moi')).status).toBe(
      200,
    );

    // `authenticateAdmin` est ce que la route de connexion appelle : on passe par la vraie
    // vérification, sans consommer le rate-limit que TOUS les fichiers du run partagent (même IP).
    const authenticated = await authenticateAdmin(
      { email, password: 'mon-secret-a-moi' },
      { ipAddress: '127.0.0.1', userAgent: 'test' },
    );

    expect(authenticated.outcome).toBe('authenticated');
  });

  it('ne sert qu’une fois — y compris à qui a vu le lien passer', async () => {
    const created = await createUser(`unique-${crypto.randomUUID().slice(0, 8)}@echoppe.test`);
    const token = tokenOf(invitationUrl(created));

    expect((await accept(token, 'premier')).status).toBe(200);
    expect((await accept(token, 'second')).status).toBe(400);
    expect(await opens(text(created.id, 'id'), 'second')).toBe(false);
  });

  it('ne distingue pas un jeton inconnu d’un jeton périmé', async () => {
    const unknown = await accept('f'.repeat(64), 'peu-importe');

    expect(unknown.status).toBe(400);
    // Un seul code pour les deux causes : la fusion est la propriété de sécurité, pas un raccourci.
    expect(await unknown.json()).toMatchObject({ fault: { code: 'invalid_token' } });
  });

  it('refuse un jeton périmé', async () => {
    const created = await createUser(`perime-${crypto.randomUUID().slice(0, 8)}@echoppe.test`);
    const token = tokenOf(invitationUrl(created));

    await db
      .update(userPasswordToken)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(userPasswordToken.tokenHash, sha256(token)));

    expect((await accept(token, 'trop-tard')).status).toBe(400);
    expect(await opens(text(created.id, 'id'), 'trop-tard')).toBe(false);
  });

  it('coupe les sessions ouvertes : qui a pu poser le mot de passe a pu en ouvrir une', async () => {
    const created = await createUser(`sessions-${crypto.randomUUID().slice(0, 8)}@echoppe.test`);

    await db.insert(session).values({
      token: crypto.randomUUID().replace(/-/g, ''),
      user: text(created.id, 'id'),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await accept(tokenOf(invitationUrl(created)), 'nouveau-secret');

    expect(await db.select().from(session).where(eq(session.user, text(created.id, 'id')))).toHaveLength(0);
  });
});

describe('réémettre un lien', () => {
  it('débloque un compte sans que personne n’apprenne son secret', async () => {
    const created = await createUser(`debloque-${crypto.randomUUID().slice(0, 8)}@echoppe.test`);
    await accept(tokenOf(invitationUrl(created)), 'premier-secret');

    const res = await req('POST', `/users/${text(created.id, 'id')}/reset`, { cookie: ownerCookie });
    expect(res.status).toBe(200);

    const invitation = record(record(await res.json()).invitation, 'invitation');
    expect((await accept(tokenOf(text(invitation.url, 'url')), 'second-secret')).status).toBe(200);

    expect(await opens(text(created.id, 'id'), 'second-secret')).toBe(true);
    expect(await opens(text(created.id, 'id'), 'premier-secret')).toBe(false);
  });

  it('invalide le jeton précédent : en émettre un nouveau, c’est dire que l’autre est mort', async () => {
    const created = await createUser(`double-${crypto.randomUUID().slice(0, 8)}@echoppe.test`);
    const first = tokenOf(invitationUrl(created));

    await req('POST', `/users/${text(created.id, 'id')}/reset`, { cookie: ownerCookie });

    expect((await accept(first, 'avec-le-vieux-jeton')).status).toBe(400);
  });

  it('refuse un utilisateur inexistant', async () => {
    const res = await req('POST', `/users/${crypto.randomUUID()}/reset`, { cookie: ownerCookie });

    expect(res.status).toBe(404);
  });
});

describe('modifier le mot de passe de quelqu’un d’autre', () => {
  it('est refusé, même au propriétaire — c’est la procuration qu’on ferme', async () => {
    const created = await createUser(`procuration-${crypto.randomUUID().slice(0, 8)}@echoppe.test`);
    await accept(tokenOf(invitationUrl(created)), 'le-sien');

    const res = await req('PATCH', `/users/${text(created.id, 'id')}`, {
      cookie: ownerCookie,
      body: { password: 'impose-par-un-autre' },
    });

    expect(res.status).toBe(403);
    expect(await opens(text(created.id, 'id'), 'le-sien')).toBe(true);
    expect(await opens(text(created.id, 'id'), 'impose-par-un-autre')).toBe(false);
  });

  it('reste permis sur soi : il n’existe pas d’autre route pour changer le sien', async () => {
    const [owner] = await db.select().from(user).where(eq(user.isOwner, true));

    const res = await req('PATCH', `/users/${owner.id}`, {
      cookie: ownerCookie,
      body: { password: 'le-mien-a-moi' },
    });

    expect(res.status).toBe(200);
    expect(await opens(owner.id, 'le-mien-a-moi')).toBe(true);

    // La base repart comme elle est arrivée : les autres fichiers partagent ce propriétaire.
    await db
      .update(user)
      .set({ passwordHash: await Bun.password.hash('admin123') })
      .where(eq(user.id, owner.id));
  });
});
