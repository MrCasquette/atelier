// Registre de cibles référençables (ADR-0032).
//
// Un lien — d'un item de menu, d'un champ `ref` d'une section — désigne une entité. Le socle
// connaissait ces entités en dur : `'url' | 'page' | 'product' | 'collection' | 'category'`,
// répétée à sept endroits, jusque dans le paquet publié. Le vocabulaire de l'e-commerce était
// écrit dans un socle que Prisme doit consommer.
//
// Ici, le socle ne sait plus qu'une chose : il existe des cibles, et voici comment les lister et
// les résoudre. Échoppe inscrit `product`, `collection`, `category`, `page` ; Prisme inscrira les
// siennes.
//
// **Opt-in, jamais opt-out.** Ce qui rend une entité référençable, ce n'est pas d'être déclarée,
// c'est d'avoir une URL. Une entité n'entre au registre que si elle dit comment elle produit un
// lien — le silence la rend invisible dans le sélecteur, sans avoir à la marquer négativement.
//
// Ce fichier ne connaît ni base, ni HTTP : il déclare le contrat, le produit l'implémente.

/** Ce qu'on rend d'une entité ciblée : de quoi l'afficher et construire son URL. */
export type EntityProjection = {
  id: string;
  slug: string;
  name: string;
};

/**
 * Comment une cible produit son lien. Les deux premiers modes ne sont pas réductibles l'un à
 * l'autre : un article EST une page, un lien de réseau social PORTE une URL.
 */
export type LinkMode =
  /** Route interne, avec `:slug` substitué à la résolution. Le cas courant. */
  | { mode: 'route'; route: string }
  /** L'entité contient l'URL dans un de ses champs — elle n'est pas une page. */
  | { mode: 'href'; field: string }
  /**
   * Ancre : l'entité n'a pas de route à elle, son lien se dérive de sa page parente
   * (`/a-propos#tarifs`). Seul mode asymétrique.
   */
  | { mode: 'anchor'; parent: string };

/**
 * Une cible référençable. `project` sert la résolution au read (un menu rendu au storefront),
 * `search` le sélecteur de l'administration — deux besoins réels, aucun réductible à l'autre :
 * l'un part d'identifiants connus, l'autre d'un terme saisi.
 */
export type ReferenceTarget = {
  /** Nom stable, celui que porte `MenuLink.target` et le `to` d'un champ `ref`. */
  name: string;
  /** Libellé affiché dans l'administration. */
  label: string;
  link: LinkMode;
  /** Projette des identifiants connus. L'ordre du retour n'a pas d'importance ; les absents (entité supprimée) sont simplement omis. */
  project(ids: string[]): Promise<EntityProjection[]>;
  /** Cherche par terme libre, borné par `limit`. Terme vide = les premières entités. */
  search(term: string, limit: number): Promise<EntityProjection[]>;
};

export interface ReferenceRegistry {
  register(target: ReferenceTarget): void;
  get(name: string): ReferenceTarget | undefined;
  /** Les cibles inscrites, dans l'ordre d'inscription — c'est celui du sélecteur. */
  list(): ReferenceTarget[];
  names(): string[];
  has(name: string): boolean;
}

export function createReferenceRegistry(): ReferenceRegistry {
  const targets = new Map<string, ReferenceTarget>();

  return {
    register(target) {
      if (targets.has(target.name)) {
        throw new Error(`Cible référençable déjà inscrite : ${target.name}`);
      }
      targets.set(target.name, target);
    },

    get(name) {
      return targets.get(name);
    },

    list() {
      return [...targets.values()];
    },

    names() {
      return [...targets.keys()];
    },

    has(name) {
      return targets.has(name);
    },
  };
}

/**
 * URL d'une entité projetée, selon le mode déclaré par sa cible. Rend `null` quand la déclaration
 * ne suffit pas à produire un lien — le mode `href` a besoin d'un champ de l'entité, le mode
 * `anchor` d'une page parente ; ni l'un ni l'autre ne se dérive d'une projection seule.
 *
 * **La déclaration fait foi** (ADR-0032) : rien ne garantit techniquement que la route déclarée
 * existe encore dans le front du dev. Un lien cassé est un 404, pas une corruption.
 */
export function linkUrl(target: ReferenceTarget, entity: EntityProjection): string | null {
  if (target.link.mode !== 'route') return null;
  return target.link.route.replace(':slug', entity.slug);
}
