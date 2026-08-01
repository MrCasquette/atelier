# ADR-0021 — Stratégie images : pas de resize serveur, dimensions exposées

Statut : accepté
Portée : socle

## Contexte

Un storefront a besoin d'images optimisées : miniatures, `srcset` responsive, formats modernes
(AVIF/WebP), et surtout un rendu **sans CLS** (Cumulative Layout Shift) — ce qui suppose de connaître
le ratio de chaque image avant chargement. La question posée (ex-« B5 : resize `/assets/{id}?width=` »)
n'est pas *composant `<Image>` vs resize* — un composant `<Image>` est le **consommateur** d'un moteur
de transformation, pas son alternative. La vraie question : **où vit le moteur ?**

## Options envisagées

- **Resize dans l'API métier** — Sharp + `/assets/{id}?width=` + cache disque dans Elysia. Clé en
  main, mais : dépendance native lourde dans l'image Docker, CPU de traitement d'image sur l'API
  métier, **surface DoS** (tailles arbitraires → allowlist obligatoire), cache à opérer/invalider.
  Mélange media-processing et métier.
- **Runtime storefront / BFF** — `astro:assets` sur l'adapter Bun (topologie B, cf. ADR front) :
  optimise les assets distants à l'exécution, négocie AVIF/WebP, génère `srcset`. C'est le rôle du
  BFF.
- **Proxy dédié / CDN** — imgproxy en sidecar ou Cloudflare Images devant les assets. API pure, mais
  service supplémentaire à opérer.

## Décision

**Le framework n'optimise pas les images.** Il sert l'original (`GET /assets/{id}`) et **expose les
dimensions intrinsèques** (px) du média partout où une image apparaît dans le contrat storefront, via
une **référence image unique** `imageRef = { id, width, height }` (`imageRefSchema`) : `featuredImage`,
galerie `images[]`, image de variante (`variantDetail.featuredImage`), pastille couleur
(`swatch.image`). L'admin (`ProductMedia`) conserve l'UUID nu (pas de besoin storefront).

La transformation (resize, `srcset`, formats) est une **préoccupation de présentation**, déléguée à la
**boutique réelle** : elle construit son propre composant `<Image>` (façon `next/image`) à partir de
l'URL + dimensions, adossé au BFF (`astro:assets`) en simple, ou à un CDN/imgproxy via un « loader »
configurable en prod. Le `apps/store` du repo est un **template d'exemple minimal** : il consomme
seulement `imageRef.id` (→ `mediaUrl`) et ne porte pas de composant image sophistiqué.

## Conséquences

- **API métier reste pure** : pas de Sharp, pas de cache image, pas de surface DoS de resize. Cohérent
  avec la séparation media-processing ≠ métier (cf. audit SOLID).
- **Contrat** : les références image portent `width`/`height` (nullable si inconnu). Rupture assumée
  **pré-1.0** (SDK co-versionné) : UUID nu → objet. `enrichProductCards` et le détail chargent les
  dimensions en une requête batchée (`loadMediaDimensions`, pas de N+1).
- **Anti-CLS gratuit** : dimensions déjà en base (`media.width/height`) → ~80 % du bénéfice d'un
  `next/image` pour zéro traitement d'image serveur.
- **Porte de sortie prod** : brancher un CDN/imgproxy = configurer le loader du composant `<Image>`
  côté boutique, **sans toucher le framework**.
- Verrou : `image-dimensions.test.ts` (carte + détail exposent `{id,width,height}`).
