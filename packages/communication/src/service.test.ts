import { describe, expect, test } from 'bun:test';
import { createAdapterRegistry } from '@repo/adapters';
import { CommunicationService } from './service';
import type {
  CommunicationAdapter,
  CommunicationLogEntry,
  CommunicationProvider,
  EmailMessage,
  SendResult,
} from './types';
import { COMMUNICATION_PROVIDERS } from './types';

// Ces tests n'existaient pas, et ne pouvaient pas exister : `sendEmail` résolvait son adapter par
// un singleton de module aux fabriques câblées en dur, lisait `site` et écrivait dans
// `communication_log` par un client Postgres importé. Aucune couture — ce qui protégeait le dépôt
// était qu'aucun provider n'est configuré dans la base de test. Une propriété de la DONNÉE, pas de
// l'architecture : des credentials valides suffisaient à envoyer pour de vrai depuis une suite.
//
// Ce fichier est la preuve que la couture existe. Aucune base, aucun réseau.

/** Un provider qui enregistre ce qu'on lui donne au lieu de l'envoyer. */
function fakeAdapter(
  provider: CommunicationProvider,
  result: SendResult = { success: true, messageId: 'msg-1' },
) {
  const sent: EmailMessage[] = [];
  const adapter: CommunicationAdapter = {
    provider,
    send: async (message) => {
      sent.push(message);
      return result;
    },
    verify: async () => true,
    isConfigured: async () => true,
  };
  return { adapter, sent };
}

function serviceWith(
  ready: readonly CommunicationProvider[],
  adapters: Partial<Record<CommunicationProvider, CommunicationAdapter>>,
) {
  const written: CommunicationLogEntry[] = [];
  // Record exhaustif plutôt qu'un `Object.fromEntries` casté : un provider ajouté à
  // COMMUNICATION_PROVIDERS ne compilera plus tant qu'il n'a pas d'entrée ici.
  const factories: Record<CommunicationProvider, () => CommunicationAdapter> = {
    resend: () => adapters.resend ?? fakeAdapter('resend').adapter,
    brevo: () => adapters.brevo ?? fakeAdapter('brevo').adapter,
    smtp: () => adapters.smtp ?? fakeAdapter('smtp').adapter,
  };

  const service = new CommunicationService({
    registry: createAdapterRegistry(COMMUNICATION_PROVIDERS, factories),
    isReady: async (provider) => ready.includes(provider),
    siteIdentity: async () => ({ name: 'Boutique test', url: 'https://exemple.test' }),
    journal: { record: async (entry) => void written.push(entry) },
  });

  return { service, written };
}

describe('CommunicationService', () => {
  test('envoie par le premier provider prêt, dans l’ordre déclaré', async () => {
    const brevo = fakeAdapter('brevo');
    // `resend` précède `brevo` dans COMMUNICATION_PROVIDERS, mais n'est pas prêt.
    const { service } = serviceWith(['brevo', 'smtp'], { brevo: brevo.adapter });

    const result = await service.send({
      to: 'client@exemple.test',
      subject: 'Bonjour',
      template: 'welcome',
      data: { customerName: 'Alice' },
    });

    expect(result.success).toBe(true);
    expect(result.skipped).toBeUndefined();
    expect(brevo.sent).toHaveLength(1);
    expect(brevo.sent[0]?.to).toBe('client@exemple.test');
  });

  test('enrichit les données avec l’identité du site', async () => {
    const resend = fakeAdapter('resend');
    const { service } = serviceWith(['resend'], { resend: resend.adapter });

    await service.send({ to: 'a@b.test', subject: 's', template: 'welcome', data: { x: 1 } });

    expect(resend.sent[0]?.data).toMatchObject({
      siteName: 'Boutique test',
      siteUrl: 'https://exemple.test',
      x: 1,
    });
  });

  test('consigne l’envoi réussi', async () => {
    const resend = fakeAdapter('resend');
    const { service, written } = serviceWith(['resend'], { resend: resend.adapter });

    await service.send({ to: 'a@b.test', subject: 'Sujet', template: 'welcome', data: {} });

    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      provider: 'resend',
      recipient: 'a@b.test',
      subject: 'Sujet',
      status: 'sent',
      providerMessageId: 'msg-1',
    });
  });

  test('consigne aussi l’échec, sans lever', async () => {
    const resend = fakeAdapter('resend', { success: false, error: 'quota dépassé' });
    const { service, written } = serviceWith(['resend'], { resend: resend.adapter });

    const result = await service.send({ to: 'a@b.test', subject: 's', template: 'welcome', data: {} });

    expect(result.success).toBe(false);
    expect(written[0]?.status).toBe('failed');
    expect(written[0]?.error).toBe('quota dépassé');
  });

  test('aucun provider prêt : skipped, et rien n’est consigné', async () => {
    const { service, written } = serviceWith([], {});

    const result = await service.send({ to: 'a@b.test', subject: 's', template: 'welcome', data: {} });

    // Une boutique neuve n'a pas encore de provider : ce n'est pas une faute, et l'appelant décide.
    expect(result).toEqual({ success: true, skipped: true });
    expect(written).toHaveLength(0);
  });

  test('les gabarits du socle passent par le même chemin', async () => {
    const resend = fakeAdapter('resend');
    const { service } = serviceWith(['resend'], { resend: resend.adapter });

    await service.sendUserInvitation({
      email: 'nouveau@exemple.test',
      firstName: 'Alice',
      inviteUrl: 'https://exemple.test/invite?token=x',
      invitedBy: 'Vincent',
    });

    expect(resend.sent[0]?.template).toBe('user-invitation');
    expect(resend.sent[0]?.data).toMatchObject({ firstName: 'Alice', invitedBy: 'Vincent' });
  });
});
