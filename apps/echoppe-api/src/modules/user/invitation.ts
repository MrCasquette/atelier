import { createHash, randomBytes } from 'node:crypto';
import { session, user, userPasswordToken } from '@repo/auth';
import { sendUserInvitationEmail } from '@repo/communication';
import { db, eq } from '@repo/db';

// Le jeton de pose de mot de passe (ADR-0048).
//
// Inviter et débloquer sont le MÊME acte : prouver qu'on tient l'adresse, puis poser un mot de
// passe. Un seul jeton, une seule consommation, deux points d'entrée.

/** 24 h : une invitation doit pouvoir traverser une nuit, et rien de plus. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_COST = { algorithm: 'bcrypt', cost: 10 } as const;

/**
 * Là où le destinataire pose son mot de passe — un écran de l'administration. Le dashboard étant
 * servi par l'API sous `/-/admin` (ADR-0052), `ADMIN_URL` porte un chemin, pas un port.
 */
const ADMIN_URL = (process.env.ADMIN_URL || 'http://localhost:8100/-/admin').replace(/\/+$/, '');
const INVITATION_PATH = '/invitation';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export type Invitation = { url: string; expiresAt: Date };

/**
 * Une empreinte que rien ne peut satisfaire : le compte naît **sans secret utilisable**.
 *
 * On hache un secret aléatoire aussitôt jeté plutôt que d'écrire une chaîne sentinelle : une valeur
 * qui n'est pas une empreinte bcrypt valide ferait LEVER `Bun.password.verify` au lieu de rendre
 * `false`, et une exception dans la connexion est un comportement qu'on ne veut pas découvrir en
 * production.
 */
export async function unusablePasswordHash(): Promise<string> {
  return Bun.password.hash(randomBytes(32).toString('hex'), PASSWORD_COST);
}

/**
 * Émet un jeton pour cet utilisateur et rend le lien. Le jeton brut ne survit qu'ici et dans le
 * lien : la base n'en garde que l'empreinte.
 *
 * Les jetons antérieurs du même utilisateur sont invalidés — en émettre un nouveau, c'est dire que
 * le précédent ne vaut plus.
 */
export async function issuePasswordToken(userId: string): Promise<{
  invitation: Invitation;
  rawToken: string;
}> {
  await db.delete(userPasswordToken).where(eq(userPasswordToken.user, userId));

  const rawToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.insert(userPasswordToken).values({
    user: userId,
    tokenHash: sha256(rawToken),
    expiresAt,
  });

  return {
    invitation: { url: `${ADMIN_URL}${INVITATION_PATH}?token=${rawToken}`, expiresAt },
    rawToken,
  };
}

export type Delivery =
  /** Remis par courriel : personne d'autre que le destinataire ne voit le lien. */
  | { by: 'email' }
  /** Aucun fournisseur configuré : le lien revient à celui qui invite, à charge pour lui. */
  | { by: 'link'; invitation: Invitation };

/**
 * Émet le jeton et tente de le remettre par courriel. Sans fournisseur configuré, rend le lien à
 * l'appelant plutôt que de laisser l'invitation dans le vide (ADR-0048, décision 3).
 */
export async function inviteUser(input: {
  userId: string;
  email: string;
  firstName: string;
  invitedBy?: string;
}): Promise<Delivery> {
  const { invitation } = await issuePasswordToken(input.userId);

  const sent = await sendUserInvitationEmail({
    email: input.email,
    firstName: input.firstName,
    inviteUrl: invitation.url,
    invitedBy: input.invitedBy,
  });

  // `skipped` = aucun fournisseur. Un envoi qui ÉCHOUE est traité pareil : mieux vaut rendre le
  // lien que de laisser quelqu'un devant un compte inutilisable sans savoir pourquoi.
  return sent.skipped || !sent.success ? { by: 'link', invitation } : { by: 'email' };
}

export type ConsumeOutcome =
  | { outcome: 'set'; userId: string }
  /** Inconnu, déjà consommé ou périmé — les trois ne se distinguent pas côté appelant. */
  | { outcome: 'invalid-token' };

/**
 * Consomme le jeton et pose le mot de passe. Usage unique.
 *
 * Toutes les sessions de l'utilisateur tombent : qui a pu poser le mot de passe a pu en ouvrir une.
 */
export async function consumePasswordToken(
  rawToken: string,
  newPassword: string,
): Promise<ConsumeOutcome> {
  const [row] = await db
    .select({
      id: userPasswordToken.id,
      user: userPasswordToken.user,
      expiresAt: userPasswordToken.expiresAt,
      usedAt: userPasswordToken.usedAt,
    })
    .from(userPasswordToken)
    .where(eq(userPasswordToken.tokenHash, sha256(rawToken)));

  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return { outcome: 'invalid-token' };
  }

  const passwordHash = await Bun.password.hash(newPassword, PASSWORD_COST);

  await db.update(user).set({ passwordHash }).where(eq(user.id, row.user));
  await db
    .update(userPasswordToken)
    .set({ usedAt: new Date() })
    .where(eq(userPasswordToken.id, row.id));
  await db.delete(session).where(eq(session.user, row.user));

  return { outcome: 'set', userId: row.user };
}
