# ADR-0056 — Une racine de données, montée hors du répertoire applicatif

Statut : accepté · 2026-08-18
Portée : socle

> Amende [ADR-0018](./ADR-0018-stockage-media.md), qui décide *ce qui* est stocké sur disque sans
> dire *où* le montage vit.

## Contexte

L'image monte aujourd'hui son volume sur `/app/uploads`, et `UPLOAD_DIR` y pointe. Deux choses
gênent.

**`/app` appartient au binaire.** Il porte l'exécutable compilé, le dashboard et les migrations —
ce que l'image fabrique. Y monter ce que l'application *produit* mélange le code et les données, et
rend le point de sauvegarde moins évident pour qui exploite : rien ne distingue, dans l'arborescence,
ce qui se reconstruit d'un `docker pull` de ce qui ne se reconstruit jamais.

**Le point de montage est ce qui coûte le plus cher à changer.** La donnée y est attachée : le
déplacer après coup demande une migration manuelle chez chaque exploitant. Le renommage du dossier
de travail, le 2026-08-18, en a donné une démonstration — Compose a détaché une pile de ses volumes
sans rien dire, et seule la survivance des conteneurs a masqué la bascule.

Une seule nature de données existe aujourd'hui : les fichiers que la base référence. D'autres sont
plausibles — exports, sauvegardes, cache d'images redimensionnées (ADR-0021) — mais aucune n'est
décidée.

## Options envisagées

- **Un volume par nature** (`/uploads`, puis `/exports`…) — explicite, et permet des politiques de
  rétention distinctes. Mais fige aujourd'hui une liste de natures dont on n'en connaît qu'une, et
  chaque ajout ultérieur oblige **l'exploitant** à modifier son `compose.yaml` : un volume déclaré
  après coup ne récupère pas les données déjà écrites ailleurs.
- **Garder `/app/uploads`** — rien à faire, mais le mélange code/données demeure et le montage reste
  dans un répertoire que l'image possède.
- **Une racine de données unique, hors `/app`.**

## Décision

**Un volume, monté sur `/data`.** Les fichiers téléversés vivent dans `/data/uploads`, valeur par
défaut d'`UPLOAD_DIR`.

Le chemin reste configurable — `UPLOAD_DIR` continue de porter ce qui varie d'un déploiement à
l'autre, et un exploitant qui monte un stockage ailleurs le déclare comme avant. Ce qui change est
le **défaut** et, avec lui, la forme du montage.

Une nature de données ajoutée plus tard devient un sous-dossier de `/data`. Elle n'exige alors
**aucun changement chez l'exploitant** : pas de volume à déclarer, pas de migration. C'est
précisément ce qu'un volume par nature ne permet pas.

Hors conteneur, le défaut ne bouge pas : `apps/echoppe-api/uploads`. Une racine absolue n'aurait
aucun sens sur un poste de développement.

## Conséquences

- **Une pile déjà déployée déplace ses fichiers d'un cran, une fois.** Le volume était monté *sur*
  le dossier des uploads : ses fichiers sont à sa racine, et le remonter sur `/data` les laisse dans
  `/data/*` quand l'application les cherche dans `/data/uploads/*`. Rien n'est perdu ni bloqué, mais
  rien ne le signale non plus — d'où la commande, à passer avant de redémarrer :

  ```bash
  docker compose down
  docker run --rm -v <projet>_echoppe-uploads:/v alpine \
    sh -c 'mkdir -p /v/uploads && find /v -maxdepth 1 -type f -exec mv {} /v/uploads/ \;'
  docker compose up -d
  ```

  Aucune boutique publique n'est concernée — rien n'est déployé hors des piles locales. L'API ne le
  fait **pas** au démarrage, bien qu'elle migre son schéma au boot : ce déplacement servirait une
  seule fois, pour une seule pile, et resterait ensuite indéfiniment dans le chemin de démarrage. Une
  migration de schéma est journalisée, rejouable et versionnée ; un déplacement de fichiers au boot
  n'a aucune de ces propriétés et se revérifierait à chaque redémarrage.
- Le volume reste nommé `echoppe-uploads` : le renommer détacherait la donnée pour rien.
- Prisme héritera de la même topologie. Sa nature de données est la même — des fichiers que sa base
  référence — et la racine ne présume d'aucune spécificité produit.
- **La conservation des factures reste entière et n'est pas traitée ici.** Une facture est
  aujourd'hui un `media` comme un autre : même dossier, même route de suppression, `unlink` réel —
  alors qu'elle relève d'une obligation légale de conservation. Le volume n'est qu'une réponse
  possible parmi d'autres (service dédié, cloud ou auto-hébergé, paquet spécialisé). Sujet propre,
  ADR à venir, inscrit au backlog `echoppe.md`.
