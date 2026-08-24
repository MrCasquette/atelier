import { t } from 'elysia';

// Surface de LECTURE des entités (ADR-0027, amendement du 2026-08-10).
//
// `data` n'est pas typé finement, et ce n'est pas un renoncement : la forme d'une entité dépend de
// l'INSTALLATION. La typer dans l'OpenAPI rendrait le contrat dépendant du déploiement — deux
// boutiques n'exposeraient plus la même chose, `@axiome-apps/echoppe-client` ne serait plus générable depuis un
// contrat unique, et le drift guard routes↔SDK perdrait son objet. C'est ce qui a fait retenir une
// route générique plutôt que des routes dérivées du registre.
//
// Le typage fin vient du type-gen depuis les fichiers du dev (`InferEntity`, @axiome-apps/atelier-content),
// où il est exact. Le dev a déjà sa déclaration ; l'API n'a pas à la lui renvoyer.

const entityMeta = t.Object({
  total: t.Number(),
  page: t.Number(),
  limit: t.Number(),
  totalPages: t.Number(),
  hasNextPage: t.Boolean(),
  hasPrevPage: t.Boolean(),
});

export const entityModels = {
  /**
   * Résultat d'une lecture d'entité.
   *
   * - entité de liste → `data` est un tableau d'occurrences, `meta` est présent ;
   * - singleton → `data` est l'occurrence ou **`null`**, `meta` est absent.
   *
   * `data: null` dit « déclaré, pas encore renseigné » — un état normal, une tâche à faire. Une
   * entité NON DÉCLARÉE rend un 404 : c'est une erreur de code. Les confondre obligerait le front
   * à deviner laquelle des deux il a sous les yeux, et il ne peut pas (ADR-0039).
   */
  EntityResult: t.Object(
    {
      data: t.Unknown(),
      meta: t.Optional(entityMeta),
    },
    { description: "Occurrences d'une entité déclarée. La forme de `data` suit sa cardinalité." },
  ),
};
