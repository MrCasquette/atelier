// Base des appels vers l'API — SEUL endroit du dashboard qui la calcule.
//
// Le dashboard n'apprend jamais l'adresse de l'API (ADR-0052) : il est servi PAR elle sous
// `/-/admin`, donc il déduit sa base de sa propre origine. C'est ce qui supprime le `VITE_API_URL`
// compilé dans le bundle, qui rendait l'image publiée inutilisable ailleurs que sur localhost.
//
// En développement, Vite sert le dashboard sur son propre port et proxifie `/api` vers l'API
// (cf. `vite.config.ts`, qui retire le préfixe au passage). C'est le seul endroit où ce préfixe
// existe : en production, l'origine suffit.
export const API_BASE = `${window.location.origin}${import.meta.env.DEV ? '/api' : ''}`;
