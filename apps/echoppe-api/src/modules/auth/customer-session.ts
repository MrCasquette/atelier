import { and, customer, customerSession, db, eq, gt } from '@echoppe/core';
import { Elysia, t } from 'elysia';

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

export type CustomerAuthContext = {
  currentCustomer: SessionCustomer | null;
  isAuthenticated: boolean;
};

type SessionWithMeta = CustomerAuthContext & {
  storedUserAgent: string | null;
  storedIpAddress: string | null;
};

export async function getCustomerSessionFromToken(
  token: string | undefined,
): Promise<SessionWithMeta> {
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
    currentCustomer: sessionData.customer as SessionCustomer,
    isAuthenticated: true,
    storedUserAgent: sessionData.session.userAgent,
    storedIpAddress: sessionData.session.ipAddress,
  };
}

export const customerAuthPlugin = new Elysia({ name: 'customerAuth' }).macro({
  customerAuth: {
    async resolve({ cookie, request, status }) {
      const token = (cookie as Record<string, { value?: string }>)[CUSTOMER_COOKIE_NAME]?.value;
      const session = await getCustomerSessionFromToken(token);

      if (!session.isAuthenticated) {
        return status(401, { message: 'Non authentifié' });
      }

      // Verify User-Agent matches (strict check for session hijacking)
      const currentUserAgent = request.headers.get('user-agent') ?? 'unknown';
      if (session.storedUserAgent && session.storedUserAgent !== currentUserAgent) {
        console.warn('[Security] User-Agent mismatch for customer session', {
          customerId: session.currentCustomer?.id,
          stored: session.storedUserAgent?.substring(0, 50),
          current: currentUserAgent.substring(0, 50),
        });
        return status(401, { message: 'Session invalide' });
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
