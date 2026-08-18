import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { Elysia } from 'elysia';
import { errorHandler } from './error-handler';

/** Le corps JSON attendu — une réponse d'erreur mal formée doit casser ici, pas plus loin. */
function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`corps inattendu : ${JSON.stringify(value)?.slice(0, 200)}`);
  }
  return Object.fromEntries(Object.entries(value));
}

// L'invariant d'ADR-0050 se teste ici et nulle part ailleurs : ce qui est levé ne doit pas
// ressortir. Un test qui vérifierait seulement « le statut est 500 » manquerait tout l'objet.

const SECRET = 'Stripe secret key sk_live_51H is not configured';

const probe = new Elysia()
  .use(errorHandler)
  .get('/boom', () => {
    throw new Error(SECRET);
  })
  .get('/fine', () => ({ ok: true }));

const captureLogs = () => spyOn(console, 'error').mockImplementation(() => {});

afterEach(() => {
  spyOn(console, 'error').mockRestore();
});

describe('une exception non rattrapée', () => {
  it('ne laisse RIEN passer de son message', async () => {
    captureLogs();

    const res = await probe.handle(new Request('http://localhost/boom'));
    const body = await res.text();

    expect(res.status).toBe(500);
    expect(body).not.toContain(SECRET);
    expect(body).not.toContain('sk_live');
  });

  it('rend une corrélation opaque, et un message d’opérateur en anglais', async () => {
    captureLogs();

    const res = await probe.handle(new Request('http://localhost/boom'));
    const body = asRecord(await res.json());

    expect(body.message).toBe('Internal server error');
    // Opaque signifie : rien de dérivable. Un UUID ne dit ni quand, ni où, ni qui.
    expect(body.incident).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('écrit le détail au log, avec l’identifiant qui le rebranche à la réponse', async () => {
    const logged = captureLogs();

    const res = await probe.handle(new Request('http://localhost/boom'));
    const { incident } = asRecord(await res.json());

    const line = logged.mock.calls.at(0);
    expect(line?.[0]).toContain(incident);
    expect(line?.[0]).toContain('/boom');
    // Le détail existe — il est seulement de l'autre côté de la frontière.
    expect(String(line?.[1])).toContain(SECRET);
  });

  it('donne un incident DIFFÉRENT à chaque occurrence', async () => {
    captureLogs();

    const first = asRecord(await (await probe.handle(new Request('http://localhost/boom'))).json());
    const second = asRecord(await (await probe.handle(new Request('http://localhost/boom'))).json());

    expect(first.incident).not.toBe(second.incident);
  });
});

describe('ce que le gestionnaire ne touche pas', () => {
  it('laisse passer une réponse normale', async () => {
    const res = await probe.handle(new Request('http://localhost/fine'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('laisse Elysia répondre aux routes inconnues', async () => {
    // Volontairement hors périmètre : aucun message d'exception ne transite par ce chemin, donc
    // l'invariant n'y est pas en jeu et le contrat n'y apporterait rien.
    const res = await probe.handle(new Request('http://localhost/nulle-part'));

    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('incident');
  });
});
