# `@repo/communication` — l'envoi d'e-mails, ses providers et ses gabarits

Trois providers (Resend, Brevo, SMTP), un registre de gabarits, et les tables de configuration et de
journal.

## Frontière

**Aucun vocabulaire de produit.** `EmailTemplate` est un registre ouvert : le socle n'inscrit que les
gabarits qu'il possède réellement — réinitialisation de mot de passe et formulaire de contact.
Commande, expédition et bienvenue sont inscrits par Échoppe, dans son propre module.

Sa seule dépendance à une table métier est `site`, pour le nom et l'URL dans les pieds de page. Elle
sera remplacée par la surface de variables quand celle-ci existera
([ADR-0035](../../docs-internal/adr/ADR-0035-interpolation-variables.md)).

## L'injection : faite à un niveau, absente à l'autre

**Credentials → adapter : injectés.** Chaque adapter reçoit un `CommunicationCredentialStore`
(DIP) ; le registre l'adosse à la base avec déchiffrement, un test le stube. C'est ce qui rend un
adapter constructible sans base de données.

**Adapter → `sendEmail` : pas injecté.** `email.ts` appelle `getActiveCommunicationAdapter()`, importé
d'un singleton de module dont les fabriques sont câblées en dur. **Il n'existe aucune couture pour
substituer un adapter.**

⚠️ **Stuber les credentials n'empêche pas un envoi réel.** Ça supprime la dépendance à la base, pas
celle au réseau : un `ResendAdapter` muni de credentials valides appelle la véritable API. Les deux
préoccupations sont distinctes, et seule la première est traitée aujourd'hui.

Ce qui protège actuellement les tests, c'est que `isReady` exige `isConfigured && isEnabled` lus en
base et qu'aucun provider n'est configuré dans la base de test : `sendEmail` rend alors
`{ success: true, skipped: true }`. **C'est une propriété de la donnée, pas de l'architecture** — les
tests partagent un seul Postgres, et y configurer un provider suffirait à transformer chaque test
d'invitation en envoi réel.

Le traitement de fond est ouvert et non tranché : voir la section « Suivi » ci-dessous.

## Ce qui se teste aujourd'hui

`templates.ts` et le garde de type de `types.ts` — surface pure, sans effet externe. Le registre de
gabarits est un **état global préchargé par le module** : un test qui inscrit un gabarit doit lui
donner un nom qui lui est propre.

## Suivi

- **Aucune couture d'injection pour l'envoi.** L'option la plus propre est que le paquet cesse de
  posséder le singleton : une fabrique `createCommunicationRegistry(factories)` composée par le
  produit au démarrage, conforme au sens de la flèche d'ADR-0025 et à la forme « acteur ». Un simple
  garde `NODE_ENV` serait un test d'environnement placé dans du code de domaine, invisible au type,
  et ne protégerait que le chemin qui pense à le consulter.
- **Injection HTML dans `contact-form`.** Le gabarit interpole `name`, `email`, `phone`, `subject` et
  `message` bruts dans le HTML de l'e-mail, et ces valeurs viennent d'un formulaire **public**. À
  traiter avec le chantier sécurité.

## Dépendances

`@repo/adapters`, `@repo/db`, `@repo/identity`, `@repo/shared`, `drizzle-orm`, `nodemailer`.
