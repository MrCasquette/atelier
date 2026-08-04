import { Elysia } from 'elysia';
import { addressModels } from './address';
import { cartModels } from './cart';
import { catalogModels } from './catalog';
import { categoryModels } from './category';
import { checkoutModels } from './checkout';
import { collectionModels } from './collection';
import { companyModels } from './company';
import { contentModels } from './content';
import { customerModels } from './customer';
import { menuModels } from './menu';
import { orderModels } from './order';
import { taxRateModels } from './tax-rate';
import { wishlistModels } from './wishlist';

// Registre central des modèles nommés du contrat. Une seule source qui alimente :
// - la validation runtime (via `.model()`),
// - `components.schemas` de l'OpenAPI (→ types nommés côté @echoppe/client),
// - le type `ModelName` (union des noms enregistrés), utilisé pour typer strictement
//   les références de réponse (cf. utils/responses `ResponseMap`).
//
// Les routes font `.use(models)` puis référencent un modèle par son nom
// (ex. `response: { 200: 'ProductDetail' }`).

export const allModels = {
  ...catalogModels,
  ...categoryModels,
  ...collectionModels,
  ...cartModels,
  ...taxRateModels,
  ...companyModels,
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
