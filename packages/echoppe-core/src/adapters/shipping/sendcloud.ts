import type { CredentialStore } from '@repo/adapters';
import type { SendcloudCredentials } from './config';
import type {
  CreateLabelParams,
  GetRatesParams,
  ShipmentLabel,
  ShippingAdapter,
  ShippingRate,
  TrackingEvent,
} from './types';
import { isRecord } from '@repo/shared';

const isShippingMethod = (value: unknown): value is SendcloudShippingMethod =>
  isRecord(value) &&
  typeof value.min_weight === 'number' &&
  typeof value.max_weight === 'number';

const SENDCLOUD_API_URL = 'https://panel.sendcloud.sc/api/v2';

interface SendcloudShippingMethod {
  id: number;
  name: string;
  carrier: string;
  min_weight: number;
  max_weight: number;
  price?: number;
  countries?: Array<{ iso_2: string; price: number }>;
}

export class SendcloudAdapter implements ShippingAdapter {
  readonly provider = 'sendcloud' as const;
  private authHeader: string | null = null;
  private initialized = false;

  // DIP : la source des credentials est injectée (registre = base ; test = stub).
  constructor(private readonly credentials: CredentialStore<SendcloudCredentials>) {}

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const credentials = await this.credentials.get();
    if (credentials) {
      const auth = Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString('base64');
      this.authHeader = `Basic ${auth}`;
    }
    this.initialized = true;
  }

  async isConfigured(): Promise<boolean> {
    return (await this.credentials.get()) !== null;
  }

  /**
   * Une réponse de Sendcloud, telle qu'elle arrive : `unknown`.
   *
   * Elle promettait `T` sur la seule foi de l'appelant, sans jamais rien vérifier — la forme la
   * plus trompeuse, puisque le type paraissait sûr partout en aval. C'est à chaque appelant de
   * dire ce qu'il lit, et de le prouver.
   */
  private async request(endpoint: string, options: RequestInit = {}): Promise<unknown> {
    await this.ensureInitialized();

    if (!this.authHeader) {
      throw new Error('Sendcloud is not configured.');
    }

    const response = await fetch(`${SENDCLOUD_API_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Sendcloud API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async getRates(params: GetRatesParams): Promise<ShippingRate[]> {
    const body = await this.request('/shipping_methods');
    const shipping_methods =
      isRecord(body) && Array.isArray(body.shipping_methods)
        ? body.shipping_methods.filter(isShippingMethod)
        : [];

    const weightKg = params.weight / 1000;

    return shipping_methods
      .filter((method) => {
        const inWeightRange = weightKg >= method.min_weight && weightKg <= method.max_weight;
        const servesCountry =
          !method.countries || method.countries.some((c) => c.iso_2 === params.toCountry);
        return inWeightRange && servesCountry;
      })
      .map((method) => {
        const countryPrice = method.countries?.find((c) => c.iso_2 === params.toCountry)?.price;
        const price = countryPrice ?? method.price ?? 0;

        return {
          id: `sendcloud_${method.id}`,
          carrier: method.carrier,
          service: method.name,
          price: Math.round(price * 100),
          currency: 'EUR',
          deliveryDays: { min: 1, max: 5 },
        };
      });
  }

  async createLabel(params: CreateLabelParams): Promise<ShipmentLabel> {
    const serviceId = params.service?.replace('sendcloud_', '');

    const parcelData = {
      parcel: {
        name: params.recipient.name,
        company_name: params.recipient.company ?? '',
        address: params.recipient.street1,
        address_2: params.recipient.street2 ?? '',
        city: params.recipient.city,
        postal_code: params.recipient.postalCode,
        country: params.recipient.country,
        telephone: params.recipient.phone ?? '',
        email: params.recipient.email ?? '',
        weight: (params.weight / 1000).toFixed(3),
        order_number: params.orderId,
        shipment: serviceId ? { id: parseInt(serviceId, 10) } : undefined,
        request_label: true,
      },
    };

    const body = await this.request('/parcels', {
      method: 'POST',
      body: JSON.stringify(parcelData),
    });
    const parcel = isRecord(body) && isRecord(body.parcel) ? body.parcel : null;
    if (
      !parcel ||
      typeof parcel.tracking_number !== 'string' ||
      typeof parcel.tracking_url !== 'string'
    ) {
      throw new Error("Réponse Sendcloud inattendue : le colis créé n'a pas de numéro de suivi.");
    }
    const printer =
      isRecord(parcel.label) && Array.isArray(parcel.label.normal_printer)
        ? parcel.label.normal_printer
        : [];

    return {
      trackingNumber: parcel.tracking_number,
      trackingUrl: parcel.tracking_url,
      labelUrl: typeof printer[0] === 'string' ? printer[0] : '',
    };
  }

  async getTracking(trackingNumber: string): Promise<TrackingEvent[]> {
    const body = await this.request(`/parcels?tracking_number=${trackingNumber}`);
    const parcel = isRecord(body) && isRecord(body.parcel) ? body.parcel : null;
    const status = isRecord(parcel?.status) ? parcel.status : null;
    if (!parcel || typeof parcel.date_updated !== 'string' || typeof status?.message !== 'string') {
      return [];
    }

    return [
      {
        date: new Date(parcel.date_updated),
        status: status.message,
        description: status.message,
      },
    ];
  }
}
