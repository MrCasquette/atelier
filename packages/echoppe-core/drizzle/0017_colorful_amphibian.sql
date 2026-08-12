-- #46 : l'ordre des champs déclarés ne survivait pas au stockage. `jsonb` normalise les clés — par
-- longueur puis octet —, donc `{ titre, corps }` ressortait `{ corps, titre }` et le formulaire
-- généré affichait les champs dans le désordre. `json` garde le texte source tel quel.
--
-- Aucune perte de données : la conversion est un simple changement de représentation.
--
-- En revanche elle ne RÉPARE pas les lignes existantes — elles sont déjà normalisées, et leur ordre
-- d'origine n'est plus quelque part à retrouver. Elles reprennent leur ordre déclaré au prochain
-- `content push`, qui remplace le registre de toute façon.
ALTER TABLE "content_definition" ALTER COLUMN "fields" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "entity_definition" ALTER COLUMN "fields" SET DATA TYPE json;