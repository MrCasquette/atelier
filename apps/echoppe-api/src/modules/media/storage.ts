import { join } from 'node:path';

// Emplacement des fichiers téléversés. `UPLOAD_DIR` porte ce qui varie d'un déploiement à l'autre ;
// ce qui reste en code est le défaut de développement, calculé RELATIVEMENT à ce fichier — d'où les
// trois remontées : `src/modules/media/` → `apps/echoppe-api/uploads` (ADR-0042 §5).
export const UPLOAD_DIR = process.env.UPLOAD_DIR || join(import.meta.dir, '../../../uploads');
