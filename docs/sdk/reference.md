---
aside: false
pageClass: api-reference
---

<!-- Généré par docs/scripts/gen-sdk-reference.ts — NE PAS ÉDITER À LA MAIN. -->

# Référence des modèles

Forme de chaque schéma exposé par le SDK (surface boutique), rendue depuis le contrat
figé `@axiome-apps/echoppe-client`. Les modèles sont **regroupés par namespace** de la façade
(`echoppe.<namespace>.<méthode>()`). Chaque modèle liste ses propriétés (type, description,
objets imbriqués dépliables) avec un exemple d’appel et un exemple de réponse.

## `products`

### ProductDetail

<ApiBlock>

<template #doc>

<ModelDoc name="ProductDetail" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.products.bySlug({
  params: { path: { slug: 'mon-slug' } },
});
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/products/by-slug/mon-slug', {
  method: 'GET',
  credentials: 'include',
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="ProductDetail" />

</template>

</ApiBlock>

### ProductList

<ApiBlock>

<template #doc>

<ModelDoc name="ProductList" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.products.list({
  params: { query: { page: 1, limit: 20, search: "string", category: "3fa85f64-5717-4562-b3fc-2c963f66afa6", minPrice: 0, maxPrice: 0, inStock: true, sort: "price", order: "asc" } },
});
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/products/?page=1&limit=20&search=string&category=3fa85f64-5717-4562-b3fc-2c963f66afa6&minPrice=0&maxPrice=0&inStock=true&sort=price&order=asc', {
  method: 'GET',
  credentials: 'include',
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="ProductList" />

</template>

</ApiBlock>

### ProductWithVariants

<ApiBlock>

<template #doc>

<ModelDoc name="ProductWithVariants" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.products.get({
  params: { path: { id: '3fa85f64-…' } },
});
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/products/3fa85f64-…', {
  method: 'GET',
  credentials: 'include',
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="ProductWithVariants" />

</template>

</ApiBlock>

## `categories`

### Category

<ApiBlock>

<template #doc>

<ModelDoc name="Category" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.categories.get({
  params: { path: { id: '3fa85f64-…' } },
});
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/categories/3fa85f64-…', {
  method: 'GET',
  credentials: 'include',
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="Category" />

</template>

</ApiBlock>

### CategoryList

<ApiBlock>

<template #doc>

<ModelDoc name="CategoryList" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.categories.list();
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/categories/', {
  method: 'GET',
  credentials: 'include',
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="CategoryList" />

</template>

</ApiBlock>

## `collections`

### Collection

<ApiBlock>

<template #doc>

<ModelDoc name="Collection" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.collections.get({
  params: { path: { id: '3fa85f64-…' } },
});
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/collections/3fa85f64-…', {
  method: 'GET',
  credentials: 'include',
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="Collection" />

</template>

</ApiBlock>

### CollectionList

<ApiBlock>

<template #doc>

<ModelDoc name="CollectionList" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.collections.list({
  params: { query: { page: 1, limit: 20 } },
});
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/collections/?page=1&limit=20', {
  method: 'GET',
  credentials: 'include',
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="CollectionList" />

</template>

</ApiBlock>

## `cart`

### Cart

<ApiBlock>

<template #doc>

<ModelDoc name="Cart" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.cart.get();
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/cart/', {
  method: 'GET',
  credentials: 'include',
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="Cart" />

</template>

</ApiBlock>

### CartMerge

<ApiBlock>

<template #doc>

<ModelDoc name="CartMerge" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.cart.merge();
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/cart/merge', {
  method: 'POST',
  credentials: 'include',
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="CartMerge" />

</template>

</ApiBlock>

## `checkout`

### CheckoutResult

<ApiBlock>

<template #doc>

