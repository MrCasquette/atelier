import { randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { db } from '@repo/db';
import { eq } from 'drizzle-orm';
import { customer, invoice, order, orderItem, storeSettings } from '../db/schema';
import { country, legalEntity, site } from '@repo/identity';
import { getStoreSettings } from './store-settings';

// Types pour les snapshots (archivage légal)
export interface SellerSnapshot {
  shopName: string;
  legalName: string;
  legalForm: string | null;
  siren: string | null;
  siret: string | null;
  tvaIntra: string | null;
  rcsCity: string | null;
  shareCapital: string | null;
  street: string;
  street2: string | null;
  postalCode: string;
  city: string;
  country: string;
  publicEmail: string;
  publicPhone: string | null;
}

export interface BuyerSnapshot {
  firstName: string;
  lastName: string;
  company: string | null;
  email: string | null;
  street: string;
  street2: string | null;
  postalCode: string;
  city: string;
  country: string | null;
}

export interface InvoiceItem {
  label: string;
  quantity: number;
  unitPriceHt: string;
  taxRate: string;
  totalHt: string;
}

export interface InvoiceData {
  invoice: {
    type: 'invoice' | 'credit_note';
    number: string;
    orderNumber: string;
    dateIssued: string;
    dateDue: string | null;
    totalHt: string;
    totalTax: string;
    totalTtc: string;
    taxExemptMention: string | null;
  };
  seller: SellerSnapshot;
  buyer: BuyerSnapshot;
  items: InvoiceItem[];
  logoPath: string | null;
}

export interface GenerateInvoiceResult {
  invoiceId: string;
  number: string;
  pdfBuffer: Buffer;
  data: InvoiceData;
}

const TEMPLATE_PATH = join(dirname(import.meta.path), '../templates/invoice.typ');

/**
 * Génère le prochain numéro de facture et l'incrémente en base
 */
async function getNextInvoiceNumber(): Promise<string> {
  const settings = await getStoreSettings();

  const year = new Date().getFullYear();
  const prefix = settings.invoicePrefix;
  const nextNum = settings.invoiceNextNumber;

  // Format: FA-2025-00001
  const number = `${prefix}-${year}-${String(nextNum).padStart(5, '0')}`;

  // Incrémenter le compteur
  await db
    .update(storeSettings)
    .set({ invoiceNextNumber: nextNum + 1 })
    .where(eq(storeSettings.id, settings.id));

  return number;
}

/**
 * Génère une facture PDF pour une commande
 */
export async function generateInvoice(
  orderId: string,
  options: {
    type?: 'invoice' | 'credit_note';
    dateDue?: Date;
  } = {},
): Promise<GenerateInvoiceResult> {
  const { type = 'invoice', dateDue } = options;

  // Récupérer la commande
  const [orderData] = await db.select().from(order).where(eq(order.id, orderId));
  if (!orderData) throw new Error(`Order ${orderId} not found`);

  // Récupérer les items
  const items = await db.select().from(orderItem).where(eq(orderItem.order, orderId));
  if (items.length === 0) throw new Error(`No items found for order ${orderId}`);

  // Identité du vendeur (ADR-0040) : le site porte le nom et le contact, l'entité légale porte
  // les mentions qu'une facture exige. La structure est permissive — c'est ICI, au point d'usage,
  // qu'Échoppe applique son exigence, avec un message qui dit quoi remplir.
  const [siteData] = await db.select().from(site).limit(1);
  const [legal] = await db.select().from(legalEntity).limit(1);

  if (!siteData?.name || !legal?.name || !legal.street || !legal.postalCode || !legal.city) {
    const missing = [
      [siteData?.name, 'nom du site'],
      [legal?.name, 'raison sociale'],
      [legal?.street, 'adresse'],
      [legal?.postalCode, 'code postal'],
      [legal?.city, 'ville'],
    ]
      .filter(([value]) => !value)
      .map(([, label]) => label);

    throw new Error(
      `Facturation impossible : identité du vendeur incomplète (${missing.join(', ')}). ` +
        'À compléter dans Réglages.',
    );
  }

  // Pays du siège
  const [legalCountry] = legal.country
    ? await db.select().from(country).where(eq(country.id, legal.country))
    : [];

  // Récupérer le client pour l'email
  const [cust] = await db.select().from(customer).where(eq(customer.id, orderData.customer));

  // Générer le numéro de facture
  const invoiceNumber = await getNextInvoiceNumber();

  // Construire le snapshot vendeur
  // Les NOMS de ce snapshot ne suivent pas le renommage `shopName` → `site.name` : c'est un format
  // d'ARCHIVE, relu tel quel par regenerateInvoicePdf et par le gabarit Typst. Renommer les clés
  // casserait le rendu de toutes les factures déjà émises.
  const sellerSnapshot: SellerSnapshot = {
    shopName: siteData.name,
    legalName: legal.name,
    legalForm: legal.legalForm,
    siren: legal.siren,
    siret: legal.siret,
    tvaIntra: legal.tvaIntra,
    rcsCity: legal.rcsCity,
    shareCapital: legal.shareCapital,
    street: legal.street,
    street2: legal.street2,
    postalCode: legal.postalCode,
    city: legal.city,
    country: legalCountry?.name ?? 'France',
    publicEmail: siteData.publicEmail ?? '',
    publicPhone: siteData.publicPhone,
  };

  // Construire le snapshot acheteur depuis l'adresse de facturation
  const billingAddress = orderData.billingAddress as {
    firstName: string;
    lastName: string;
    company?: string;
    street: string;
    street2?: string;
    postalCode: string;
    city: string;
    country?: string;
  };

  const buyerSnapshot: BuyerSnapshot = {
    firstName: billingAddress.firstName,
    lastName: billingAddress.lastName,
    company: billingAddress.company ?? null,
    email: cust?.email ?? null,
    street: billingAddress.street,
    street2: billingAddress.street2 ?? null,
    postalCode: billingAddress.postalCode,
    city: billingAddress.city,
    country: billingAddress.country ?? null,
  };

  // Mention d'exonération si applicable
  const { taxExempt } = await getStoreSettings();
  const taxExemptMention = taxExempt ? 'TVA non applicable, art. 293 B du CGI' : null;

  // Construire les données pour le template
  const invoiceData: InvoiceData = {
    invoice: {
      type,
      number: invoiceNumber,
      orderNumber: orderData.orderNumber,
      dateIssued: new Date().toISOString(),
      dateDue: dateDue?.toISOString() ?? null,
      totalHt: orderData.totalHt,
      totalTax: orderData.totalTax,
      totalTtc: orderData.totalTtc,
      taxExemptMention,
    },
    seller: sellerSnapshot,
    buyer: buyerSnapshot,
    items: items.map((item) => ({
      label: item.label,
      quantity: item.quantity,
      unitPriceHt: item.unitPriceHt,
      taxRate: item.taxRate,
      totalHt: item.totalHt,
    })),
    logoPath: null, // TODO: résoudre le chemin du logo si présent
  };

  // Générer le PDF avec Typst
  const pdfBuffer = await compilePdf(invoiceData);

  // Insérer en base
  const [inv] = await db
    .insert(invoice)
    .values({
      order: orderId,
      type,
      number: invoiceNumber,
      status: 'issued',
      sellerSnapshot,
      buyerSnapshot,
      totalHt: orderData.totalHt,
      totalTax: orderData.totalTax,
      totalTtc: orderData.totalTtc,
      taxExemptMention,
      dateIssued: new Date(),
      dateDue: dateDue ?? null,
    })
    .returning();

  return {
    invoiceId: inv.id,
    number: invoiceNumber,
    pdfBuffer,
    data: invoiceData,
  };
}

/**
 * Compile le template Typst en PDF
 */
async function compilePdf(data: InvoiceData): Promise<Buffer> {
  const tempDir = tmpdir();
  const dataPath = join(tempDir, `invoice-${randomUUID()}.json`);
  const outputPath = join(tempDir, `invoice-${randomUUID()}.pdf`);

  try {
    // Écrire les données JSON
    await writeFile(dataPath, JSON.stringify(data), 'utf-8');

    // Compiler avec Typst (--root / pour permettre les chemins absolus)
    const proc = Bun.spawn(
      ['typst', 'compile', '--root', '/', '--input', `data=${dataPath}`, TEMPLATE_PATH, outputPath],
      {
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`Typst compilation failed: ${stderr}`);
    }

    // Lire le PDF généré
    const pdfBuffer = await readFile(outputPath);
    return pdfBuffer;
  } finally {
    // Nettoyer les fichiers temporaires
    await unlink(dataPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

/**
 * Récupère une facture existante par ID
 */
export async function getInvoice(invoiceId: string) {
  const [inv] = await db.select().from(invoice).where(eq(invoice.id, invoiceId));
  return inv;
}

/**
 * Récupère les factures d'une commande
 */
export async function getInvoicesByOrder(orderId: string) {
  return db.select().from(invoice).where(eq(invoice.order, orderId));
}

/**
 * Régénère le PDF d'une facture existante (sans créer de nouvelle facture)
 */
export async function regenerateInvoicePdf(invoiceId: string): Promise<Buffer> {
  const [inv] = await db.select().from(invoice).where(eq(invoice.id, invoiceId));
  if (!inv) throw new Error(`Invoice ${invoiceId} not found`);

  // Récupérer la commande pour les items
  const [orderData] = await db.select().from(order).where(eq(order.id, inv.order));
  if (!orderData) throw new Error(`Order for invoice ${invoiceId} not found`);

  const items = await db.select().from(orderItem).where(eq(orderItem.order, inv.order));

  const invoiceData: InvoiceData = {
    invoice: {
      type: inv.type,
      number: inv.number,
      orderNumber: orderData.orderNumber,
      dateIssued: inv.dateIssued.toISOString(),
      dateDue: inv.dateDue?.toISOString() ?? null,
      totalHt: inv.totalHt,
      totalTax: inv.totalTax,
      totalTtc: inv.totalTtc,
      taxExemptMention: inv.taxExemptMention,
    },
    seller: inv.sellerSnapshot as SellerSnapshot,
    buyer: inv.buyerSnapshot as BuyerSnapshot,
    items: items.map((item) => ({
      label: item.label,
      quantity: item.quantity,
      unitPriceHt: item.unitPriceHt,
      taxRate: item.taxRate,
      totalHt: item.totalHt,
    })),
    logoPath: null,
  };

  return compilePdf(invoiceData);
}
