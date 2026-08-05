import type { CommunicationProvider } from '@echoppe/core';

// Métadonnées d'affichage des fournisseurs : de quoi l'administration dessine son formulaire de
// configuration sans rien savoir des fournisseurs. C'est de la donnée, pas de la validation — elle
// ne partage donc pas `model.ts`, et une clé décrite ici doit exister dans le corps correspondant.

export const providerMeta: Record<
  CommunicationProvider,
  {
    name: string;
    description: string;
    recommended?: boolean;
    fields: {
      key: string;
      label: string;
      type: string;
      placeholder?: string;
      options?: { value: string; label: string }[];
    }[];
  }
> = {
  resend: {
    name: 'Resend',
    description: "Service d'email transactionnel moderne et fiable",
    recommended: true,
    fields: [
      { key: 'apiKey', label: 'Clé API', type: 'password', placeholder: 're_...' },
      {
        key: 'fromEmail',
        label: 'Email expéditeur',
        type: 'email',
        placeholder: 'contact@votredomaine.fr',
      },
      { key: 'fromName', label: 'Nom expéditeur', type: 'text', placeholder: 'Ma Boutique' },
      {
        key: 'replyTo',
        label: 'Email de réponse (optionnel)',
        type: 'email',
        placeholder: 'reponse@votredomaine.fr',
      },
    ],
  },
  brevo: {
    name: 'Brevo',
    description: 'Solution française (ex-Sendinblue), 300 emails/jour gratuits',
    fields: [
      { key: 'apiKey', label: 'Clé API', type: 'password', placeholder: 'xkeysib-...' },
      {
        key: 'fromEmail',
        label: 'Email expéditeur',
        type: 'email',
        placeholder: 'contact@votredomaine.fr',
      },
      { key: 'fromName', label: 'Nom expéditeur', type: 'text', placeholder: 'Ma Boutique' },
      {
        key: 'replyTo',
        label: 'Email de réponse (optionnel)',
        type: 'email',
        placeholder: 'reponse@votredomaine.fr',
      },
    ],
  },
  smtp: {
    name: 'SMTP',
    description: 'Serveur SMTP personnalisé (OVH, Ionos, Gmail...)',
    fields: [
      { key: 'host', label: 'Serveur SMTP', type: 'text', placeholder: 'ssl0.ovh.net' },
      {
        key: 'port',
        label: 'Port',
        type: 'select',
        options: [
          { value: '465', label: '465 (SSL)' },
          { value: '587', label: '587 (TLS)' },
          { value: '25', label: '25 (non sécurisé)' },
        ],
      },
      {
        key: 'secure',
        label: 'Connexion sécurisée (SSL)',
        type: 'checkbox',
      },
      { key: 'user', label: 'Identifiant', type: 'text', placeholder: 'contact@votredomaine.fr' },
      { key: 'pass', label: 'Mot de passe', type: 'password' },
      {
        key: 'fromEmail',
        label: 'Email expéditeur',
        type: 'email',
        placeholder: 'contact@votredomaine.fr',
      },
      { key: 'fromName', label: 'Nom expéditeur', type: 'text', placeholder: 'Ma Boutique' },
      {
        key: 'replyTo',
        label: 'Email de réponse (optionnel)',
        type: 'email',
        placeholder: 'reponse@votredomaine.fr',
      },
    ],
  },
};