<ModelDoc name="CheckoutResult" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.checkout.create({
  body: {
    "shippingAddress": {
      "firstName": "string",
      "lastName": "string",
      "company": "string",
      "street": "string",
      "street2": "string",
      "postalCode": "string",
      "city": "string",
      "countryCode": "string",
      "phone": "string"
    },
    "billingAddress": {
      "firstName": "string",
      "lastName": "string",
      "company": "string",
      "street": "string",
      "street2": "string",
      "postalCode": "string",
      "city": "string",
      "countryCode": "string",
      "phone": "string"
    },
    "useSameAddress": true,
    "customerNote": "string",
    "paymentProvider": "stripe",
    "successUrl": "string",
    "cancelUrl": "string"
  },
});
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/checkout/', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    "shippingAddress": {
      "firstName": "string",
      "lastName": "string",
      "company": "string",
      "street": "string",
      "street2": "string",
      "postalCode": "string",
      "city": "string",
      "countryCode": "string",
      "phone": "string"
    },
    "billingAddress": {
      "firstName": "string",
      "lastName": "string",
      "company": "string",
      "street": "string",
      "street2": "string",
      "postalCode": "string",
      "city": "string",
      "countryCode": "string",
      "phone": "string"
    },
    "useSameAddress": true,
    "customerNote": "string",
    "paymentProvider": "stripe",
    "successUrl": "string",
    "cancelUrl": "string"
  }),
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="CheckoutResult" />

</template>

</ApiBlock>

### PaymentProviderList

<ApiBlock>

<template #doc>

<ModelDoc name="PaymentProviderList" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.checkout.paymentProviders();
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/checkout/payment-providers', {
  method: 'GET',
  credentials: 'include',
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="PaymentProviderList" />

</template>

</ApiBlock>

## `taxRates`

### TaxRateList

<ApiBlock>

<template #doc>

<ModelDoc name="TaxRateList" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.taxRates.list();
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/tax-rates/', {
  method: 'GET',
  credentials: 'include',
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="TaxRateList" />

</template>

</ApiBlock>

## `auth`

### CustomerAuth

<ApiBlock>

<template #doc>

<ModelDoc name="CustomerAuth" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.auth.me();
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/customer/auth/me', {
  method: 'GET',
  credentials: 'include',
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="CustomerAuth" />

</template>

</ApiBlock>

### LoginResult

<ApiBlock>

<template #doc>

<ModelDoc name="LoginResult" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.auth.login({
  body: {
    "email": "client@exemple.fr",
    "password": "string"
  },
});
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/customer/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    "email": "client@exemple.fr",
    "password": "string"
  }),
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="LoginResult" />

</template>

</ApiBlock>

## `addresses`

### Address

<ApiBlock>

<template #doc>

<ModelDoc name="Address" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.addresses.get({
  params: { path: { id: '3fa85f64-…' } },
});
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/customer/addresses/3fa85f64-…', {
  method: 'GET',
  credentials: 'include',
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="Address" />

</template>

</ApiBlock>

### AddressList

<ApiBlock>

<template #doc>

<ModelDoc name="AddressList" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.addresses.list();
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/customer/addresses/', {
  method: 'GET',
  credentials: 'include',
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="AddressList" />

</template>

</ApiBlock>

## `orders`

### Order

<ApiBlock>

<template #doc>

<ModelDoc name="Order" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.orders.get({
  params: { path: { id: '3fa85f64-…' } },
});
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/customer/orders/3fa85f64-…', {
  method: 'GET',
  credentials: 'include',
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="Order" />

</template>

</ApiBlock>

### OrderList

<ApiBlock>

<template #doc>

<ModelDoc name="OrderList" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.orders.list({
  params: { query: { page: 1, limit: 20 } },
});
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/customer/orders/?page=1&limit=20', {
  method: 'GET',
  credentials: 'include',
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="OrderList" />

</template>

</ApiBlock>

## `pages`

### Page

<ApiBlock>

<template #doc>

<ModelDoc name="Page" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.pages.bySlug({
  params: { path: { slug: 'mon-slug' } },
});
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/pages/by-slug/mon-slug', {
  method: 'GET',
  credentials: 'include',
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="Page" />

</template>

</ApiBlock>

### PageList

<ApiBlock>

<template #doc>

<ModelDoc name="PageList" />

</template>

<template #code>

**Exemple d’appel**

::: code-group

```ts [SDK]
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const echoppe = createEchoppeClient({ baseUrl: 'https://api.maboutique.fr' });

const { data, error } = await echoppe.pages.list();
```

```js [REST]
const res = await fetch('https://api.maboutique.fr/pages/', {
  method: 'GET',
  credentials: 'include',
});
const data = await res.json();
```

:::

**Exemple de réponse**

<ResponseSample name="PageList" />

</template>

</ApiBlock>
