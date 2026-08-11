import { db, eq } from '@echoppe/core';
import { role, user } from '@echoppe/core/db/schema';

export async function initAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return;
  }

  try {
    // Check if any user exists
    const [existingUser] = await db.select().from(user).limit(1);
    if (existingUser) {
      return;
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

    // Create admin user
    const passwordHash = await Bun.password.hash(adminPassword, {
      algorithm: 'argon2id',
      memoryCost: 19456,
      timeCost: 2,
    });

    await db.insert(user).values({
      email: adminEmail,
      passwordHash,
      firstName: 'Admin',
      lastName: 'Échoppe',
      role: administratorRole.id,
      isOwner: true,
      isActive: true,
    });

    console.log(`✅ Admin user created: ${adminEmail}`);
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
  }
}
