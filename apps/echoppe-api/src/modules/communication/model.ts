import { t } from 'elysia';

// Schémas de configuration des fournisseurs d'e-mail.
//
// Un corps par fournisseur plutôt qu'une union discriminée : les champs diffèrent réellement (clé
// d'API pour Resend et Brevo, hôte/port/identifiants pour SMTP) et chacun a sa propre route.
//
// Pas d'enregistrement dans `src/model.ts` : rien ici n'est exposé au contrat SDK sous un nom.

export const resendConfigBody = t.Object({
  apiKey: t.String({ minLength: 1 }),
  fromEmail: t.String({ format: 'email' }),
  fromName: t.String({ minLength: 1 }),
  replyTo: t.Optional(t.String({ format: 'email' })),
  isEnabled: t.Optional(t.Boolean()),
});

export const brevoConfigBody = t.Object({
  apiKey: t.String({ minLength: 1 }),
  fromEmail: t.String({ format: 'email' }),
  fromName: t.String({ minLength: 1 }),
  replyTo: t.Optional(t.String({ format: 'email' })),
  isEnabled: t.Optional(t.Boolean()),
});

export const smtpConfigBody = t.Object({
  host: t.String({ minLength: 1 }),
  port: t.Number({ minimum: 1, maximum: 65535 }),
  secure: t.Boolean(),
  user: t.String({ minLength: 1 }),
  pass: t.String({ minLength: 1 }),
  fromEmail: t.String({ format: 'email' }),
  fromName: t.String({ minLength: 1 }),
  replyTo: t.Optional(t.String({ format: 'email' })),
  isEnabled: t.Optional(t.Boolean()),
});

export const testEmailBody = t.Object({
  // Littéraux explicites (l'inférence Eden exige des TLiteral précis) — garder en phase avec COMMUNICATION_PROVIDERS.
  provider: t.Union([t.Literal('resend'), t.Literal('brevo'), t.Literal('smtp')]),
  to: t.String({ format: 'email' }),
});

export const providerFieldSchema = t.Object({
  key: t.String(),
  label: t.String(),
  type: t.String(),
  placeholder: t.Optional(t.String()),
  options: t.Optional(t.Array(t.Object({ value: t.String(), label: t.String() }))),
});

export const providerStatusSchema = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.String(),
  recommended: t.Optional(t.Boolean()),
  fields: t.Array(providerFieldSchema),
  isConfigured: t.Boolean(),
  isEnabled: t.Boolean(),
  encryptionReady: t.Boolean(),
});

export const testResultSchema = t.Object({
  success: t.Boolean(),
  messageId: t.Optional(t.String()),
  error: t.Optional(t.String()),
});
