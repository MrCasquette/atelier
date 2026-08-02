import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from './index';
import {
  type ColorMetadata,
  category,
  company,
  country,
  customer,
  folder,
  media,
  option,
  optionValue,
  order,
  orderItem,
  payment,
  permission,
  product,
  productMedia,
  productOption,
  role,
  shipment,
  shippingCountry,
  shippingProvider,
  stockMove,
  taxRate,
  user,
  variant,
  variantOptionValue,
} from './schema';

const UPLOAD_DIR = join(import.meta.dir, '../../../../apps/api/uploads');

// Download placeholder image from Picsum
async function downloadPlaceholder(
  width: number,
  height: number,
  seed: string,
): Promise<{ buffer: Buffer; size: number }> {
  const url = `https://picsum.photos/seed/${seed}/${width}/${height}`;
  const response = await fetch(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, size: buffer.length };
}

// Create a media record with downloaded image
async function createMedia(
  seed: string,
  title: string,
  width = 800,
  height = 800,
  folderId: string | null = null,
): Promise<string | null> {
  try {
    const { buffer, size } = await downloadPlaceholder(width, height, seed);
    const filenameDisk = `${randomUUID()}.jpg`;
    const filePath = join(UPLOAD_DIR, filenameDisk);
    await Bun.write(filePath, buffer);

    const [mediaRecord] = await db
      .insert(media)
      .values({
        folder: folderId,
        filenameDisk,
        filenameOriginal: `${seed}.jpg`,
        title,
        mimeType: 'image/jpeg',
        size,
        width,
        height,
      })
      .returning();

    return mediaRecord?.id ?? null;
  } catch {
    console.log(`    ⚠ Failed to download image: ${seed}`);
    return null;
  }
}

