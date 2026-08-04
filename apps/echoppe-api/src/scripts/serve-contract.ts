// Sert l'app PURE (`app.ts`) sur API_PORT (défaut 7533), sans migrations/DB/bootstrap — uniquement
// pour régénérer et vérifier le contrat SDK hors-ligne (cf. `scripts/contracts.ts`). Aucune requête
// n'est exécutée (seul `/docs/json` est lu) → un `DATABASE_URL` placeholder suffit.
import { app } from '../app';

const port = Number(process.env.API_PORT ?? 7533);
app.listen({ port, hostname: '127.0.0.1' });
console.log(`[serve-contract] app pure sur :${port}`);
