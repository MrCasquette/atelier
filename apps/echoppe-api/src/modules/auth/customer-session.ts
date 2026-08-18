import { customer, customerSession, faults } from '@echoppe/core';
import { and, db, eq, gt } from '@repo/db';
import { Elysia, t } from 'elysia';
import { faultBody } from '../../lib/fault';
import { cookieValue } from '../../lib/cookie';

export const CUSTOMER_COOKIE_NAME = 'echoppe_customer_session';

export const customerCookieSchema = t.Cookie({
  [CUSTOMER_COOKIE_NAME]: t.Optional(t.String()),
});

export type SessionCustomer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  emailVerified: boolean;
};

/**
 * Union discriminée, et non un objet à champs nullables : la macro refuse en 401 quand la session
 * est absente, mais son type l'annonçait quand même `| null`. Quinze contrôleurs affirmaient donc
 * en aval ce que la garde avait déjà établi. `isAuthenticated` porte la garantie, TypeScript la
 * propage, et plus personne n'a rien à affirmer.
 */
export type CustomerAuthContext =
  | {
      isAuthenticated: false;
      currentCustomer: null;
      storedUserAgent: null;
      storedIpAddress: null;
    }
  | {
      isAuthenticated: true;
      currentCustomer: SessionCustomer;
      storedUserAgent: string | null;
      storedIpAddress: string | null;
    };

export async function getCustomerSessionFromToken(
  token: string | undefined,
): Promise<CustomerAuthContext> {
  if (!token) {
    return {
      currentCustomer: null,
      isAuthenticated: false,
      storedUserAgent: null,
      storedIpAddress: null,
    };
  }

  const [sessionData] = await db
    .select({
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        emailVerified: customer.emailVerified,
      },
      session: {
        userAgent: customerSession.userAgent,
        ipAddress: customerSession.ipAddress,
      },
    })
    .from(customerSession)
    .innerJoin(customer, eq(customerSession.customer, customer.id))
    .where(and(eq(customerSession.token, token), gt(customerSession.expiresAt, new Date())));

  if (!sessionData) {
    return {
      currentCustomer: null,
      isAuthenticated: false,
      storedUserAgent: null,
      storedIpAddress: null,
    };
  }

  return {
    currentCustomer: sessionData.customer,
    isAuthenticated: true,
    storedUserAgent: sessionData.session.userAgent,
    storedIpAddress: sessionData.session.ipAddress,
  };
}

export const customerAuthPlugin = new Elysia({ name: 'customerAuth' }).macro({
  customerAuth: {
    async resolve({ cookie, request, status }) {
      const token = cookieValue(cookie, CUSTOMER_COOKIE_NAME);
      const session = await getCustomerSessionFromToken(token);

      if (!session.isAuthenticated) {
        return status(401, faultBody(faults.unauthenticated()));
      }

      // Verify User-Agent matches (strict check for session hijacking)
      const currentUserAgent = request.headers.get('user-agent') ?? 'unknown';
      if (session.storedUserAgent && session.storedUserAgent !== currentUserAgent) {
        console.warn('[Security] User-Agent mismatch for customer session', {
          customerId: session.currentCustomer?.id,
          stored: session.storedUserAgent?.substring(0, 50),
          current: currentUserAgent.substring(0, 50),
        });
        return status(401, faultBody(faults.invalidToken()));
      }

      // Log IP changes (warning only, don't block - IPs change on mobile)
      const currentIp =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        'unknown';
      if (session.storedIpAddress && session.storedIpAddress !== currentIp) {
        console.info('[Security] IP change detected for customer session', {
          customerId: session.currentCustomer?.id,
          stored: session.storedIpAddress,
          current: currentIp,
        });
      }

      return {
        currentCustomer: session.currentCustomer,
      };
    },
  },
});
