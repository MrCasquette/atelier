import { Elysia } from 'elysia';
import { addressModels } from './models/address';
import { cartModels } from './models/cart';
import { catalogModels } from './models/catalog';
import { categoryModels } from './models/category';
import { checkoutModels } from './models/checkout';
import { collectionModels } from './models/collection';
import { contentModels } from './models/content';
import { customerModels } from './models/customer';
import { identityModels } from './models/identity';
import { menuModels } from './models/menu';
import { orderModels } from './models/order';
import { wishlistModels } from './models/wishlist';
import { taxRateModels } from './modules/tax-rate/model';

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
  ...addressModels,
  ...customerModels,
  ...checkoutModels,
  ...orderModels,
  ...contentModels,
  ...menuModels,
  ...wishlistModels,
};

/** Union des noms de modèles enregistrés — remplace un `string` permissif. */
export type ModelName = keyof typeof allModels;

export const models = new Elysia({ name: 'models' }).model(allModels);
