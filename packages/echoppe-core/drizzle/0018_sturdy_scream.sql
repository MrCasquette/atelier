-- ADR-0049 : `fields` est passé d'un dictionnaire à une SÉQUENCE [{ name, kind, … }].
-- Un tableau est ordonné par construction, donc `jsonb` le préserve — ce qui n'était pas vrai des
-- clés d'un objet, qu'il trie par longueur puis octet. Le `json` posé par #46 n'a plus d'objet.
--
-- AUCUNE conversion de données : le registre est un miroir des fichiers du dev, réécrit d'un bloc à
-- chaque `content push` (`delete` puis `insert`). Une installation déjà déployée doit REPOUSSER son
-- contenu après mise à jour — une déclaration restée au format objet sera refusée à la lecture.
ALTER TABLE "content_definition" ALTER COLUMN "fields" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "entity_definition" ALTER COLUMN "fields" SET DATA TYPE jsonb;