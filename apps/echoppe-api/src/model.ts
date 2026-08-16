import { Elysia } from 'elysia';
import { errorResponseSchema } from './lib/fault-schema';
import { cartModels } from './modules/cart/model';
import { categoryModels } from './modules/catalog/category/model';
import { collectionModels } from './modules/catalog/collection/model';
import { catalogModels } from './modules/catalog/model';
import { checkoutModels } from './modules/checkout/model';
import { entityModels } from './modules/content/entity/model';
import { pageModels } from './modules/content/page/model';
import { countryModels } from './modules/country/model';
import { addressModels } from './modules/customer/address/model';
import { customerModels } from './modules/customer/model';
import { identityModels } from './modules/identity/model';
import { menuModels } from './modules/menu/model';
import { orderModels } from './modules/order/model';
import { taxRateModels } from './modules/tax-rate/model';
import { wishlistModels } from './modules/wishlist/model';

// Registre central des modèles nommés du contrat. Une seule source qui alimente :
// - la validation runtime (via `.model()`),
// - `components.schemas` de l'OpenAPI (→ types nommés côté @echoppe/client),
// - le type `ModelName` (union des noms enregistrés), utilisé pour typer strictement
//   les références de réponse (cf. lib/response `ResponseMap`).
//
// Les routes font `.use(models)` puis référencent un modèle par son nom
// (ex. `response: { 200: 'ProductDetail' }`).

export const allModels = {
  // Le contrat de faute (ADR-0050) est un modèle nommé : un `$ref` unique dans l'OpenAPI, donc un
  // type nommé côté @echoppe/client sur lequel un client headless fait son `switch`. Sans lui,
  // l'union des 41 ressources serait recopiée dans CHAQUE réponse d'erreur de chaque route migrée —
  // mesuré à ~1 600 lignes de contrat pour deux routes, contre ~1 600 lignes une fois pour toutes.
  ErrorResponse: errorResponseSchema,
  ...catalogModels,
  ...categoryModels,
  ...collectionModels,
  ...cartModels,
  ...taxRateModels,
  ...identityModels,
  ...countryModels,
  ...addressModels,
  ...customerModels,
  ...checkoutModels,
  ...orderModels,
  ...pageModels,
  ...entityModels,
  ...menuModels,
  ...wishlistModels,
};

/** Union des noms de modèles enregistrés — remplace un `string` permissif. */
export type ModelName = keyof typeof allModels;

export const models = new Elysia({ name: 'models' }).model(allModels);
