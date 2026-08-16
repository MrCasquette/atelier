import type { EchoppeErrorResponse, EchoppeFault } from '@echoppe/core';

// Le corps qu'une route rend quand elle refuse (ADR-0050).
//
// Le STATUT reste écrit à la main par la route : `status(404, faultBody(faults.notFound('product')))`.
// Le déduire du code de faute serait plus court et coûterait le contrat — Elysia type la réponse sur
// le littéral, donc un statut calculé rendrait la map de réponses inexploitable et ferait disparaître
// le code de l'OpenAPI comme du client Eden. La faute dit de quoi il s'agit, la route dit comment ça
// se transporte : c'est la même séparation qu'entre le domaine et sa frontière.
//
// Le corps ne porte plus que la faute. `message` était rempli ici, à un seul endroit — ce qui a
// permis de le retirer d'un seul geste, les routes ne l'ayant jamais composé. Chaque surface tient
// désormais son catalogue (ADR-0050 §6), et le serveur n'écrit plus de français.

export function faultBody(fault: EchoppeFault): EchoppeErrorResponse {
  return { fault };
}
