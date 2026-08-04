import type { CredentialStore } from '@repo/adapters';
import type { ColissimoCredentials } from './config';
import type {
  CreateLabelParams,
  GetRatesParams,
  ShipmentLabel,
  ShippingAdapter,
  ShippingRate,
  TrackingEvent,
} from './types';

const COLISSIMO_API_URL = 'https://ws.colissimo.fr/sls-ws/SlsServiceWSRest';
const COLISSIMO_TRACKING_URL = 'https://api.laposte.fr/suivi/v2';

interface ColissimoLabelResponse {
  messages?: Array<{ type: string; messageContent: string }>;
  labelV2Response?: {
    parcelNumber: string;
    pdfUrl: string;
  };
}

export class ColissimoAdapter implements ShippingAdapter {
  readonly provider = 'colissimo' as const;
  private contractNumber: string | null = null;
  private password: string | null = null;
  private initialized = false;

  // DIP : la source des credentials est injectée (registre = base ; test = stub).
  constructor(private readonly credentials: CredentialStore<ColissimoCredentials>) {}

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const credentials = await this.credentials.get();
    if (credentials) {
      this.contractNumber = credentials.contractNumber;
      this.password = credentials.password;
    }
    this.initialized = true;
  }

  async isConfigured(): Promise<boolean> {
    return (await this.credentials.get()) !== null;
  }

  async getRates(params: GetRatesParams): Promise<ShippingRate[]> {
    await this.ensureInitialized();

    if (!this.contractNumber) {
      throw new Error('Colissimo is not configured.');
    }

    const rates: ShippingRate[] = [];
    const weightKg = params.weight / 1000;

    if (params.toCountry === 'FR') {
      if (weightKg <= 0.25) {
        rates.push({
          id: 'colissimo_dom_250g',
          carrier: 'Colissimo',
          service: 'Colissimo Domicile - 250g',
          price: 499,
          currency: 'EUR',
          deliveryDays: { min: 1, max: 2 },
        });
      }
      if (weightKg <= 0.5) {
        rates.push({
          id: 'colissimo_dom_500g',
          carrier: 'Colissimo',
          service: 'Colissimo Domicile - 500g',
          price: 649,
          currency: 'EUR',
          deliveryDays: { min: 1, max: 2 },
        });
      }
      if (weightKg <= 1) {
        rates.push({
          id: 'colissimo_dom_1kg',
          carrier: 'Colissimo',
          service: 'Colissimo Domicile - 1kg',
          price: 749,
          currency: 'EUR',
          deliveryDays: { min: 1, max: 2 },
        });
      }
      if (weightKg <= 2) {
        rates.push({
          id: 'colissimo_dom_2kg',
          carrier: 'Colissimo',
          service: 'Colissimo Domicile - 2kg',
          price: 849,
          currency: 'EUR',
          deliveryDays: { min: 1, max: 2 },
        });
      }
    }

    return rates;
  }

  async createLabel(params: CreateLabelParams): Promise<ShipmentLabel> {
    await this.ensureInitialized();

    if (!this.contractNumber || !this.password) {
      throw new Error('Colissimo is not configured.');
    }

    const response = await fetch(`${COLISSIMO_API_URL}/generateLabel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractNumber: this.contractNumber,
        password: this.password,
        outputFormat: {
          x: 0,
          y: 0,
          outputPrintingType: 'PDF_10x15_300dpi',
        },
        letter: {
          service: {
            productCode: 'DOM',
            depositDate: new Date().toISOString().split('T')[0],
            orderNumber: params.orderId,
          },
          parcel: {
            weight: params.weight / 1000,
          },
          sender: {
            senderParcelRef: params.orderId,
            address: {
              companyName: params.sender.company ?? params.sender.name,
              line2: params.sender.street1,
              line3: params.sender.street2 ?? '',
              city: params.sender.city,
              zipCode: params.sender.postalCode,
              countryCode: params.sender.country,
            },
          },
          addressee: {
            address: {
              companyName: params.recipient.company ?? '',
              lastName: params.recipient.name,
              line2: params.recipient.street1,
              line3: params.recipient.street2 ?? '',
              city: params.recipient.city,
              zipCode: params.recipient.postalCode,
              countryCode: params.recipient.country,
              phone: params.recipient.phone ?? '',
              email: params.recipient.email ?? '',
            },
          },
        },
      }),
    });

    const data = (await response.json()) as ColissimoLabelResponse;

    if (data.messages?.some((m) => m.type === 'ERROR')) {
      const error = data.messages.find((m) => m.type === 'ERROR');
      throw new Error(`Colissimo error: ${error?.messageContent}`);
    }

    if (!data.labelV2Response) {
      throw new Error('No label response from Colissimo');
    }

    const trackingNumber = data.labelV2Response.parcelNumber;

    return {
      trackingNumber,
      trackingUrl: `https://www.laposte.fr/outils/suivre-vos-envois?code=${trackingNumber}`,
      labelUrl: data.labelV2Response.pdfUrl,
    };
  }

  async getTracking(trackingNumber: string): Promise<TrackingEvent[]> {
    const response = await fetch(`${COLISSIMO_TRACKING_URL}/idships/${trackingNumber}`, {
      headers: {
        Accept: 'application/json',
        'X-Okapi-Key': this.contractNumber ?? '',
      },
    });

    if (!response.ok) {
      throw new Error(`Colissimo tracking error: ${response.status}`);
    }

    const data = (await response.json()) as {
      shipment?: {
        event?: Array<{
          date: string;
          code: string;
          label: string;
        }>;
      };
    };

    return (
      data.shipment?.event?.map((event) => ({
        date: new Date(event.date),
        status: event.code,
        description: event.label,
      })) ?? []
    );
  }
}
