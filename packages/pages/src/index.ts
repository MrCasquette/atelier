// @repo/pages — les pages, leurs sections, et le registre des définitions qui dit comment une
// section est faite (ADR-0033).
//
// Ce paquet ne livre que des DÉFINITIONS de tables ; chaque cœur les inclut dans son barrel et donc
// dans ses migrations (ADR-0025). Il n'expose aucune route ni aucun plugin Elysia (ADR-0044).
export { type PageReferenceOptions, pageReferenceTarget } from './reference';
export { contentDefinition, contentStatusEnum, page, section } from './schema';
