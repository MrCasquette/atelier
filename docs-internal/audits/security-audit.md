# Sécurité — Échoppe API

> **Constat à date (2026-07-14).** Ce document prouve de quoi on s'est inquiété, et quand. Il ne dit
> **pas** l'état courant, qui se redécouvre sur le code. Les risques encore ouverts sont suivis au
> [backlog Échoppe](../backlog/echoppe.md) § Sécurité et durcissement et au
> [backlog socle](../backlog/shared.md) § Sécurité ; ce qu'il a soulevé sans le trancher vit dans
> [sujets à discussion](../backlog/sujets-a-discussion.md). Les chemins cités sont ceux de 2026-07 :
> `apps/api` et `apps/admin` s'appellent depuis `apps/echoppe-api` et `apps/echoppe-admin`.

Audit de sécurité de l'API (Elysia) et des surfaces front (storefront) / admin.

## Verdict global

L'API est nettement au-dessus de la moyenne en maturité sécurité pour ce stade.
Modèle cohérent : RBAC centralisé dérivé d'une SSOT (`RESOURCE_LIST`), owner-bypass
explicite, clés machine hashées et non auto-escaladables, webhooks à signature vérifiée,
décrément de stock atomique + idempotent, anti-énumération sur le reset password, cookies
`httpOnly` / `sameSite=strict`, CSP stricte sur l'API.

Peu de trous béants — l'essentiel est du **durcissement** et quelques **fail-open**
dépendants du déploiement.

---

## Risques classés

### 🔴 Élevé — dépendants du déploiement

#### 1. Rate-limiting fail-open sans Redis
`apps/api/src/utils/rate-limit.ts:33`

Si `REDIS_URL` est absent, `increment()` retourne `count: 0` → **toutes les limites sont
silencieusement désactivées** (login, register, checkout, contact). Un déploiement sans
Redis expose le brute-force sur `/auth/login` et `/customer/auth/login` sans aucune
protection.

**Correctif** : logguer un warning bruyant au boot, idéalement refuser de démarrer en prod
sans backend de rate-limit.

#### 2. IP spoofable pour le rate-limit
`apps/api/src/utils/rate-limit.ts:80-88`

Le générateur d'IP fait confiance à `x-forwarded-for` / `x-real-ip` / `cf-connecting-ip`
sans notion de proxy de confiance. Si l'API est exposée directement (ou derrière un proxy
qui ne réécrit pas ces headers), un attaquant fait tourner `X-Forwarded-For` et **contourne
intégralement le rate-limit par IP**.

**Correctif** : n'accepter ces headers que depuis un reverse-proxy de confiance (liste d'IP
proxy, ou privilégier `server.requestIP()` — déjà tenté en premier, mais le fallback header
reste exploitable).

---

### 🟠 Moyen

#### 3. User-enumeration par timing sur le login
`apps/api/src/routes/auth.ts:83-95`, `apps/api/src/routes/customer-auth.ts:170-177`

Si l'email n'existe pas, on `return` avant `Bun.password.verify` : la réponse est bien plus
rapide qu'avec un email valide (bcrypt). Un attaquant distingue les emails existants au
chronomètre.

**Correctif** : verify factice sur un hash bidon quand l'utilisateur est introuvable.

**Note** : `/register` révèle aussi l'existence via `409`
(`apps/api/src/routes/customer-auth.ts:65`) — choix assumé, mais **incohérent** avec
l'effort anti-énumération fait sur `/password/forgot`.

#### 4. Upload média sans whitelist de type ni limite de taille
`apps/api/src/routes/media.ts:346-352`

`mimeType`, `file.name` et le contenu sont pris tels quels du client. Aucun contrôle
d'extension/MIME ni de taille → un compte `media:create` peut uploader du HTML/SVG (stocké
avec son MIME client-fourni, re-servi par `/assets` avec ce même MIME et **sans
`Content-Disposition: attachment`**).

