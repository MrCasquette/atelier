import { describe, expect, it } from 'bun:test';
import { groupResources, resourceLabel, type ProtectableResource } from './types';

// Verrou du défaut de #38 : l'écran des rôles décidait de ce qui existe. Une ressource née après
// lui — `content`, `api_key`, `schema`, puis toute entité — restait muette, donc inaccordable
// autrement que par la base.
//
// Ces fonctions sont pures : elles ne disent plus CE QUI existe, seulement OÙ le poser.

// `actions` — ce que le demandeur peut accorder (#45) — n'entre pas dans le rangement : ces
// fonctions disent OÙ poser une ressource, jamais ce qu'on a le droit d'en faire.
const res = (name: string, label: string | null = null): ProtectableResource => ({
  name,
  label,
  actions: ['create', 'read', 'update', 'delete'],
});

describe('groupResources', () => {
  it('range chaque ressource connue dans son groupe', () => {
    const groups = groupResources([res('product'), res('order'), res('category')]);

    expect(groups.map((group) => group.name)).toEqual(['Catalogue', 'Commerce']);
    expect(groups[0].resources.map((r) => r.name)).toEqual(['product', 'category']);
  });

  it('ne rend AUCUN groupe vide : seuls ceux qui ont un membre sortent', () => {
    const groups = groupResources([res('media')]);

    expect(groups.map((group) => group.name)).toEqual(['Medias']);
  });

  it('rassemble les entités, quel que soit leur nom', () => {
    const groups = groupResources([res('entity:billet', 'Billet'), res('entity:auteur')]);

    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Entités');
    expect(groups[0].resources.map((r) => r.name)).toEqual(['entity:billet', 'entity:auteur']);
  });

  // LE point du correctif : rien ne se perd. Une ressource ajoutée au socle demain apparaît sans
  // qu'aucune ligne de cet écran ne change — visible, donc accordable.
  it('fait tomber dans « Autres » ce qu’il ne reconnaît pas, plutôt que de le taire', () => {
    const groups = groupResources([res('product'), res('ressource_inedite')]);

    const autres = groups.find((group) => group.name === 'Autres');
    expect(autres?.resources.map((r) => r.name)).toEqual(['ressource_inedite']);
  });

  it('pose « Autres » en dernier, après tous les groupes connus', () => {
    const groups = groupResources([res('inconnue'), res('product')]);

    expect(groups.map((group) => group.name)).toEqual(['Catalogue', 'Autres']);
  });

  it('ne perd jamais une ressource en chemin', () => {
    const all = [res('product'), res('schema'), res('entity:billet'), res('inconnue')];

    const kept = groupResources(all).flatMap((group) => group.resources);

    expect(kept).toHaveLength(all.length);
  });
});

describe('resourceLabel', () => {
  it("préfère le libellé du serveur : lui seul connaît celui d'une entité", () => {
    expect(resourceLabel(res('entity:billet', 'Billet de blog'))).toBe('Billet de blog');
  });

  it('traduit le vocabulaire du socle, que le serveur laisse nu', () => {
    expect(resourceLabel(res('product'))).toBe('Produits');
    expect(resourceLabel(res('schema'))).toBe('Structure du contenu');
  });

  it('affiche le nom brut plutôt que rien, faute de traduction', () => {
    expect(resourceLabel(res('ressource_inedite'))).toBe('ressource_inedite');
  });
});
