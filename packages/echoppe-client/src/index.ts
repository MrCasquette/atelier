export type { EchoppeClient, EchoppeClientOptions } from './client.js';
export { createEchoppeClient } from './client.js';
// Alias plats des schémas (générés) : import type { ProductDetail } from '@echoppe/client'
export type * from './models.js';
export type { components, operations, paths } from './openapi.js';
