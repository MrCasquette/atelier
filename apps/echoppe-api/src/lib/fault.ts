import type { EchoppeErrorResponse, EchoppeFault } from '@echoppe/core';
import { faultMessage } from './fault-message';

// Le corps qu'une route rend quand elle refuse (ADR-0050).
//
// Le STATUT reste écrit à la main par la route : `status(404, faultBody(faults.notFound('product')))`.
// Le déduire du code de faute serait plus court et coûterait le contrat — Elysia type la réponse sur
// le littéral, donc un statut calculé rendrait la map de réponses inexploitable et ferait disparaître
// le code de l'OpenAPI comme du client Eden. La faute dit de quoi il s'agit, la route dit comment ça
// se transporte : c'est la même séparation qu'entre le domaine et sa frontière.
//
// `message` est rempli ici, à un seul endroit, et c'est ce qui permettra de le retirer d'un seul
// geste : les routes ne le composent jamais.

export function faultBody(fault: EchoppeFault): EchoppeErrorResponse {
  return { fault, message: faultMessage(fault) };
}
