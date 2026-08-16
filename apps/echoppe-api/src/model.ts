import { Elysia } from 'elysia';
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

// ADR-0050 voudrait que le contrat de faute soit ici, comme modèle nommé : il deviendrait un
// composant réutilisable de l'OpenAPI, donc un `$ref` unique au lieu de l'union recopiée dans chaque
// réponse. Il n'y est PAS, et pas par oubli — une union discriminée qui traverse `.model()` ressort
// avec `resource: never` côté inférence, et toute route qui la rend devient intypable. Le schéma
// reste donc inline (`lib/response.ts`), au prix d'un contrat verbeux, jusqu'au flip décrit là-bas.
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
  ...entityModels,
  ...menuModels,
  ...wishlistModels,
};

/** Union des noms de modèles enregistrés — remplace un `string` permissif. */
export type ModelName = keyof typeof allModels;

export const models = new Elysia({ name: 'models' }).model(allModels);
