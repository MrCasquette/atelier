// Sert l'app PURE (`app.ts`) sur API_PORT, sans migrations/DB/bootstrap — uniquement pour
// régénérer et vérifier le contrat SDK hors-ligne (cf. `scripts/contracts.ts`). Aucune requête
// n'est exécutée (seul `/-/docs/json` est lu) → un `DATABASE_URL` placeholder suffit.
//
// Le défaut ne vise AUCUN rang de pile (ADR-0054) : sur un rang occupé, ce serveur mourrait en
// silence et le contrat se régénérerait depuis l'API d'à côté. `contracts.ts` passe de toute façon
// un port éphémère ; ce défaut ne sert qu'à un lancement manuel.
import { app } from '../app';

const port = Number(process.env.API_PORT ?? 8109);
app.listen({ port, hostname: '127.0.0.1' });
console.log(`[serve-contract] app pure sur :${port}`);
