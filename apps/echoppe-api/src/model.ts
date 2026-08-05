import { Elysia } from 'elysia';
import { addressModels } from './models/address';
import { cartModels } from './models/cart';
import { checkoutModels } from './models/checkout';
import { customerModels } from './models/customer';
import { orderModels } from './models/order';
import { categoryModels } from './modules/catalog/category/model';
import { collectionModels } from './modules/catalog/collection/model';
import { catalogModels } from './modules/catalog/model';
import { pageModels } from './modules/content/page/model';
import { countryModels } from './modules/country/model';
import { identityModels } from './modules/identity/model';
import { menuModels } from './modules/menu/model';
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
  ...menuModels,
  ...wishlistModels,
};

/** Union des noms de modèles enregistrés — remplace un `string` permissif. */
export type ModelName = keyof typeof allModels;

export const models = new Elysia({ name: 'models' }).model(allModels);
