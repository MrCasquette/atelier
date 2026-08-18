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

## L'injection, jusqu'au bout

**Credentials → adapter.** Chaque adapter reçoit un `CommunicationCredentialStore` (DIP) ; le
registre l'adosse à la base avec déchiffrement, un test le stube. C'est ce qui rend un adapter
constructible sans base de données.

**Adapter → envoi.** L'envoi est un **acteur** : `CommunicationService`, construit avec ses
dépendances par le produit à son démarrage. Il n'y a pas d'instance de module — le paquet expose de
quoi composer, jamais un objet déjà composé.

```ts
new CommunicationService({
  registry: createCommunicationRegistry(),   // ou des fabriques à soi
  isReady: createDbProviderReadiness(),      // configuré ET activé, d'après la base
  siteIdentity,                              // le produit sait où lire son identité
  journal: createDbJournal(),                // la table `communication_log`
});
```

Les quatre dépendances ont la même nature : le paquet fournit l'implémentation réelle, le produit la
branche, un test la remplace.

Le service leur passe **ce qu'il connaît**, jamais ce qu'elles attendent : le journal reçoit une
`SendAttempt` — le provider, le message tel qu'il est parti, la réponse — et dérive lui-même sa
ligne. C'est `EmailStatus` qui a tranché : il compte trois valeurs dont une, `bounced`, ne peut pas
venir d'un envoi mais d'un webhook. Un envoi qui composait ce statut tenait une responsabilité qui
n'était pas la sienne. C'est aussi ce qui a permis de retirer `@repo/identity` des
dépendances de ce paquet — il ne lit plus la table `site` lui-même.

### Ce que ça a corrigé

`sendEmail` résolvait son adapter par un singleton aux fabriques câblées en dur, et importait
directement `db` pour lire `site` et écrire dans `communication_log`. Aucune couture : stuber les
credentials supprimait la dépendance à la base, **pas celle au réseau** — un `ResendAdapter` muni de
credentials valides appelait la véritable API.

Ce qui protégeait les tests était qu'aucun provider n'est configuré dans la base de test. Une
propriété de la **donnée**, pas de l'architecture : les tests partagent un seul Postgres, et y
configurer un provider aurait transformé chaque test d'invitation en envoi réel.

## Ce qui se teste

Le **chemin d'envoi complet** — `service.test.ts` : choix du provider dans l'ordre déclaré,
enrichissement par l'identité du site, consignation du succès comme de l'échec, et le cas « aucun
provider » qui rend `skipped` sans consigner. Sans base, sans réseau.

`templates.ts` et le garde de type de `types.ts` restent testés comme surface pure. Le registre de
gabarits est un **état global préchargé par le module** : un test qui inscrit un gabarit doit lui
donner un nom qui lui est propre.

## Suivi

- **Injection HTML dans `contact-form`.** Le gabarit interpole `name`, `email`, `phone`, `subject` et
  `message` bruts dans le HTML de l'e-mail, et ces valeurs viennent d'un formulaire **public**. À
  traiter avec le chantier sécurité.

## Dépendances

`@repo/adapters`, `@repo/db`, `@repo/identity`, `@repo/shared`, `drizzle-orm`, `nodemailer`.
