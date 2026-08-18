// Base des appels vers l'API — SEUL endroit du dashboard qui la calcule.
//
// Le dashboard n'apprend jamais l'adresse de l'API (ADR-0052) : il est servi PAR elle sous
// `/-/admin`, donc il la déduit de sa propre origine. Une base figée à la construction rendrait
// l'image publiée inutilisable partout ailleurs qu'à l'adresse compilée.
//
// En développement, Vite sert le dashboard sur son propre port et proxifie `/api` vers l'API
// (cf. `vite.config.ts`, qui retire le préfixe au passage). C'est le seul endroit où ce préfixe
// existe : en production, l'origine suffit.
export const API_BASE = `${window.location.origin}${import.meta.env.DEV ? '/api' : ''}`;
