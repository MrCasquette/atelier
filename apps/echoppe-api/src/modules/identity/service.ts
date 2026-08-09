import {
  country,
  db,
  eq,
  legalEntity,
  readStoreSettings,
  saveStoreSettings,
  site,
} from '@echoppe/core';

// Logique de l'identité du site et de l'entité légale (ADR-0040), sans rien savoir du transport.
//
// Les types d'entrée sont écrits ici en TypeScript nu plutôt que dérivés de `identityBody` : ce
// dernier est le CONTRAT, il appartient au produit et ne doit pas remonter dans un service destiné
// au paquet (ADR-0044, amendement du 2026-08-09). Les deux représentations doivent s'accorder, et
// c'est le compilateur qui le garantit — le controller passe son `body` à `saveIdentity`, tout
// décalage échoue au type-check.

export type SiteInput = {
  name: string;
  logo?: string | null;
  url?: string | null;
  description?: string | null;
  publicEmail?: string | null;
  publicPhone?: string | null;
  publisherName?: string | null;
  hostName?: string | null;
  hostAddress?: string | null;
  hostPhone?: string | null;
};

/** Les quatre champs requis sont ce qu'une facture impose (ADR-0040). */
export type LegalEntityInput = {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  legalForm?: string;
  siren?: string;
  siret?: string;
  tvaIntra?: string;
  rcsCity?: string;
  shareCapital?: string;
  street2?: string;
  country?: string;
};

export type IdentityInput = {
  site: SiteInput;
  /** Absent → inchangé. `null` → supprimé. Sinon upsert. */
  legal?: LegalEntityInput | null;
  settings?: {
    documentPrefix?: string;
    invoicePrefix?: string;
    taxExempt?: boolean;
  };
};

export async function readIdentity() {
  const [siteData] = await db.select().from(site).limit(1);
  const [legal] = await db.select().from(legalEntity).limit(1);
  const { documentPrefix, invoicePrefix, taxExempt } = await readStoreSettings();

  return {
    site: siteData ?? null,
    legal: legal ?? null,
    settings: { documentPrefix, invoicePrefix, taxExempt },
  };
}

/** Liste complète des pays, pour les sélecteurs d'administration. */
export function listCountries() {
  return db.select().from(country).orderBy(country.name);
}

/** Upsert des deux tables et des réglages, puis relecture de l'état résultant. */
export async function saveIdentity(input: IdentityInput) {
  const siteValues = {
    name: input.site.name,
    logo: input.site.logo ?? null,
    url: input.site.url ?? null,
    description: input.site.description ?? null,
    publicEmail: input.site.publicEmail ?? null,
    publicPhone: input.site.publicPhone ?? null,
    publisherName: input.site.publisherName ?? null,
    hostName: input.site.hostName ?? null,
    hostAddress: input.site.hostAddress ?? null,
    hostPhone: input.site.hostPhone ?? null,
  };

  const [existingSite] = await db.select({ id: site.id }).from(site).limit(1);
  if (existingSite) {
    await db.update(site).set(siteValues).where(eq(site.id, existingSite.id));
  } else {
    await db.insert(site).values(siteValues);
  }

  if (input.legal !== undefined) {
    const [existingLegal] = await db.select({ id: legalEntity.id }).from(legalEntity).limit(1);

    if (input.legal === null) {
      if (existingLegal) {
        await db.delete(legalEntity).where(eq(legalEntity.id, existingLegal.id));
      }
    } else {
      const legalValues = {
        name: input.legal.name,
        legalForm: input.legal.legalForm ?? null,
        siren: input.legal.siren ?? null,
        siret: input.legal.siret ?? null,
        tvaIntra: input.legal.tvaIntra ?? null,
        rcsCity: input.legal.rcsCity ?? null,
        shareCapital: input.legal.shareCapital ?? null,
        street: input.legal.street,
        street2: input.legal.street2 ?? null,
        postalCode: input.legal.postalCode,
        city: input.legal.city,
        country: input.legal.country ?? null,
      };

      if (existingLegal) {
        await db.update(legalEntity).set(legalValues).where(eq(legalEntity.id, existingLegal.id));
      } else {
        await db.insert(legalEntity).values(legalValues);
      }
    }
  }

  if (input.settings) {
    await saveStoreSettings({
      documentPrefix: input.settings.documentPrefix ?? 'REC',
      invoicePrefix: input.settings.invoicePrefix ?? 'FA',
      taxExempt: input.settings.taxExempt ?? false,
    });
  }

  return readIdentity();
}