Le XSS stocké est *aujourd'hui* atténué par la CSP globale `default-src 'none'` qui frappe
aussi `/assets`, mais c'est une atténuation indirecte et fragile.

**Correctif** : whitelist MIME/extension, cap de taille (anti-DoS disque), et
`Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` (déjà présent) sur
`/assets`.

#### 5. Tokens de session stockés en clair
`session.token` / `customerSession.token`

Les clés d'API (`apps/api/src/plugins/apiKey.ts:35`) et les tokens de reset
(`apps/api/src/routes/customer-auth.ts:29`) sont hashés en SHA-256, mais **les tokens de
session le sont en clair** en base. Une fuite de DB (backup, injection ailleurs) donne des
sessions directement rejouables. Incohérent avec le reste.

**Correctif** : hasher aussi les tokens de session.

---

### 🟡 Faible / hardening

- **Pas de `onError` global** (`apps/api/src/index.ts`) : un `throw` inattendu (ex.
  `apps/api/src/routes/payments.ts:634`) remonte via le handler Elysia par défaut, qui peut
  exposer le message d'erreur. Ajouter un `onError` renvoyant un message générique en prod
  et loguant le détail côté serveur.
- **Traversée de chemin à l'upload** (`apps/api/src/routes/media.ts:347-349`) : l'extension
  vient de `file.name` non nettoyé. Non exploitable en pratique (nom disque toujours préfixé
  par `randomUUID()` + `.`, donc pas de `..` en tête), mais sanitiser l'extension par
  principe.
- **Owner-bypass total** (`apps/api/src/plugins/rbac.ts:240`) : `isOwner` court-circuite
  toute vérif. Voulu, mais fait du compte owner une cible à protéger absolument (MFA à
  terme, rotation).
- **`lastUsedAt` en write à chaque appel de clé API** (`apps/api/src/plugins/apiKey.ts:95`) :
  amplification d'écriture, négligeable au volume machine mais à garder en tête.

---

## Côté front (storefront)

Peu exposé structurellement : l'auth repose sur cookies `httpOnly` + `sameSite=strict` +
CORS à origines explicites avec `credentials`. Le `sameSite=strict` couvre l'essentiel du
**CSRF** sans token dédié — solide, mais c'est *le seul* rempart CSRF : toute future route
sensible en `GET` mutant, ou un assouplissement en `sameSite=lax`, ouvrirait la porte. Les
données API doivent rester typées via Eden pour éviter l'injection de types non validés
côté client.

## Côté admin

Cumule les surfaces à privilèges : upload média (#4), owner-bypass (#5-faible), gestion des
clés API et des rôles. Risque principal : le **vol de session admin** — le check strict de
User-Agent (`apps/api/src/plugins/auth.ts:110`) aide mais reste contournable si l'attaquant
rejoue le même UA. Mitigations : hasher les tokens (#5) et, à terme, MFA sur les comptes
owner/admin.

---

## Priorités

Si l'on ne fait que 3 choses :

1. Sécuriser le fail-open rate-limit (#1) + IP de confiance (#2).
2. Fixer le timing login (#3).
3. Whitelist upload (#4).

---

## Points forts (à préserver)

- RBAC centralisé dérivé d'une SSOT (`RESOURCE_LIST`), guards par ressource/action.
- Clés d'API hashées, jamais scopables sur `api_key` (pas d'auto-escalade).
- Webhooks Stripe/PayPal à signature vérifiée, rejets sur header manquant.
- Décrément de stock atomique + idempotent (verrou `FOR UPDATE`, garde anti-survente).
- Anti-énumération sur `/password/forgot` (réponse 200 constante).
- Cookies `httpOnly`, `secure` en prod, `sameSite=strict`.
- CSP stricte (`default-src 'none'`) sur les routes API, permissive uniquement sur `/docs`.
- Reset password : token usage unique + révocation de toutes les sessions.
- Changement de mot de passe : révocation des autres sessions, garde la courante.