async function seed() {
  console.log('🌱 Seeding database...');

  // Ensure uploads directory exists
  await mkdir(UPLOAD_DIR, { recursive: true });

  // === MEDIA FOLDER ===
  console.log('  → Media folders...');
  let productsFolderId: string | null = null;

  const [existingProductsFolder] = await db
    .select()
    .from(folder)
    .where(eq(folder.name, 'Produits'));

  if (existingProductsFolder) {
    productsFolderId = existingProductsFolder.id;
    console.log('    ⊘ Folder "Produits" already exists');
  } else {
    const [createdFolder] = await db.insert(folder).values({ name: 'Produits' }).returning();
    productsFolderId = createdFolder.id;
    console.log('    ✓ Folder "Produits" created');
  }

  // === COUNTRIES ===
  console.log('  → Countries...');
  const countries = await db
    .insert(country)
    .values([
      { name: 'France', code: 'FR' },
      { name: 'Belgique', code: 'BE' },
      { name: 'Suisse', code: 'CH' },
      { name: 'Luxembourg', code: 'LU' },
      { name: 'Monaco', code: 'MC' },
      { name: 'Allemagne', code: 'DE' },
      { name: 'Espagne', code: 'ES' },
      { name: 'Italie', code: 'IT' },
      { name: 'Royaume-Uni', code: 'GB' },
    ])
    .onConflictDoNothing()
    .returning();
  console.log(`    ✓ ${countries.length} countries`);

  // Pays livrables — table-ensemble, la présence vaut activation (ADR-0034).
  const SHIPPING_CODES = ['FR', 'BE', 'CH', 'LU', 'MC'];
  const shippingRows = countries
    .filter((c) => SHIPPING_CODES.includes(c.code))
    .map((c) => ({ country: c.id }));
  if (shippingRows.length > 0) {
    await db.insert(shippingCountry).values(shippingRows).onConflictDoNothing();
    console.log(`    ✓ ${shippingRows.length} shipping countries`);
  }

  // === COMPANY (Shop Settings) ===
  console.log('  → Company settings...');
  const [france] = await db.select().from(country).where(eq(country.code, 'FR'));

  if (france) {
    const [existingCompany] = await db.select().from(company).limit(1);
    if (!existingCompany) {
      // Create logo media
      const logoId = await createMedia('shop-logo', 'Logo boutique', 200, 200);

      await db.insert(company).values({
        shopName: 'Ma Boutique Artisanale',
        logo: logoId,
        publicEmail: 'contact@maboutique.fr',
        publicPhone: '01 23 45 67 89',
        legalName: 'Ma Boutique Artisanale SASU',
        legalForm: 'SASU',
        siren: '123456789',
        siret: '12345678900001',
        tvaIntra: 'FR12345678901',
        rcsCity: 'Paris',
        shareCapital: '1000.00',
        street: '123 Rue de la Création',
        postalCode: '75001',
        city: 'Paris',
        country: france.id,
        publisherName: 'Marie Artisan',
        hostingProvider: 'OVH SAS',
        hostingAddress: '2 rue Kellermann, 59100 Roubaix, France',
        hostingPhone: '1007',
      });
      console.log('    ✓ Company settings created');
    } else {
      console.log('    ⊘ Company settings already exist');
    }
  }

  // === TAX RATES ===
  console.log('  → Tax rates...');
  const taxRates = await db
    .insert(taxRate)
    .values([
      { name: 'TVA 20%', rate: '20.00', isDefault: true, mention: null },
      { name: 'TVA 10%', rate: '10.00', isDefault: false, mention: null },
      { name: 'TVA 5.5%', rate: '5.50', isDefault: false, mention: null },
      { name: 'TVA 2.1%', rate: '2.10', isDefault: false, mention: null },
      {
        name: 'Franchise en base',
        rate: '0.00',
        isDefault: false,
        mention: 'TVA non applicable, art. 293 B du CGI',
      },
    ])
    .onConflictDoNothing()
    .returning();
  console.log(`    ✓ ${taxRates.length} tax rates`);

  // === ROLES ===
  console.log('  → Roles...');
  const defaultRoles = [
    {
      name: 'Propriétaire',
      description: 'Propriétaire de la boutique - accès total',
      scope: 'admin' as const,
      isSystem: true,
    },
    {
      name: 'Administrateur',
      description: 'Administrateur - accès complet sauf rôles/permissions',
      scope: 'admin' as const,
      isSystem: true,
    },
    {
      name: 'Client',
      description: 'Client authentifié - accès à ses propres données',
      scope: 'store' as const,
      isSystem: true,
    },
    {
      name: 'Public',
      description: 'Accès public non authentifié - lecture seule catalogue',
      scope: 'store' as const,
      isSystem: true,
    },
  ];

  // Insérer seulement les rôles qui n'existent pas déjà
  const existingRoles = await db.select({ name: role.name }).from(role);
  const existingNames = new Set(existingRoles.map((r) => r.name));
  const rolesToInsert = defaultRoles.filter((r) => !existingNames.has(r.name));

  if (rolesToInsert.length > 0) {
    await db.insert(role).values(rolesToInsert);
  }
  console.log(`    ✓ ${rolesToInsert.length} roles`);

  // === PERMISSIONS ===
  console.log('  → Permissions...');

  // Récupérer tous les rôles (y compris ceux déjà existants)
  const allRoles = await db.select().from(role);
  const roleByName = new Map(allRoles.map((r) => [r.name, r.id]));

  // Helper pour créer des permissions
  type PermDef = {
    resource: string;
    canCreate?: boolean;
    canRead?: boolean;
    canUpdate?: boolean;
    canDelete?: boolean;
    selfOnly?: boolean;
    locked?: boolean; // Si true, permission non modifiable par le propriétaire
  };

  async function setPermissions(roleName: string, perms: PermDef[]) {
    const roleId = roleByName.get(roleName);
    if (!roleId) return;

    for (const p of perms) {
      await db
        .insert(permission)
        .values({
          role: roleId,
          resource: p.resource,
          canCreate: p.canCreate ?? false,
          canRead: p.canRead ?? false,
          canUpdate: p.canUpdate ?? false,
          canDelete: p.canDelete ?? false,
          selfOnly: p.selfOnly ?? false,
          locked: p.locked ?? false,
        })
        .onConflictDoUpdate({
          target: [permission.role, permission.resource],
          set: {
            canCreate: p.canCreate ?? false,
            canRead: p.canRead ?? false,
            canUpdate: p.canUpdate ?? false,
            canDelete: p.canDelete ?? false,
            selfOnly: p.selfOnly ?? false,
            locked: p.locked ?? false,
          },
        });
    }
  }

  // =============================================
  // PROPRIÉTAIRE
  // =============================================
  // - Tables système (natif Échoppe): lecture/update, pas de delete, LOCKED
  // - Tables compliance (RGPD): pas de delete
  // - Tables business: CRUD normal, modifiable
  await setPermissions('Propriétaire', [
    // --- Tables système (LOCKED) ---
    { resource: 'company', canRead: true, canUpdate: true, locked: true }, // Config boutique unique
    { resource: 'country', canRead: true, locked: true }, // Référentiel fixe
    { resource: 'tax_rate', canRead: true, canUpdate: true, locked: true }, // Taux légaux
    { resource: 'payment_config', canRead: true, canUpdate: true, locked: true }, // Credentials paiement
    { resource: 'shipping_provider', canRead: true, canUpdate: true, locked: true }, // Config transporteurs
    { resource: 'communication_config', canRead: true, canUpdate: true, locked: true }, // Credentials email
    { resource: 'role', canRead: true, locked: true }, // Rôles système
    { resource: 'permission', canRead: true, locked: true }, // Permissions système
    { resource: 'audit_log', canRead: true, locked: true }, // Journal non modifiable
    { resource: 'api_key', canCreate: true, canRead: true, canUpdate: true, canDelete: true }, // Clés machine

    // --- Tables compliance (pas de delete) ---
    { resource: 'order', canCreate: true, canRead: true, canUpdate: true }, // Historique obligatoire
    { resource: 'invoice', canCreate: true, canRead: true }, // Documents comptables
    { resource: 'user', canCreate: true, canRead: true, canUpdate: true }, // Traçabilité
    { resource: 'customer', canCreate: true, canRead: true, canUpdate: true }, // RGPD (anonymisation)

    // --- Tables business (CRUD, modifiable) ---
    { resource: 'product', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'category', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'collection', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'variant', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'option', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'media', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'stock', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'address', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'cart', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'wishlist', canRead: true },
    { resource: 'content', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
  ]);

  // =============================================
  // ADMINISTRATEUR
  // =============================================
  // - Pas d'accès aux credentials (payment, communication)
  // - Pas de gestion des users
  // - Gestion catalogue, commandes, clients
  await setPermissions('Administrateur', [
    // --- Tables système (lecture seule ou aucun accès) ---
    { resource: 'company', canRead: true, locked: true },
    { resource: 'country', canRead: true, locked: true },
    { resource: 'tax_rate', canRead: true, locked: true },
    { resource: 'shipping_provider', canRead: true, locked: true },
    { resource: 'role', canRead: true, locked: true },
    { resource: 'permission', canRead: true, locked: true },
    { resource: 'audit_log', canRead: true, locked: true },
    // payment_config: aucun accès
    // communication_config: aucun accès

    // --- Tables compliance (pas de delete) ---
    { resource: 'order', canCreate: true, canRead: true, canUpdate: true },
    { resource: 'invoice', canCreate: true, canRead: true },
    { resource: 'customer', canCreate: true, canRead: true, canUpdate: true },
    // user: aucun accès

    // --- Tables business ---
    { resource: 'product', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'category', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'collection', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'variant', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'option', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'media', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'stock', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    { resource: 'address', canCreate: true, canRead: true, canUpdate: true },
    { resource: 'cart', canRead: true },
    { resource: 'content', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
    // Clés d'API : chaque admin gère UNIQUEMENT les siennes (selfOnly). L'Owner voit tout (bypass).
    {
      resource: 'api_key',
      canCreate: true,
      canRead: true,
      canUpdate: true,
      canDelete: true,
      selfOnly: true,
    },
  ]);

  // =============================================
  // CLIENT
  // =============================================
  // Ses propres données uniquement (selfOnly)
  await setPermissions('Client', [
    { resource: 'product', canRead: true, locked: true },
    { resource: 'category', canRead: true, locked: true },
    { resource: 'collection', canRead: true, locked: true },
    { resource: 'variant', canRead: true, locked: true },
    { resource: 'option', canRead: true, locked: true },
    { resource: 'tax_rate', canRead: true, locked: true },
    { resource: 'country', canRead: true, locked: true },
    { resource: 'company', canRead: true, locked: true }, // Pour afficher infos boutique
    { resource: 'order', canRead: true, selfOnly: true, locked: true },
    {
      resource: 'address',
      canCreate: true,
      canRead: true,
      canUpdate: true,
      canDelete: true,
      selfOnly: true,
      locked: true,
    },
    {
      resource: 'cart',
      canCreate: true,
      canRead: true,
      canUpdate: true,
      canDelete: true,
      selfOnly: true,
      locked: true,
    },
    {
      resource: 'wishlist',
      canCreate: true,
      canRead: true,
      canUpdate: true,
      canDelete: true,
      selfOnly: true,
      locked: true,
    },
    { resource: 'invoice', canRead: true, selfOnly: true, locked: true },
  ]);

  // =============================================
  // PUBLIC
  // =============================================
  // Lecture seule catalogue (non authentifié)
  await setPermissions('Public', [
    { resource: 'product', canRead: true, locked: true },
    { resource: 'category', canRead: true, locked: true },
    { resource: 'collection', canRead: true, locked: true },
    { resource: 'variant', canRead: true, locked: true },
    { resource: 'option', canRead: true, locked: true },
    { resource: 'tax_rate', canRead: true, locked: true },
    { resource: 'country', canRead: true, locked: true },
    { resource: 'company', canRead: true, locked: true }, // Pour afficher infos boutique
  ]);

  console.log('    ✓ Permissions created');

  // === CATEGORIES ===
  console.log('  → Categories...');
  const categories = await db
    .insert(category)
    .values([
      { name: 'Bijoux', slug: 'bijoux', description: 'Bijoux artisanaux faits main', sortOrder: 0 },
      {
        name: 'Poterie',
        slug: 'poterie',
        description: 'Céramiques et poteries artisanales',
        sortOrder: 1,
      },
      {
        name: 'Textile',
        slug: 'textile',
        description: 'Créations textiles et tissages',
        sortOrder: 2,
      },
      {
        name: 'Décoration',
        slug: 'decoration',
        description: 'Objets de décoration uniques',
        sortOrder: 3,
      },
      {
        name: 'Papeterie',
        slug: 'papeterie',
        description: 'Carnets, cartes et papeterie artisanale',
        sortOrder: 4,
      },
    ])
    .onConflictDoNothing()
    .returning();
  console.log(`    ✓ ${categories.length} categories`);

  // === GET REFERENCES ===
  const [defaultTax] = await db.select().from(taxRate).where(eq(taxRate.isDefault, true));
  const [bijouxCat] = await db.select().from(category).where(eq(category.slug, 'bijoux'));
  const [poterieCat] = await db.select().from(category).where(eq(category.slug, 'poterie'));
  const [textileCat] = await db.select().from(category).where(eq(category.slug, 'textile'));
  const [decoCat] = await db.select().from(category).where(eq(category.slug, 'decoration'));

  if (!defaultTax || !bijouxCat || !poterieCat || !textileCat || !decoCat) {
    console.log('    ⊘ Skipped products (missing tax rate or categories)');
    return;
  }

  // === PRODUCTS ===
  console.log('  → Products...');
  const productsData = [
    {
      name: "Boucles d'oreilles Lune",
      slug: 'boucles-oreilles-lune',
      description:
        "Élégantes boucles d'oreilles en forme de croissant de lune, façonnées à la main en laiton doré. Chaque paire est unique, légèrement martelée pour un effet texturé subtil.",
      category: bijouxCat.id,
      taxRate: defaultTax.id,
      status: 'published' as const,
    },
    {
      name: 'Collier Perles de Verre',
      slug: 'collier-perles-verre',
      description:
        'Collier artisanal composé de perles de verre soufflé aux reflets irisés. Fermoir en argent 925. Longueur ajustable.',
      category: bijouxCat.id,
      taxRate: defaultTax.id,
      status: 'published' as const,
    },
    {
      name: 'Bracelet Tressé Cuir',
      slug: 'bracelet-tresse-cuir',
      description:
        'Bracelet en cuir végétal tressé à la main, fermoir magnétique en acier inoxydable. Disponible en plusieurs couleurs.',
      category: bijouxCat.id,
      taxRate: defaultTax.id,
      status: 'published' as const,
    },
    {
      name: 'Bol en Grès Émaillé',
      slug: 'bol-gres-emaille',
      description:
        'Bol en grès tourné à la main, émaillage bleu océan unique. Passe au lave-vaisselle et au micro-ondes. Parfait pour le petit-déjeuner ou les soupes.',
      category: poterieCat.id,
      taxRate: defaultTax.id,
      status: 'published' as const,
    },
    {
      name: 'Vase Terre Cuite',
      slug: 'vase-terre-cuite',
      description:
        'Vase en terre cuite brute, finition mate naturelle. Idéal pour fleurs séchées ou en pièce décorative seule.',
      category: poterieCat.id,
      taxRate: defaultTax.id,
      status: 'published' as const,
    },
    {
      name: 'Mug Céramique Artisanal',
      slug: 'mug-ceramique-artisanal',
      description:
        'Mug en céramique tournée main, anse ergonomique. Émaillage intérieur alimentaire, extérieur texturé. Contenance 30cl.',
      category: poterieCat.id,
      taxRate: defaultTax.id,
      status: 'published' as const,
    },
    {
      name: 'Écharpe Lin Naturel',
      slug: 'echarpe-lin-naturel',
      description:
        'Écharpe tissée main en lin français, légère et respirante. Idéale pour toutes les saisons.',
      category: textileCat.id,
      taxRate: defaultTax.id,
      status: 'published' as const,
    },
    {
      name: 'Coussin Brodé Main',
      slug: 'coussin-brode-main',
      description:
        'Coussin en coton bio avec broderie florale traditionnelle. Housse déhoussable, garnissage inclus.',
      category: textileCat.id,
      taxRate: defaultTax.id,
      status: 'published' as const,
    },
    {
      name: 'Bougie Parfumée Artisanale',
      slug: 'bougie-parfumee-artisanale',
      description:
        'Bougie coulée à la main en cire de soja, mèche coton. Parfums naturels aux huiles essentielles. Durée de combustion ~45h.',
      category: decoCat.id,
      taxRate: defaultTax.id,
      status: 'published' as const,
    },
    {
      name: 'Miroir Rotin Tressé',
      slug: 'miroir-rotin-tresse',
      description:
        'Miroir rond encadré de rotin naturel tressé à la main. Diamètre total 45cm. Fixation murale incluse.',
      category: decoCat.id,
      taxRate: defaultTax.id,
      status: 'draft' as const,
    },
  ];

  const products = await db.insert(product).values(productsData).onConflictDoNothing().returning();
  console.log(`    ✓ ${products.length} products`);

  // Map products by slug for easy access
  const productMap = new Map(products.map((p) => [p.slug, p]));

  // === GLOBAL OPTIONS ===
  console.log('  → Global options...');

  // Créer les options globales
  const globalOptionsData = [
    { name: 'Couleur', type: 'color' as const, sortOrder: 0 },
    { name: 'Taille', type: 'string' as const, sortOrder: 1 },
    { name: 'Longueur', type: 'string' as const, sortOrder: 2 },
    { name: 'Motif', type: 'string' as const, sortOrder: 3 },
    { name: 'Parfum', type: 'string' as const, sortOrder: 4 },
  ];

  const globalOptions = await db
    .insert(option)
    .values(globalOptionsData)
    .onConflictDoNothing()
    .returning();
  console.log(`    ✓ ${globalOptions.length} global options`);

  // Map option name -> option id
  const optionByName = new Map<string, string>();
  for (const opt of globalOptions) {
    optionByName.set(opt.name, opt.id);
  }
  // Si options existaient déjà, les récupérer
  if (optionByName.size === 0) {
    const existingOptions = await db.select().from(option);
    for (const opt of existingOptions) {
      optionByName.set(opt.name, opt.id);
    }
  }

  // === OPTION VALUES ===
  console.log('  → Option values...');

  // Une valeur d'option : chaîne simple (axe texte) ou { value, metadata } (axe couleur → oklch).
  type SeedValue = string | { value: string; metadata: ColorMetadata };
  const color = (l: number, c: number, h: number): ColorMetadata => ({ l, c, h, alpha: 1 });

  const optionValuesData: { optionName: string; values: SeedValue[] }[] = [
    {
      optionName: 'Couleur',
      values: [
        { value: 'Or', metadata: color(0.8, 0.13, 90) },
        { value: 'Argent', metadata: color(0.8, 0.005, 250) },
        { value: 'Or Rose', metadata: color(0.8, 0.06, 40) },
        { value: 'Naturel', metadata: color(0.85, 0.03, 80) },
        { value: 'Noir', metadata: color(0.2, 0.0, 0) },
        { value: 'Marron', metadata: color(0.45, 0.08, 50) },
        { value: 'Bleu Océan', metadata: color(0.6, 0.12, 230) },
        { value: 'Vert Sauge', metadata: color(0.75, 0.05, 150) },
        { value: 'Terracotta', metadata: color(0.62, 0.12, 40) },
        { value: 'Blanc', metadata: color(0.98, 0.0, 0) },
        { value: 'Gris', metadata: color(0.7, 0.0, 0) },
        { value: 'Beige', metadata: color(0.88, 0.03, 85) },
        { value: 'Écru', metadata: color(0.92, 0.02, 95) },
        { value: 'Gris Chiné', metadata: color(0.72, 0.01, 250) },
        { value: 'Bleu Indigo', metadata: color(0.45, 0.11, 275) },
      ],
    },
    { optionName: 'Taille', values: ['S', 'M', 'L', 'Petit', 'Moyen', 'Grand'] },
    { optionName: 'Longueur', values: ['40cm', '45cm', '50cm'] },
    { optionName: 'Motif', values: ['Floral', 'Géométrique', 'Feuillage'] },
    { optionName: 'Parfum', values: ['Lavande', 'Cèdre', "Fleur d'Oranger", 'Vanille'] },
  ];

  // Map: optionName -> (valueName -> valueId)
  const valueMap = new Map<string, Map<string, string>>();
  let valueCount = 0;

  for (const ov of optionValuesData) {
    const optId = optionByName.get(ov.optionName);
    if (!optId) continue;

    const valMap = new Map<string, string>();
    for (let i = 0; i < ov.values.length; i++) {
      const entry = ov.values[i];
      const value = typeof entry === 'string' ? entry : entry.value;
      const metadata = typeof entry === 'string' ? null : entry.metadata;
      const [val] = await db
        .insert(optionValue)
        .values({ option: optId, value, metadata, sortOrder: i })
        .onConflictDoNothing()
        .returning();
      if (val) {
        valMap.set(value, val.id);
        valueCount++;
      }
    }
    valueMap.set(ov.optionName, valMap);
  }
  // Si valeurs existaient déjà, les récupérer
  const existingValues = await db.select().from(optionValue);
  for (const val of existingValues) {
    const optName = [...optionByName.entries()].find(([_, id]) => id === val.option)?.[0];
    if (optName) {
      if (!valueMap.has(optName)) valueMap.set(optName, new Map());
      valueMap.get(optName)?.set(val.value, val.id);
    }
  }
  console.log(`    ✓ ${valueCount} option values`);

  // === PRODUCT-OPTION LINKS ===
  console.log('  → Product-option links...');

  const productOptionsToCreate = [
    { productSlug: 'boucles-oreilles-lune', optionName: 'Couleur' },
    { productSlug: 'collier-perles-verre', optionName: 'Longueur' },
    { productSlug: 'bracelet-tresse-cuir', optionName: 'Couleur' },
    { productSlug: 'bracelet-tresse-cuir', optionName: 'Taille' },
    { productSlug: 'bol-gres-emaille', optionName: 'Taille' },
    { productSlug: 'bol-gres-emaille', optionName: 'Couleur' },
    { productSlug: 'mug-ceramique-artisanal', optionName: 'Couleur' },
    { productSlug: 'echarpe-lin-naturel', optionName: 'Couleur' },
    { productSlug: 'coussin-brode-main', optionName: 'Motif' },
    { productSlug: 'bougie-parfumee-artisanale', optionName: 'Parfum' },
  ];

  let linkCount = 0;
  for (const po of productOptionsToCreate) {
    const prod = productMap.get(po.productSlug);
    const optId = optionByName.get(po.optionName);
    if (!prod || !optId) continue;

    await db
      .insert(productOption)
      .values({ product: prod.id, option: optId, sortOrder: linkCount })
      .onConflictDoNothing();
    linkCount++;
  }
  console.log(`    ✓ ${linkCount} product-option links`);

  // === VARIANTS ===
  console.log('  → Variants...');

  type VariantDef = {
    productSlug: string;
    sku: string;
    price: string;
    comparePrice?: string;
    quantity: number;
    isDefault: boolean;
    options?: { name: string; value: string }[];
  };

  const variantsToCreate: VariantDef[] = [
    // Boucles d'oreilles - 3 couleurs
    {
      productSlug: 'boucles-oreilles-lune',
      sku: 'BOUCLE-LUNE-OR',
      price: '35.00',
      quantity: 12,
      isDefault: true,
      options: [{ name: 'Couleur', value: 'Or' }],
    },
    {
      productSlug: 'boucles-oreilles-lune',
      sku: 'BOUCLE-LUNE-ARG',
      price: '32.00',
      quantity: 8,
      isDefault: false,
      options: [{ name: 'Couleur', value: 'Argent' }],
    },
    {
      productSlug: 'boucles-oreilles-lune',
      sku: 'BOUCLE-LUNE-ROSE',
      price: '38.00',
      quantity: 5,
      isDefault: false,
      options: [{ name: 'Couleur', value: 'Or Rose' }],
    },

    // Collier - 3 longueurs
    {
      productSlug: 'collier-perles-verre',
      sku: 'COLLIER-40',
      price: '65.00',
      quantity: 5,
      isDefault: false,
      options: [{ name: 'Longueur', value: '40cm' }],
    },
    {
      productSlug: 'collier-perles-verre',
      sku: 'COLLIER-45',
      price: '68.00',
      quantity: 8,
      isDefault: true,
      options: [{ name: 'Longueur', value: '45cm' }],
    },
    {
      productSlug: 'collier-perles-verre',
      sku: 'COLLIER-50',
      price: '72.00',
      quantity: 3,
      isDefault: false,
      options: [{ name: 'Longueur', value: '50cm' }],
    },

    // Bracelet - combinaisons couleur/taille
    {
      productSlug: 'bracelet-tresse-cuir',
      sku: 'BRAC-NAT-M',
      price: '28.00',
      quantity: 15,
      isDefault: true,
      options: [
        { name: 'Couleur', value: 'Naturel' },
        { name: 'Taille', value: 'M' },
      ],
    },
    {
      productSlug: 'bracelet-tresse-cuir',
      sku: 'BRAC-NOIR-M',
      price: '28.00',
      quantity: 12,
      isDefault: false,
      options: [
        { name: 'Couleur', value: 'Noir' },
        { name: 'Taille', value: 'M' },
      ],
    },
    {
      productSlug: 'bracelet-tresse-cuir',
      sku: 'BRAC-MARR-M',
      price: '28.00',
      quantity: 10,
      isDefault: false,
      options: [
        { name: 'Couleur', value: 'Marron' },
        { name: 'Taille', value: 'M' },
      ],
    },
    {
      productSlug: 'bracelet-tresse-cuir',
      sku: 'BRAC-NAT-S',
      price: '26.00',
      quantity: 8,
      isDefault: false,
      options: [
        { name: 'Couleur', value: 'Naturel' },
        { name: 'Taille', value: 'S' },
      ],
    },
    {
      productSlug: 'bracelet-tresse-cuir',
      sku: 'BRAC-NAT-L',
      price: '30.00',
      quantity: 6,
      isDefault: false,
      options: [
        { name: 'Couleur', value: 'Naturel' },
        { name: 'Taille', value: 'L' },
      ],
    },

    // Bol - tailles et couleurs
    {
      productSlug: 'bol-gres-emaille',
      sku: 'BOL-BLEU-S',
      price: '24.00',
      quantity: 20,
      isDefault: false,
      options: [
        { name: 'Taille', value: 'Petit' },
        { name: 'Couleur', value: 'Bleu Océan' },
      ],
    },
    {
      productSlug: 'bol-gres-emaille',
      sku: 'BOL-BLEU-M',
      price: '32.00',
      quantity: 15,
      isDefault: true,
      options: [
        { name: 'Taille', value: 'Moyen' },
        { name: 'Couleur', value: 'Bleu Océan' },
      ],
    },
    {
      productSlug: 'bol-gres-emaille',
      sku: 'BOL-BLEU-L',
      price: '42.00',
      quantity: 8,
      isDefault: false,
      options: [
        { name: 'Taille', value: 'Grand' },
        { name: 'Couleur', value: 'Bleu Océan' },
      ],
    },
    {
      productSlug: 'bol-gres-emaille',
      sku: 'BOL-VERT-M',
      price: '32.00',
      quantity: 12,
      isDefault: false,
      options: [
        { name: 'Taille', value: 'Moyen' },
        { name: 'Couleur', value: 'Vert Sauge' },
      ],
    },
    {
      productSlug: 'bol-gres-emaille',
      sku: 'BOL-TERRA-M',
      price: '32.00',
      quantity: 10,
      isDefault: false,
      options: [
        { name: 'Taille', value: 'Moyen' },
        { name: 'Couleur', value: 'Terracotta' },
      ],
    },

    // Vase - variante unique
    {
      productSlug: 'vase-terre-cuite',
      sku: 'VASE-TC-01',
      price: '42.00',
      quantity: 8,
      isDefault: true,
    },

    // Mug - 3 couleurs
    {
      productSlug: 'mug-ceramique-artisanal',
      sku: 'MUG-BLANC',
      price: '22.00',
      quantity: 25,
      isDefault: true,
      options: [{ name: 'Couleur', value: 'Blanc' }],
    },
    {
      productSlug: 'mug-ceramique-artisanal',
      sku: 'MUG-GRIS',
      price: '22.00',
      quantity: 18,
      isDefault: false,
      options: [{ name: 'Couleur', value: 'Gris' }],
    },
    {
      productSlug: 'mug-ceramique-artisanal',
      sku: 'MUG-BEIGE',
      price: '22.00',
      quantity: 20,
      isDefault: false,
      options: [{ name: 'Couleur', value: 'Beige' }],
    },

    // Écharpe - 3 couleurs
    {
      productSlug: 'echarpe-lin-naturel',
      sku: 'ECHARPE-ECRU',
      price: '55.00',
      quantity: 20,
      isDefault: true,
      options: [{ name: 'Couleur', value: 'Écru' }],
    },
    {
      productSlug: 'echarpe-lin-naturel',
      sku: 'ECHARPE-GRIS',
      price: '55.00',
      quantity: 15,
      isDefault: false,
      options: [{ name: 'Couleur', value: 'Gris Chiné' }],
    },
    {
      productSlug: 'echarpe-lin-naturel',
      sku: 'ECHARPE-INDIGO',
      price: '58.00',
      quantity: 10,
      isDefault: false,
      options: [{ name: 'Couleur', value: 'Bleu Indigo' }],
    },

    // Coussin - 3 motifs
    {
      productSlug: 'coussin-brode-main',
      sku: 'COUSSIN-FLORAL',
      price: '75.00',
      quantity: 6,
      isDefault: true,
      options: [{ name: 'Motif', value: 'Floral' }],
    },
    {
      productSlug: 'coussin-brode-main',
      sku: 'COUSSIN-GEO',
      price: '75.00',
      quantity: 4,
      isDefault: false,
      options: [{ name: 'Motif', value: 'Géométrique' }],
    },
    {
      productSlug: 'coussin-brode-main',
      sku: 'COUSSIN-FEUIL',
      price: '78.00',
      quantity: 5,
      isDefault: false,
      options: [{ name: 'Motif', value: 'Feuillage' }],
    },

    // Bougie - 4 parfums
    {
      productSlug: 'bougie-parfumee-artisanale',
      sku: 'BOUGIE-LAVANDE',
      price: '24.00',
      quantity: 30,
      isDefault: true,
      options: [{ name: 'Parfum', value: 'Lavande' }],
    },
    {
      productSlug: 'bougie-parfumee-artisanale',
      sku: 'BOUGIE-CEDRE',
      price: '24.00',
      quantity: 25,
      isDefault: false,
      options: [{ name: 'Parfum', value: 'Cèdre' }],
    },
    {
      productSlug: 'bougie-parfumee-artisanale',
      sku: 'BOUGIE-FLEUR',
      price: '26.00',
      quantity: 20,
      isDefault: false,
      options: [{ name: 'Parfum', value: "Fleur d'Oranger" }],
    },
    {
      productSlug: 'bougie-parfumee-artisanale',
      sku: 'BOUGIE-VANILLE',
      price: '24.00',
      quantity: 28,
      isDefault: false,
      options: [{ name: 'Parfum', value: 'Vanille' }],
    },

    // Miroir - variante unique (draft)
    {
      productSlug: 'miroir-rotin-tresse',
      sku: 'MIROIR-45',
      price: '89.00',
      comparePrice: '110.00',
      quantity: 3,
      isDefault: true,
    },
  ];

  const variantMap = new Map<string, string>(); // sku -> variantId
  let variantCount = 0;

  for (const v of variantsToCreate) {
    const prod = productMap.get(v.productSlug);
    if (!prod) continue;

    const [createdVariant] = await db
      .insert(variant)
      .values({
        product: prod.id,
        sku: v.sku,
        priceHt: v.price,
        compareAtPriceHt: v.comparePrice,
        quantity: v.quantity,
        isDefault: v.isDefault,
        status: prod.status,
        sortOrder: variantCount,
      })
      .onConflictDoNothing()
      .returning();

    if (createdVariant) {
      variantMap.set(v.sku, createdVariant.id);
      variantCount++;

      // Link option values
      if (v.options) {
        for (const opt of v.options) {
          const valuesForOption = valueMap.get(opt.name);
          if (valuesForOption) {
            const valueId = valuesForOption.get(opt.value);
            if (valueId) {
              await db
                .insert(variantOptionValue)
                .values({ variant: createdVariant.id, optionValue: valueId })
                .onConflictDoNothing();
            }
          }
        }
      }
    }
  }
  console.log(`    ✓ ${variantCount} variants`);

  // === STOCK MOVES ===
  console.log('  → Stock moves (initial restock)...');

  // Create initial restock movements for all variants
  const allVariants = await db
    .select({
      id: variant.id,
      sku: variant.sku,
      quantity: variant.quantity,
      productName: product.name,
    })
    .from(variant)
    .innerJoin(product, eq(variant.product, product.id));

  let stockMoveCount = 0;
  for (const v of allVariants) {
    if (v.quantity <= 0) continue;

    const label = v.sku ? `${v.productName} — ${v.sku}` : v.productName;

    await db
      .insert(stockMove)
      .values({
        variant: v.id,
        label,
        quantity: v.quantity,
        type: 'restock',
        note: 'Stock initial',
      })
      .onConflictDoNothing();

    stockMoveCount++;
  }
  console.log(`    ✓ ${stockMoveCount} stock moves`);

  // === PRODUCT IMAGES ===
  console.log('  → Product images (downloading from Picsum)...');

  type ImageDef = {
    productSlug: string;
    seed: string;
    title: string;
    isFeatured: boolean;
    forVariantSku?: string;
  };

  const imagesToCreate: ImageDef[] = [
    // Boucles d'oreilles - 4 images
    {
      productSlug: 'boucles-oreilles-lune',
      seed: 'earrings-gold-1',
      title: 'Boucles Lune Or - Vue principale',
      isFeatured: true,
    },
    {
      productSlug: 'boucles-oreilles-lune',
      seed: 'earrings-gold-2',
      title: 'Boucles Lune Or - Détail',
      isFeatured: false,
      forVariantSku: 'BOUCLE-LUNE-OR',
    },
    {
      productSlug: 'boucles-oreilles-lune',
      seed: 'earrings-silver-1',
      title: 'Boucles Lune Argent',
      isFeatured: false,
      forVariantSku: 'BOUCLE-LUNE-ARG',
    },
    {
      productSlug: 'boucles-oreilles-lune',
      seed: 'earrings-rose-1',
      title: 'Boucles Lune Or Rose',
      isFeatured: false,
      forVariantSku: 'BOUCLE-LUNE-ROSE',
    },

    // Collier - 3 images
    {
      productSlug: 'collier-perles-verre',
      seed: 'necklace-glass-1',
      title: 'Collier Perles - Vue principale',
      isFeatured: true,
    },
    {
      productSlug: 'collier-perles-verre',
      seed: 'necklace-glass-2',
      title: 'Collier Perles - Détail perles',
      isFeatured: false,
    },
    {
      productSlug: 'collier-perles-verre',
      seed: 'necklace-glass-3',
      title: 'Collier Perles - Porté',
      isFeatured: false,
    },

    // Bracelet - 4 images
    {
      productSlug: 'bracelet-tresse-cuir',
      seed: 'bracelet-natural-1',
      title: 'Bracelet Naturel',
      isFeatured: true,
    },
    {
      productSlug: 'bracelet-tresse-cuir',
      seed: 'bracelet-black-1',
      title: 'Bracelet Noir',
      isFeatured: false,
      forVariantSku: 'BRAC-NOIR-M',
    },
    {
      productSlug: 'bracelet-tresse-cuir',
      seed: 'bracelet-brown-1',
      title: 'Bracelet Marron',
      isFeatured: false,
      forVariantSku: 'BRAC-MARR-M',
    },
    {
      productSlug: 'bracelet-tresse-cuir',
      seed: 'bracelet-detail-1',
      title: 'Bracelet - Détail fermoir',
      isFeatured: false,
    },

    // Bol - 5 images
    {
      productSlug: 'bol-gres-emaille',
      seed: 'bowl-blue-1',
      title: 'Bol Bleu Océan',
      isFeatured: true,
    },
    {
      productSlug: 'bol-gres-emaille',
      seed: 'bowl-blue-2',
      title: 'Bol Bleu - Vue dessus',
      isFeatured: false,
      forVariantSku: 'BOL-BLEU-M',
    },
    {
      productSlug: 'bol-gres-emaille',
      seed: 'bowl-green-1',
      title: 'Bol Vert Sauge',
      isFeatured: false,
      forVariantSku: 'BOL-VERT-M',
    },
    {
      productSlug: 'bol-gres-emaille',
      seed: 'bowl-terra-1',
      title: 'Bol Terracotta',
      isFeatured: false,
      forVariantSku: 'BOL-TERRA-M',
    },
    {
      productSlug: 'bol-gres-emaille',
      seed: 'bowl-sizes-1',
      title: 'Bols - Comparaison tailles',
      isFeatured: false,
    },

    // Vase - 3 images
    {
      productSlug: 'vase-terre-cuite',
      seed: 'vase-terra-1',
      title: 'Vase Terre Cuite - Vue principale',
      isFeatured: true,
    },
    {
      productSlug: 'vase-terre-cuite',
      seed: 'vase-terra-2',
      title: 'Vase - Avec fleurs séchées',
      isFeatured: false,
    },
    {
      productSlug: 'vase-terre-cuite',
      seed: 'vase-terra-3',
      title: 'Vase - Détail texture',
      isFeatured: false,
    },

    // Mug - 4 images
    {
      productSlug: 'mug-ceramique-artisanal',
      seed: 'mug-white-1',
      title: 'Mug Blanc',
      isFeatured: true,
    },
    {
      productSlug: 'mug-ceramique-artisanal',
      seed: 'mug-grey-1',
      title: 'Mug Gris',
      isFeatured: false,
      forVariantSku: 'MUG-GRIS',
    },
    {
      productSlug: 'mug-ceramique-artisanal',
      seed: 'mug-beige-1',
      title: 'Mug Beige',
      isFeatured: false,
      forVariantSku: 'MUG-BEIGE',
    },
    {
      productSlug: 'mug-ceramique-artisanal',
      seed: 'mug-detail-1',
      title: 'Mug - Détail anse',
      isFeatured: false,
    },

    // Écharpe - 4 images
    {
      productSlug: 'echarpe-lin-naturel',
      seed: 'scarf-ecru-1',
      title: 'Écharpe Écru',
      isFeatured: true,
    },
    {
      productSlug: 'echarpe-lin-naturel',
      seed: 'scarf-grey-1',
      title: 'Écharpe Gris Chiné',
      isFeatured: false,
      forVariantSku: 'ECHARPE-GRIS',
    },
    {
      productSlug: 'echarpe-lin-naturel',
      seed: 'scarf-indigo-1',
      title: 'Écharpe Bleu Indigo',
      isFeatured: false,
      forVariantSku: 'ECHARPE-INDIGO',
    },
    {
      productSlug: 'echarpe-lin-naturel',
      seed: 'scarf-texture-1',
      title: 'Écharpe - Texture lin',
      isFeatured: false,
    },

    // Coussin - 4 images
    {
      productSlug: 'coussin-brode-main',
      seed: 'cushion-floral-1',
      title: 'Coussin Floral',
      isFeatured: true,
    },
    {
      productSlug: 'coussin-brode-main',
      seed: 'cushion-geo-1',
      title: 'Coussin Géométrique',
      isFeatured: false,
      forVariantSku: 'COUSSIN-GEO',
    },
    {
      productSlug: 'coussin-brode-main',
      seed: 'cushion-leaf-1',
      title: 'Coussin Feuillage',
      isFeatured: false,
      forVariantSku: 'COUSSIN-FEUIL',
    },
    {
      productSlug: 'coussin-brode-main',
      seed: 'cushion-detail-1',
      title: 'Coussin - Détail broderie',
      isFeatured: false,
    },

    // Bougie - 5 images
    {
      productSlug: 'bougie-parfumee-artisanale',
      seed: 'candle-lavender-1',
      title: 'Bougie Lavande',
      isFeatured: true,
    },
    {
      productSlug: 'bougie-parfumee-artisanale',
      seed: 'candle-cedar-1',
      title: 'Bougie Cèdre',
      isFeatured: false,
      forVariantSku: 'BOUGIE-CEDRE',
    },
    {
      productSlug: 'bougie-parfumee-artisanale',
      seed: 'candle-orange-1',
      title: "Bougie Fleur d'Oranger",
      isFeatured: false,
      forVariantSku: 'BOUGIE-FLEUR',
    },
    {
      productSlug: 'bougie-parfumee-artisanale',
      seed: 'candle-vanilla-1',
      title: 'Bougie Vanille',
      isFeatured: false,
      forVariantSku: 'BOUGIE-VANILLE',
    },
    {
      productSlug: 'bougie-parfumee-artisanale',
      seed: 'candle-ambiance-1',
      title: 'Bougies - Ambiance',
      isFeatured: false,
    },

    // Miroir - 2 images
    {
      productSlug: 'miroir-rotin-tresse',
      seed: 'mirror-rattan-1',
      title: 'Miroir Rotin - Vue principale',
      isFeatured: true,
    },
    {
      productSlug: 'miroir-rotin-tresse',
      seed: 'mirror-rattan-2',
      title: 'Miroir - Détail tressage',
      isFeatured: false,
    },
  ];

  let imageCount = 0;
  for (const img of imagesToCreate) {
    const prod = productMap.get(img.productSlug);
    if (!prod) continue;

    const mediaId = await createMedia(img.seed, img.title, 800, 800, productsFolderId);
    if (!mediaId) continue;

    const variantId = img.forVariantSku ? variantMap.get(img.forVariantSku) : null;

    await db
      .insert(productMedia)
      .values({
        product: prod.id,
        media: mediaId,
        sortOrder: imageCount,
        isFeatured: img.isFeatured,
        featuredForVariant: variantId,
      })
      .onConflictDoNothing();

    imageCount++;
    process.stdout.write(`\r    ↻ ${imageCount}/${imagesToCreate.length} images...`);
  }
  console.log(`\r    ✓ ${imageCount} product images          `);

  // === CUSTOMERS ===
  console.log('  → Customers...');

  const customersData = [
    {
      email: 'marie.dupont@email.fr',
      firstName: 'Marie',
      lastName: 'Dupont',
      phone: '06 12 34 56 78',
    },
    {
      email: 'jean.martin@email.fr',
      firstName: 'Jean',
      lastName: 'Martin',
      phone: '06 98 76 54 32',
    },
    {
      email: 'sophie.bernard@email.fr',
      firstName: 'Sophie',
      lastName: 'Bernard',
      phone: '07 11 22 33 44',
    },
    {
      email: 'lucas.petit@email.fr',
      firstName: 'Lucas',
      lastName: 'Petit',
      phone: null,
    },
    {
      email: 'emma.moreau@email.fr',
      firstName: 'Emma',
      lastName: 'Moreau',
      phone: '06 55 66 77 88',
    },
  ];

  const customerMap = new Map<string, string>();
  let customerCount = 0;

  for (const c of customersData) {
    const passwordHash = await Bun.password.hash('client123', {
      algorithm: 'argon2id',
      memoryCost: 19456,
      timeCost: 2,
    });

    const [created] = await db
      .insert(customer)
      .values({
        email: c.email,
        passwordHash,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        emailVerified: true,
      })
      .onConflictDoNothing()
      .returning();

    if (created) {
      customerMap.set(c.email, created.id);
      customerCount++;
    }
  }

  // Get existing customers if they weren't created
  if (customerMap.size < customersData.length) {
    const existingCustomers = await db.select().from(customer);
    for (const c of existingCustomers) {
      customerMap.set(c.email, c.id);
    }
  }
  console.log(`    ✓ ${customerCount} customers`);

  // === SHIPPING PROVIDERS ===
  console.log('  → Shipping providers...');

  const shippingProvidersData = [
    { name: 'Colissimo', type: 'colissimo' },
    { name: 'Mondial Relay', type: 'mondialrelay' },
    { name: 'Sendcloud', type: 'sendcloud' },
  ];

  const shippingProviderMap = new Map<string, string>();
  let providerCount = 0;

  for (const sp of shippingProvidersData) {
    const [created] = await db
      .insert(shippingProvider)
      .values(sp)
      .onConflictDoNothing()
      .returning();

    if (created) {
      shippingProviderMap.set(sp.type, created.id);
      providerCount++;
    }
  }

  // Get existing providers if they weren't created
  if (shippingProviderMap.size < shippingProvidersData.length) {
    const existingProviders = await db.select().from(shippingProvider);
    for (const sp of existingProviders) {
      shippingProviderMap.set(sp.type, sp.id);
    }
  }
  console.log(`    ✓ ${providerCount} shipping providers`);

  // === ORDERS ===
  console.log('  → Orders...');

  // Get all variants with their info for order items
  const allVariantsForOrders = await db
    .select({
      id: variant.id,
      sku: variant.sku,
      priceHt: variant.priceHt,
      productName: product.name,
    })
    .from(variant)
    .innerJoin(product, eq(variant.product, product.id));

  const variantBySku = new Map(allVariantsForOrders.map((v) => [v.sku, v]));

  // Helper to generate order number
  function generateOrderNumber(index: number): string {
    const year = new Date().getFullYear();
    const num = String(index + 1).padStart(5, '0');
    return `CMD-${year}-${num}`;
  }

  // Helper to create address snapshot
  function createAddressSnapshot(data: {
    firstName: string;
    lastName: string;
    street: string;
    postalCode: string;
    city: string;
    country: string;
    company?: string;
    phone?: string;
  }) {
    return {
      firstName: data.firstName,
      lastName: data.lastName,
      company: data.company || null,
      street: data.street,
      street2: null,
      postalCode: data.postalCode,
      city: data.city,
      country: data.country,
      phone: data.phone || null,
    };
  }

  type OrderSeedData = {
    customerEmail: string;
    status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    items: { sku: string; quantity: number }[];
    shippingHt: string;
    address: {
      firstName: string;
      lastName: string;
      street: string;
      postalCode: string;
      city: string;
      country: string;
      company?: string;
      phone?: string;
    };
    paymentStatus?: 'pending' | 'completed' | 'failed';
    paymentProvider?: 'stripe' | 'paypal';
    shipmentStatus?: 'pending' | 'label_created' | 'shipped' | 'in_transit' | 'delivered';
    shipmentProvider?: 'colissimo' | 'mondialrelay' | 'sendcloud';
    trackingNumber?: string;
    daysAgo: number;
  };

  const ordersData: OrderSeedData[] = [
    // Commande livrée - Marie
    {
      customerEmail: 'marie.dupont@email.fr',
      status: 'delivered',
      items: [
        { sku: 'BOUCLE-LUNE-OR', quantity: 1 },
        { sku: 'COLLIER-45', quantity: 1 },
      ],
      shippingHt: '5.00',
      address: {
        firstName: 'Marie',
        lastName: 'Dupont',
        street: '15 Rue des Lilas',
        postalCode: '75011',
        city: 'Paris',
        country: 'France',
        phone: '06 12 34 56 78',
      },
      paymentStatus: 'completed',
      paymentProvider: 'stripe',
      shipmentStatus: 'delivered',
      shipmentProvider: 'colissimo',
      trackingNumber: '6A12345678901',
      daysAgo: 15,
    },
    // Commande expédiée - Jean
    {
      customerEmail: 'jean.martin@email.fr',
      status: 'shipped',
      items: [
        { sku: 'BOL-BLEU-M', quantity: 2 },
        { sku: 'MUG-BLANC', quantity: 4 },
      ],
      shippingHt: '8.50',
      address: {
        firstName: 'Jean',
        lastName: 'Martin',
        company: 'Martin & Fils',
        street: '42 Avenue du Commerce',
        postalCode: '69003',
        city: 'Lyon',
        country: 'France',
        phone: '06 98 76 54 32',
      },
      paymentStatus: 'completed',
      paymentProvider: 'paypal',
      shipmentStatus: 'in_transit',
      shipmentProvider: 'mondialrelay',
      trackingNumber: 'MR123456789',
      daysAgo: 3,
    },
    // Commande en traitement - Sophie
    {
      customerEmail: 'sophie.bernard@email.fr',
      status: 'processing',
      items: [
        { sku: 'ECHARPE-ECRU', quantity: 1 },
        { sku: 'COUSSIN-FLORAL', quantity: 2 },
      ],
      shippingHt: '6.00',
      address: {
        firstName: 'Sophie',
        lastName: 'Bernard',
        street: '8 Place de la République',
        postalCode: '33000',
        city: 'Bordeaux',
        country: 'France',
        phone: '07 11 22 33 44',
      },
      paymentStatus: 'completed',
      paymentProvider: 'stripe',
      shipmentStatus: 'label_created',
      shipmentProvider: 'colissimo',
      trackingNumber: '6A98765432101',
      daysAgo: 1,
    },
    // Commande confirmée - Lucas
    {
      customerEmail: 'lucas.petit@email.fr',
      status: 'confirmed',
      items: [
        { sku: 'BOUGIE-LAVANDE', quantity: 3 },
        { sku: 'BOUGIE-CEDRE', quantity: 2 },
        { sku: 'BOUGIE-VANILLE', quantity: 1 },
      ],
      shippingHt: '4.50',
      address: {
        firstName: 'Lucas',
        lastName: 'Petit',
        street: '27 Rue du Moulin',
        postalCode: '31000',
        city: 'Toulouse',
        country: 'France',
      },
      paymentStatus: 'completed',
      paymentProvider: 'stripe',
      daysAgo: 0,
    },
    // Commande en attente - Emma
    {
      customerEmail: 'emma.moreau@email.fr',
      status: 'pending',
      items: [
        { sku: 'BRAC-NAT-M', quantity: 1 },
        { sku: 'VASE-TC-01', quantity: 1 },
      ],
      shippingHt: '5.50',
      address: {
        firstName: 'Emma',
        lastName: 'Moreau',
        street: '3 Impasse des Artisans',
        postalCode: '44000',
        city: 'Nantes',
        country: 'France',
        phone: '06 55 66 77 88',
      },
      paymentStatus: 'pending',
      paymentProvider: 'stripe',
      daysAgo: 0,
    },
    // Commande annulée - Marie (deuxième commande)
    {
      customerEmail: 'marie.dupont@email.fr',
      status: 'cancelled',
      items: [{ sku: 'BOUCLE-LUNE-ARG', quantity: 2 }],
      shippingHt: '4.00',
      address: {
        firstName: 'Marie',
        lastName: 'Dupont',
        street: '15 Rue des Lilas',
        postalCode: '75011',
        city: 'Paris',
        country: 'France',
        phone: '06 12 34 56 78',
      },
      paymentStatus: 'completed',
      paymentProvider: 'stripe',
      daysAgo: 7,
    },
    // Grosse commande livrée - Jean (fidèle client)
    {
      customerEmail: 'jean.martin@email.fr',
      status: 'delivered',
      items: [
        { sku: 'BOL-VERT-M', quantity: 6 },
        { sku: 'BOL-TERRA-M', quantity: 6 },
        { sku: 'MUG-GRIS', quantity: 8 },
        { sku: 'MUG-BEIGE', quantity: 8 },
      ],
      shippingHt: '12.00',
      address: {
        firstName: 'Jean',
        lastName: 'Martin',
        company: 'Restaurant Le Terroir',
        street: '42 Avenue du Commerce',
        postalCode: '69003',
        city: 'Lyon',
        country: 'France',
        phone: '06 98 76 54 32',
      },
      paymentStatus: 'completed',
      paymentProvider: 'stripe',
      shipmentStatus: 'delivered',
      shipmentProvider: 'sendcloud',
      trackingNumber: 'SC987654321FR',
      daysAgo: 30,
    },
  ];

  const TAX_RATE = 20; // 20% TVA
  let orderCount = 0;

  for (let i = 0; i < ordersData.length; i++) {
    const orderData = ordersData[i];
    const customerId = customerMap.get(orderData.customerEmail);
    if (!customerId) continue;

    // Calculate totals
    let subtotalHt = 0;
    const orderItems: {
      variantId: string | null;
      label: string;
      quantity: number;
      unitPriceHt: number;
      taxRate: number;
      totalHt: number;
      totalTtc: number;
    }[] = [];

    for (const item of orderData.items) {
      const v = variantBySku.get(item.sku);
      if (!v) continue;

      const unitPriceHt = parseFloat(v.priceHt);
      const totalHt = unitPriceHt * item.quantity;
      const totalTtc = totalHt * (1 + TAX_RATE / 100);

      subtotalHt += totalHt;
      orderItems.push({
        variantId: v.id,
        label: v.sku ? `${v.productName} — ${v.sku}` : v.productName,
        quantity: item.quantity,
        unitPriceHt,
        taxRate: TAX_RATE,
        totalHt,
        totalTtc,
      });
    }

    const shippingHt = parseFloat(orderData.shippingHt);
    const totalHt = subtotalHt + shippingHt;
    const totalTax = totalHt * (TAX_RATE / 100);
    const totalTtc = totalHt + totalTax;

    const addressSnapshot = createAddressSnapshot(orderData.address);
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - orderData.daysAgo);

    const [createdOrder] = await db
      .insert(order)
      .values({
        orderNumber: generateOrderNumber(i),
        customer: customerId,
        status: orderData.status,
        shippingAddress: addressSnapshot,
        billingAddress: addressSnapshot,
        subtotalHt: subtotalHt.toFixed(2),
        shippingHt: shippingHt.toFixed(2),
        discountHt: '0.00',
        totalHt: totalHt.toFixed(2),
        totalTax: totalTax.toFixed(2),
        totalTtc: totalTtc.toFixed(2),
        dateCreated: orderDate,
        dateUpdated: orderDate,
      })
      .onConflictDoNothing()
      .returning();

    if (!createdOrder) continue;
    orderCount++;

    // Insert order items
    for (const item of orderItems) {
      await db.insert(orderItem).values({
        order: createdOrder.id,
        variant: item.variantId,
        label: item.label,
        quantity: item.quantity,
        unitPriceHt: item.unitPriceHt.toFixed(2),
        taxRate: item.taxRate.toFixed(2),
        totalHt: item.totalHt.toFixed(2),
        totalTtc: item.totalTtc.toFixed(2),
      });
    }

    // Insert payment if specified
    if (orderData.paymentProvider) {
      await db.insert(payment).values({
        order: createdOrder.id,
        provider: orderData.paymentProvider,
        status: orderData.paymentStatus || 'pending',
        amount: totalTtc.toFixed(2),
        providerTransactionId:
          orderData.paymentStatus === 'completed'
            ? `pi_${randomUUID().replace(/-/g, '').slice(0, 24)}`
            : null,
        dateCreated: orderDate,
        dateUpdated: orderDate,
      });
    }

    // Insert shipment if specified
    if (orderData.shipmentProvider && orderData.shipmentStatus) {
      const providerId = shippingProviderMap.get(orderData.shipmentProvider);
      if (providerId) {
        const shippedAt =
          orderData.shipmentStatus !== 'pending' && orderData.shipmentStatus !== 'label_created'
            ? new Date(orderDate.getTime() + 24 * 60 * 60 * 1000) // +1 day
            : null;
        const deliveredAt =
          orderData.shipmentStatus === 'delivered'
            ? new Date(orderDate.getTime() + 4 * 24 * 60 * 60 * 1000) // +4 days
            : null;

        await db.insert(shipment).values({
          order: createdOrder.id,
          provider: providerId,
          status: orderData.shipmentStatus,
          trackingNumber: orderData.trackingNumber || null,
          trackingUrl: orderData.trackingNumber
            ? `https://tracking.example.com/${orderData.trackingNumber}`
            : null,
          weight: '0.500',
          shippedAt,
          deliveredAt,
          dateCreated: orderDate,
          dateUpdated: orderDate,
        });
      }
    }
  }
  console.log(`    ✓ ${orderCount} orders with items, payments and shipments`);

  // === DEFAULT ADMIN USER ===
  console.log('  → Default admin user...');

  const [ownerRole] = await db.select().from(role).where(eq(role.name, 'Propriétaire'));

  if (ownerRole) {
    const [existingAdmin] = await db.select().from(user).where(eq(user.email, 'admin@echoppe.dev'));

    if (!existingAdmin) {
      const passwordHash = await Bun.password.hash('admin123', {
        algorithm: 'argon2id',
        memoryCost: 19456,
        timeCost: 2,
      });

      await db.insert(user).values({
        email: 'admin@echoppe.dev',
        passwordHash,
        firstName: 'Admin',
        lastName: 'Échoppe',
        role: ownerRole.id,
        isOwner: true,
        isActive: true,
      });
      console.log('    ✓ Admin user created (admin@echoppe.dev / admin123)');
    } else {
      console.log('    ⊘ Admin user already exists');
    }
  }

  console.log('✅ Seed completed!');
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
