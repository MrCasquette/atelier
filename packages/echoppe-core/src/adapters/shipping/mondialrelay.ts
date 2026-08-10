import type { CredentialStore } from '@repo/adapters';
import type { MondialRelayCredentials } from './config';
import type {
  CreateLabelParams,
  GetRatesParams,
  ShipmentLabel,
  ShippingAdapter,
  ShippingRate,
  TrackingEvent,
} from './types';

const MONDIAL_RELAY_API_URL = 'https://api.mondialrelay.com/Web_Services.asmx';

export class MondialRelayAdapter implements ShippingAdapter {
  readonly provider = 'mondialrelay' as const;
  private brandId: string | null = null;
  private login: string | null = null;
  private password: string | null = null;
  private initialized = false;

  // DIP : la source des credentials est injectée (registre = base ; test = stub).
  constructor(private readonly credentials: CredentialStore<MondialRelayCredentials>) {}

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const credentials = await this.credentials.get();
    if (credentials) {
      this.brandId = credentials.brandId;
      this.login = credentials.login;
      this.password = credentials.password;
    }
    this.initialized = true;
  }

  async isConfigured(): Promise<boolean> {
    return (await this.credentials.get()) !== null;
  }

  private generateSecurityKey(params: Record<string, string>): string {
    const concat = Object.values(params).join('') + (this.password ?? '');
    const encoder = new TextEncoder();
    const data = encoder.encode(concat);

    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data[i]) | 0;
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(32, '0');
  }

  async getRates(params: GetRatesParams): Promise<ShippingRate[]> {
    await this.ensureInitialized();

    if (!this.brandId) {
      throw new Error('Mondial Relay is not configured.');
    }

    const rates: ShippingRate[] = [];
    const weightKg = params.weight / 1000;

    if (['FR', 'BE', 'ES', 'LU'].includes(params.toCountry)) {
      if (weightKg <= 0.5) {
        rates.push({
          id: 'mondialrelay_point_500g',
          carrier: 'Mondial Relay',
          service: 'Point Relais - 500g',
          price: 399,
          currency: 'EUR',
          deliveryDays: { min: 3, max: 5 },
        });
      }
      if (weightKg <= 1) {
        rates.push({
          id: 'mondialrelay_point_1kg',
          carrier: 'Mondial Relay',
          service: 'Point Relais - 1kg',
          price: 449,
          currency: 'EUR',
          deliveryDays: { min: 3, max: 5 },
        });
      }
      if (weightKg <= 3) {
        rates.push({
          id: 'mondialrelay_point_3kg',
          carrier: 'Mondial Relay',
          service: 'Point Relais - 3kg',
          price: 549,
          currency: 'EUR',
          deliveryDays: { min: 3, max: 5 },
        });
      }
      if (weightKg <= 5) {
        rates.push({
          id: 'mondialrelay_point_5kg',
          carrier: 'Mondial Relay',
          service: 'Point Relais - 5kg',
          price: 649,
          currency: 'EUR',
          deliveryDays: { min: 3, max: 5 },
        });
      }
    }

    return rates;
  }

  async createLabel(params: CreateLabelParams): Promise<ShipmentLabel> {
    await this.ensureInitialized();

    if (!this.brandId || !this.login || !this.password) {
      throw new Error('Mondial Relay is not configured.');
    }

    const soapParams = {
      Enseigne: this.brandId,
      ModeCol: 'REL',
      ModeLiv: '24R',
      Expe_Langage: 'FR',
      Expe_Ad1: params.sender.name,
      Expe_Ad2: params.sender.company ?? '',
      Expe_Ad3: params.sender.street1,
      Expe_Ad4: params.sender.street2 ?? '',
      Expe_Ville: params.sender.city,
      Expe_CP: params.sender.postalCode,
      Expe_Pays: params.sender.country,
      Expe_Tel1: params.sender.phone ?? '',
      Expe_Mail: params.sender.email ?? '',
      Dest_Langage: 'FR',
      Dest_Ad1: params.recipient.name,
      Dest_Ad2: params.recipient.company ?? '',
      Dest_Ad3: params.recipient.street1,
      Dest_Ad4: params.recipient.street2 ?? '',
      Dest_Ville: params.recipient.city,
      Dest_CP: params.recipient.postalCode,
      Dest_Pays: params.recipient.country,
      Dest_Tel1: params.recipient.phone ?? '',
      Dest_Mail: params.recipient.email ?? '',
      Poids: Math.round(params.weight).toString(),
      NbColis: '1',
      CRT_Valeur: '0',
      COL_Rel_Pays: params.sender.country,
      COL_Rel: '',
      LIV_Rel_Pays: params.recipient.country,
      LIV_Rel: '',
    };

    const securityKey = this.generateSecurityKey(soapParams);

    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <WSI2_CreationEtiquette xmlns="http://www.mondialrelay.fr/webservice/">
      ${Object.entries(soapParams)
        .map(([key, value]) => `<${key}>${value}</${key}>`)
        .join('\n      ')}
      <Security>${securityKey}</Security>
    </WSI2_CreationEtiquette>
  </soap:Body>
</soap:Envelope>`;

    const response = await fetch(MONDIAL_RELAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'http://www.mondialrelay.fr/webservice/WSI2_CreationEtiquette',
      },
      body: soapBody,
    });

    const xml = await response.text();

    const trackingMatch = xml.match(/<ExpeditionNum>([^<]+)<\/ExpeditionNum>/);
    const urlMatch = xml.match(/<URL_Etiquette>([^<]+)<\/URL_Etiquette>/);
    const errorMatch = xml.match(/<STAT>(\d+)<\/STAT>/);

    if (errorMatch && errorMatch[1] !== '0') {
      throw new Error(`Mondial Relay error code: ${errorMatch[1]}`);
    }

    if (!trackingMatch || !urlMatch) {
      throw new Error('Invalid response from Mondial Relay');
    }

    const trackingNumber = trackingMatch[1];

    return {
      trackingNumber,
      trackingUrl: `https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${trackingNumber}`,
      labelUrl: urlMatch[1].replace(/&amp;/g, '&'),
    };
  }

  async getTracking(trackingNumber: string): Promise<TrackingEvent[]> {
    await this.ensureInitialized();

    if (!this.brandId || !this.password) {
      throw new Error('Mondial Relay is not configured.');
    }

    const soapParams = {
      Enseigne: this.brandId,
      Expedition: trackingNumber,
      Langue: 'FR',
    };

    const securityKey = this.generateSecurityKey(soapParams);

    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <WSI2_TracingColisDetaille xmlns="http://www.mondialrelay.fr/webservice/">
      ${Object.entries(soapParams)
        .map(([key, value]) => `<${key}>${value}</${key}>`)
        .join('\n      ')}
      <Security>${securityKey}</Security>
    </WSI2_TracingColisDetaille>
  </soap:Body>
</soap:Envelope>`;

    const response = await fetch(MONDIAL_RELAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'http://www.mondialrelay.fr/webservice/WSI2_TracingColisDetaille',
      },
      body: soapBody,
    });

    const xml = await response.text();
    const events: TrackingEvent[] = [];

    const trecRegex =
      /<Tracing_Libelle>([^<]+)<\/Tracing_Libelle>[\s\S]*?<Tracing_Date>([^<]+)<\/Tracing_Date>/g;
    let match = trecRegex.exec(xml);
    while (match !== null) {
      events.push({
        date: new Date(match[2]),
        status: match[1],
        description: match[1],
      });
      match = trecRegex.exec(xml);
    }

    return events;
  }
}
