# Interpolation de variables

Application d'[ADR-0035](../adr/ADR-0035-interpolation-variables.md), V1 humble.

Une mention légale cite la raison sociale et le SIREN. Sans mécanisme, l'utilisateur les recopie à la
main et elles se périment en silence.

## Le principe

Le stockage garde `{{ legal.name }}` **en clair**, jamais résolu à l'écriture. La substitution a lieu
**à la lecture**, côté API : le front reçoit du texte prêt à afficher et n'a rien à savoir.

C'est meilleur pour la souveraineté qu'une valeur figée — un outil externe lit une référence
explicite plutôt qu'un nom d'entreprise mort.

## Le jeu de variables

Déclaré et **fini**, dans `apps/echoppe-api/src/modules/content/interpolation.ts`. Le type union
`ContentVariable` en dérive : ajouter une entrée à `VARIABLE_SOURCES` suffit.

| Préfixe | Source | Exemples |
|---|---|---|
| `site.*` | `site` — la marque, le contact public, les mentions LCEN | `site.name`, `site.email`, `site.host` |
| `legal.*` | `legal_entity` — l'entité derrière le site | `legal.name`, `legal.siren`, `legal.city` |

**Pas de chemin libre vers la base.** `{{ user.passwordHash }}` ou `{{ settings.stripeSecret }}`
fuiterait dans du contenu public : ce qui n'est pas au jeu n'est pas résolu.

## Où ça s'applique

Les champs `text` et `richText` des **sections d'une page publiée**, en descendant dans les trois
formes composites — `component`, `list`, `repeater`. Le parcours suit **la déclaration**, jamais la
forme de la donnée : un slug, une URL ou un UUID de média ne sont donc jamais touchés.

Pas encore : les colonnes de la page elle-même (`title`, `seoTitle`, `seoDescription`) et les
occurrences d'entités. V1 humble.

## Les quatre règles

**Substituer, jamais évaluer — INVARIANT.** Aucune expression, condition, boucle ni appel de
fonction. C'est une interdiction, pas une orientation : la pente de tout gabarit mène à l'injection
côté serveur, où quiconque édite du contenu exécute du code. `interpolation.ts` ne doit jamais
gagner d'analyseur d'expression — s'il en gagne un, c'est que le besoin était ailleurs. Six cas de
test verrouillent ça, dont `{{ constructor.constructor("return 1")() }}`.

**Une seule passe.** `String.replace` ne re-balaie pas ce qu'il vient d'insérer : une valeur
contenant elle-même `{{ … }}` reste telle quelle, et la résolution ne peut pas boucler.

**Variable inconnue : le littéral reste.** Jamais vider — une mention légale avec un trou blanc passe
inaperçue, `{{ legal.siren }}` affiché tel quel se voit tout de suite. Une variable **au jeu mais non
renseignée** suit la même règle, pour la même raison.

**Échapper dans le Markdown, pas dans le texte.** Une raison sociale contenant `[` ne doit pas
fabriquer un lien dans un `richText` ([ADR-0030](../adr/ADR-0030-texte-riche-markdown.md)). Le jeu
échappé est restreint aux caractères spéciaux **où qu'ils soient** — `` \ ` * _ [ ] < > | `` — et
pas à `.` `-` `#`, qui ne le sont qu'en tête de ligne : les échapper partout rendrait
`bonjour@atelier\.test`.

## Cache

Aucun. Les valeurs sont relues à chaque lecture de page, donc un changement de raison sociale prend
effet immédiatement — la mise en garde d'ADR-0035 sur l'invalidation vise un cache de contenu qui
n'existe pas. Le jour où il existera, c'est cette lecture qu'il faudra invalider, pas le registre.
