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

    // Get or create owner role
    let [ownerRole] = await db.select().from(role).where(eq(role.name, 'Propriétaire'));

    if (!ownerRole) {
      [ownerRole] = await db
        .insert(role)
        .values({
          name: 'Propriétaire',
          description: 'Propriétaire de la boutique - accès total',
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
      role: ownerRole.id,
      isOwner: true,
      isActive: true,
    });

    console.log(`✅ Admin user created: ${adminEmail}`);
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
  }
}
