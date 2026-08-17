# ADR-0051 — Garde des credentials : choisir sur deux usages réels

Statut : proposé · 2026-08-17
Portée : auth

## Contexte

L'authentification administrative est déjà portée par `@repo/auth` pour Échoppe et doit aussi
servir Prisme. Échoppe possède en plus un cycle client distinct. Aujourd'hui, les mots de passe et
les sessions sont conservés en PostgreSQL selon l'[ADR-0008](./ADR-0008-auth-sessions.md).

Le chantier a d'abord été formulé comme une délégation à Supabase, par analogie avec Stripe. Cette
analogie éclaire l'objectif — ne pas garder une donnée sensible qu'un spécialiste protège mieux —
mais ne suffit pas à choisir une architecture : un fournisseur d'identité est payé par utilisateur
actif, intervient dans chaque connexion et impose au marchand une relation qu'il n'a pas l'habitude
d'entretenir. L'embarquer en auto-hébergement rend la facturation plus simple, mais remet sa base et
son exploitation sous la responsabilité du marchand.

Le RGPD n'impose ni fournisseur externe, ni base physique séparée. Il impose des mesures adaptées au
risque. PrestaShop, comparable européen autohébergé, conserve par défaut les empreintes des clients
et employés dans sa base applicative. L'externalisation réduit donc la garde et la surface
opérationnelle ; elle n'est pas une condition automatique de conformité.

Le dépôt pose par ailleurs qu'une abstraction nouvelle doit avoir deux usages réels. Prisme n'a pas
encore de parcours d'authentification implémenté : trancher maintenant figerait la frontière sur le
seul produit Échoppe.

### Quatre concepts aujourd'hui confondus par les noms

Le mot « identité » désigne plusieurs choses qui ne doivent pas partager une frontière par simple
homonymie :

1. **identité du site** — marque, contact public, entité légale et pays ; c'est le contenu actuel de
   `@repo/identity` ;
2. **identité humaine** — compte stable et rattachement d'une personne à ses profils métier ;
3. **authentification** — preuve de cette identité, credentials, sessions, récupération et MFA ;
4. **autorisation** — principaux, rôles, permissions, délégation et règles RBAC, actuellement mêlés
   à l'authentification administrative dans `@repo/auth`.

Le package `@repo/identity` actuel est correctement borné fonctionnellement, mais mal nommé dès
qu'une identité humaine entre dans le vocabulaire. Il doit être renommé ou déplacé vers un nom qui
exprime l'identité du site avant qu'un package consacré aux comptes humains puisse employer le
terme sans ambiguïté.

## Options envisagées

### Package local partagé

Un package dédié possède comptes d'authentification, empreintes, sessions, invitations,
récupération et éventuellement MFA. Il s'appuie sur des primitives cryptographiques éprouvées mais
la base de l'installation garde les credentials.

- Avantages : installation autonome, aucun compte fournisseur, coût inclus dans l'infrastructure,
  comportement entièrement testable et commun aux deux produits.
- Coûts : conception, audit, maintenance et mises à jour de sécurité à la charge du projet puis de
  l'exploitant ; responsabilité explicite sur les credentials.

Le découpage devra distinguer l'identité humaine, l'authentification et l'autorisation aujourd'hui
partiellement réunies dans `@repo/auth`. Les noms indicatifs `site-identity`, `accounts`,
`authentication` et `rbac` décrivent les frontières attendues mais ne sont pas décidés ici : le
graphe d'imports et les deux usages réels doivent fixer le nombre et le nom définitifs des packages.

### Fournisseur d'identité externe

Les administrations deviennent clientes d'un fournisseur OIDC tel qu'Authentik ; les rôles,
permissions et profils restent locaux. Échoppe peut appliquer une politique différente à ses
clients.

- Avantages : aucune garde locale des mots de passe concernés, MFA et politiques centralisés,
  compatibilité avec l'identité existante d'une organisation.
- Coûts : configuration et exploitation supplémentaires pour le marchand, disponibilité externe,
  rattachement et récupération des comptes, dépendance au cycle de vie du fournisseur.

Un fournisseur particulier, notamment Supabase, ne doit pas devenir le contrat interne par défaut.
OIDC est le candidat standard si cette option est retenue.

### Service d'identité inclus dans Échoppe Cloud

Une offre hébergée peut absorber le fournisseur et son coût dans son abonnement. Pour le marchand,
la garde est déléguée ; pour l'opérateur Échoppe Cloud, elle ne disparaît pas.

- Avantages : expérience sans configuration et exploitation spécialisée.
- Coûts : isolation entre boutiques, facturation, responsabilité de sous-traitant, réversibilité et
  rayon d'impact d'un service mutualisé.

Cette option dépend d'une offre qui n'existe pas encore et ne peut donc gouverner le socle actuel.

## Décision

**Aucun des trois modes n'est retenu avant l'implémentation de l'authentification commune à Prisme
et Échoppe.** Le choix se fait sur le premier chantier qui présente effectivement les deux usages,
pas par anticipation dans le seul code Échoppe.

À ce moment, la décision doit mesurer au minimum :

1. la garde effective des credentials et le rayon d'impact d'une compromission ;
2. la friction et le coût imposés au marchand ;
3. l'autonomie d'une installation autohébergée et la compatibilité avec une offre Cloud ;
4. les besoins distincts des administrateurs et des clients ;
5. le MFA, la récupération, la révocation et l'indisponibilité du système d'identité ;
6. la portabilité des comptes et le rattachement stable aux profils métier ;
7. les responsabilités RGPD et opérationnelles de chaque mode ;
8. les frontières de packages entre identité du site, identité humaine, authentification et RBAC.

La décision finale amende cet ADR et, si elle change le modèle de session, remplace ou amende
l'ADR-0008. Une combinaison de modes n'est admise que si chaque mode correspond à un usage réel ;
la polyvalence seule ne justifie pas plusieurs implémentations.

## Conséquences

- L'authentification locale actuelle reste en place tant que la décision n'est pas instruite.
- Les correctifs concrets déjà recensés — oracle d'énumération, rate limiting et hash des jetons de
  session — ne dépendent pas de cette décision et ne doivent pas l'attendre.
- Aucun adapter Supabase, OIDC ou Cloud n'est créé dans l'intervalle.
- Le futur chantier doit renommer ou déplacer `@repo/identity`, puis séparer explicitement identité
  humaine, authentification, profils métier et autorisation/RBAC ; il ne doit pas confondre
  utilisateur administratif et client Échoppe.
- Si le stockage local est retenu, la documentation doit rendre visibles les modalités de stockage,
  transmission, sauvegarde et mise à jour nécessaires à l'exploitant.
