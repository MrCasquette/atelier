import { stdin, stdout } from 'node:process';
import { db, eq } from '@repo/db';
import { role, user } from '@repo/auth';

// Commande serveur d'AMORÇAGE du propriétaire (ADR-0057) — accès DB direct, sans HTTP ni cookie.
// Elle remplace les variables ADMIN_EMAIL/ADMIN_PASSWORD, qui faisaient vivre le secret du compte
// le plus puissant du système en clair dans un fichier de configuration :
//
//   docker compose exec -it api ./api admin:create
//   bun run --cwd apps/echoppe-api admin:create
//
// INTERACTIF SEUL, délibérément : pas de `--password`, pas de lecture sur stdin. Un mode non
// interactif est le chemin par lequel un mot de passe revient dans un fichier, un historique de
// shell ou une définition de tâche.
//
// Elle amorce, elle n'administre pas : dès qu'un utilisateur existe, elle refuse et renvoie vers
// l'invitation (ADR-0048), où le créateur ne connaît jamais le mot de passe.

const MIN_PASSWORD_LENGTH = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ENTER = ['\r', '\n'];
const INTERRUPT = '\u0003';
const BACKSPACE = ['\u007f', '\b'];

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/**
 * Ce qu'un `chunk` portait au-delà du retour ligne. Le mode brut ne découpe pas les lignes : un
 * collage arrive d'un bloc, et sans report la saisie suivante perdrait son début.
 */
let pending = '';

/**
 * Lit une ligne au terminal. `hidden` n'écrit aucun écho — un mot de passe ne doit apparaître ni à
 * l'écran, ni dans le défilement d'un terminal resté ouvert.
 */
function ask(prompt: string, hidden = false): Promise<string> {
  if (!stdin.isTTY) {
    fail('Cette commande demande un terminal — avec Docker, pensez à `exec -it`.');
  }

  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  return new Promise((resolve, reject) => {
    let buffer = '';

    function cleanup(): void {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
    }

    /** Rend `true` quand la ligne est complète ; le reste du chunk part dans `pending`. */
    function feed(chunk: string): boolean {
      for (let index = 0; index < chunk.length; index++) {
        const char = chunk.charAt(index);

        if (ENTER.includes(char)) {
          // Un terminal envoie `\r`, un pseudo-terminal `\n`, certains les deux : la paire compte
          // pour une seule fin de ligne.
          const next = chunk[index + 1];
          const skip = next && next !== char && ENTER.includes(next) ? 2 : 1;
          pending = chunk.slice(index + skip);
          return true;
        }
        if (char === INTERRUPT) {
          cleanup();
          reject(new Error('Interrompu.'));
          return false;
        }
        if (BACKSPACE.includes(char)) {
          if (buffer.length === 0) continue;
          buffer = buffer.slice(0, -1);
          if (!hidden) stdout.write('\b \b');
          continue;
        }
        if (char < ' ') continue;
        buffer += char;
        if (!hidden) stdout.write(char);
      }
      return false;
    }

    function onData(chunk: string): void {
      if (feed(chunk)) {
        cleanup();
        resolve(buffer);
      }
    }

    const carried = pending;
    pending = '';
    if (carried && feed(carried)) {
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      resolve(buffer);
      return;
    }

    stdin.on('data', onData);
  });
}

const [existingUser] = await db.select({ email: user.email }).from(user).limit(1);
if (existingUser) {
  fail(
    `Un compte existe déjà (${existingUser.email}). Les suivants se créent par invitation, depuis l'administration.`,
  );
}

console.log("Amorçage du propriétaire de l'installation.\n");

const email = (await ask('  E-mail       : ')).trim().toLowerCase();
if (!EMAIL_PATTERN.test(email)) {
  fail('Adresse e-mail invalide.');
}

const password = await ask('  Mot de passe : ', true);
if (password.length < MIN_PASSWORD_LENGTH) {
  fail(`Mot de passe trop court (${MIN_PASSWORD_LENGTH} caractères au minimum).`);
}

const confirmation = await ask('  Confirmation : ', true);
if (confirmation !== password) {
  fail('Les deux saisies diffèrent.');
}

// Le premier compte porte le rôle `admin` et le drapeau : il n'y a pas de rôle « propriétaire »
// (ADR-0047). Ce qui fait le propriétaire est `isOwner`, et rien d'autre.
let [administratorRole] = await db.select().from(role).where(eq(role.key, 'admin'));

if (!administratorRole) {
  [administratorRole] = await db
    .insert(role)
    .values({
      key: 'admin',
      name: 'Administrateur',
      description: 'Administrateur — tout, hors gouvernance sensible',
      scope: 'admin',
      isSystem: true,
    })
    .returning();
}

const passwordHash = await Bun.password.hash(password, {
  algorithm: 'argon2id',
  memoryCost: 19456,
  timeCost: 2,
});

await db.insert(user).values({
  email,
  passwordHash,
  firstName: 'Admin',
  lastName: 'Échoppe',
  role: administratorRole.id,
  isOwner: true,
  isActive: true,
});

console.log(`\n✓ Propriétaire « ${email} » créé.`);
console.log("  Connectez-vous à /-/admin, puis invitez les comptes suivants depuis l'administration.");
process.exit(0);
