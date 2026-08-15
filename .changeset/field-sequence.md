---
'@mrcasquette/content': major
---

Le schema est une séquence de champs, pas un dictionnaire.

**Ce qui change pour vous : rien dans vos fichiers.** On continue d'écrire un objet littéral, qui
est la bonne syntaxe pour déclarer :

```ts
defineSection('legal', {
  fields: { titre: f.text(), sousTitre: f.text(), corps: f.richText() },
});
```

C'est la **sérialisation** qui change : `fields` est désormais poussé comme un tableau ordonné
`[{ name: 'titre', kind: 'text' }, …]` au lieu d'un objet indexé par nom. Repoussez votre contenu
après mise à jour (`content push`) — une déclaration restée à l'ancien format sera refusée.

**Pourquoi.** L'ordre dans lequel vous déclarez vos champs est l'ordre du formulaire
d'administration, et celui des colonnes d'une entité. Or aucune construction à clés ne le garantit :
`jsonb` trie les clés d'un objet par longueur puis octet, si bien que `titre, sousTitre, corps`
ressortait `corps, titre, sousTitre`. Un tableau, lui, est ordonné par définition.

**Deux bornes nouvelles**, toutes deux refusées avec un message qui dit où corriger :

- **un nom de champ commence par une lettre.** `{ '2024': f.text() }` est déjà réordonné par
  JavaScript dans votre objet littéral — les clés qui ressemblent à un index de tableau sont
  énumérées en tête —, avant toute sérialisation. On ne peut donc pas tenir l'ordre pour ces
  noms-là : on les refuse plutôt que de le promettre.
- **deux champs ne peuvent pas porter le même nom.** Un objet l'interdisait gratuitement, un tableau
  l'admet. La vérification est explicite, sur les sections comme sur les entités.

Un répéteur imbriqué dans un répéteur reste déclarable et rendu — rien n'est retiré au langage.
