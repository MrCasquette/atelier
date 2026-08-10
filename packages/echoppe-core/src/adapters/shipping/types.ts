// SSOT des transporteurs — ajouter un transporteur = l'inscrire ici (+ adapter + credentials).
// Registre, listings et schémas de route en dérivent, jamais de liste codée en dur ailleurs.
export const SHIPPING_PROVIDERS = ['colissimo', 'mondialrelay', 'sendcloud'] as const;
export type ShippingProvider = (typeof SHIPPING_PROVIDERS)[number];

export function isShippingProvider(value: string): value is ShippingProvider {
  return (SHIPPING_PROVIDERS as readonly string[]).includes(value);
}

export interface Address {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  postalCode: string;
  country: string; // Code ISO 2 lettres (FR, BE, etc.)
  phone?: string;
  email?: string;
}

export interface ShippingRate {
  id: string;
  carrier: string;
  service: string;
  price: number; // En centimes
  currency: string;
  deliveryDays: { min: number; max: number };
}

export interface ShipmentLabel {
  trackingNumber: string;
  trackingUrl: string;
  labelUrl: string; // URL du PDF
  labelData?: string; // Base64 du PDF
}

export interface TrackingEvent {
  date: Date;
  status: string;
  description: string;
  location?: string;
}

export interface GetRatesParams {
  weight: number; // En grammes
  fromPostalCode: string;
  fromCountry: string;
  toPostalCode: string;
  toCountry: string;
}

export interface CreateLabelParams {
  orderId: string;
  weight: number; // En grammes
  sender: Address;
  recipient: Address;
  service?: string;
}

export interface ShippingAdapter {
  readonly provider: ShippingProvider;

  /**
   * Récupère les tarifs disponibles pour un envoi
   */
  getRates(params: GetRatesParams): Promise<ShippingRate[]>;

  /**
   * Crée une étiquette d'expédition
   */
  createLabel(params: CreateLabelParams): Promise<ShipmentLabel>;

  /**
   * Récupère les événements de suivi d'un colis
   */
  getTracking(trackingNumber: string): Promise<TrackingEvent[]>;

  /**
   * Vérifie si l'adapter est configuré (credentials présents et activé)
   */
  isConfigured(): Promise<boolean>;
}
