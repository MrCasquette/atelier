import {
  CommunicationService,
  createCommunicationRegistry,
  createDbJournal,
  createDbProviderReadiness,
} from '@repo/communication';
import { db } from '@repo/db';
import { site } from '@repo/identity';
import { Elysia } from 'elysia';

// Composition de l'envoi d'e-mails — la racine de composition du produit.
//
// Le socle décrit ce dont l'envoi a besoin (un registre de providers, l'identité du site, un
// journal) ; c'est ici, et nulle part ailleurs, qu'on dit avec quoi le servir. Un test qui veut
// exercer le chemin d'envoi construit son propre `CommunicationService` avec de faux providers,
// sans toucher à ce fichier ni à une base.

/**
 * L'identité affichée en pied d'e-mail (ADR-0040), relue à chaque envoi.
 *
 * Le repli existe parce que `site` peut ne pas être renseigné : rien n'est fabriqué à
 * l'installation (ADR-0039).
 */
async function siteIdentity(): Promise<{ name: string; url?: string }> {
  const [row] = await db.select().from(site).limit(1);
  return { name: row?.name ?? 'Notre site', url: row?.url ?? undefined };
}

export const mailService = new CommunicationService({
  registry: createCommunicationRegistry(),
  isReady: createDbProviderReadiness(),
  siteIdentity,
  journal: createDbJournal(),
});

/** Met le service à disposition des contrôleurs, sous `mail`. */
export const mailPlugin = new Elysia({ name: 'mail' }).decorate('mail', mailService);
