import type { Context, Generator, Options } from 'elysia-rate-limit';
import Redis from 'ioredis';

// Redis client singleton
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

/**
 * Redis-backed rate limit context for distributed rate limiting.
 */
class RedisContext implements Context {
  private duration = 60_000;
  private prefix: string;

  constructor(prefix = 'rl:') {
    this.prefix = prefix;
  }

  init(options: Omit<Options, 'context'>): void {
    // `duration` peut désormais être une fonction ; on ne garde que le cas
    // numérique comme valeur par défaut (la lib passe la durée résolue à `increment`).
    if (typeof options.duration === 'number') {
      this.duration = options.duration;
    }
  }

  async increment(
    key: string,
    duration: number = this.duration,
    requestTime: number = Date.now(),
  ): Promise<{ count: number; nextReset: Date; start: number }> {
    const redisKey = `${this.prefix}${key}`;

    if (!redis) {
      // Fallback: no limit if Redis not available
      return { count: 0, nextReset: new Date(requestTime + duration), start: requestTime };
    }

    const count = await redis.incr(redisKey);

    // Set expiry on first request
    if (count === 1) {
      await redis.expire(redisKey, Math.ceil(duration / 1000));
    }

    const ttl = await redis.ttl(redisKey);
    const nextReset = new Date(requestTime + ttl * 1000);
    const start = nextReset.getTime() - duration;

    return { count, nextReset, start };
  }

  async decrement(key: string): Promise<void> {
    if (!redis) return;
    const redisKey = `${this.prefix}${key}`;
    await redis.decr(redisKey);
  }

  async reset(key?: string): Promise<void> {
    if (!redis) return;
    if (key) {
      await redis.del(`${this.prefix}${key}`);
    }
  }

  async kill(): Promise<void> {
    // Connection cleanup if needed
  }
}

/**
 * IP generator from request headers (works behind proxies).
 */
const ipGenerator: Generator = (request, server): string => {
  // Try server.requestIP() first
  if (server) {
    const ip = server.requestIP(request)?.address;
    if (ip) return ip;
  }

  // Fallback to headers (behind proxy)
  const headers = request.headers;
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    headers.get('cf-connecting-ip') ??
    '127.0.0.1'
  );
};

/**
 * Create rate limit options with scoped context.
 */
function createRateLimitOptions(config: {
  prefix: string;
  duration: number;
  max: number;
  message: string;
}): Partial<Options> {
  return {
    scoping: 'scoped',
    duration: config.duration,
    max: config.max,
    generator: ipGenerator,
    context: new RedisContext(config.prefix),
    errorResponse: new Response(JSON.stringify({ message: config.message }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    }),
  };
}

/** Strict rate limit: 5 requests per 15 minutes (for register) */
export const strictRateLimitOptions = createRateLimitOptions({
  prefix: 'rl:strict:',
  duration: 60_000 * 15,
  max: 5,
  message: 'Trop de tentatives. Veuillez réessayer dans 15 minutes.',
});

/** Auth rate limit: 10 requests per 15 minutes (for login) */
export const authRateLimitOptions = createRateLimitOptions({
  prefix: 'rl:auth:',
  duration: 60_000 * 15,
  max: 10,
  message: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.',
});

/** Checkout rate limit: 5 requests per minute */
export const checkoutRateLimitOptions = createRateLimitOptions({
  prefix: 'rl:checkout:',
  duration: 60_000,
  max: 5,
  message: 'Trop de tentatives de paiement. Veuillez réessayer dans une minute.',
});

/**
 * Webhook rate limit : 60 requêtes/minute par IP. Endpoint public appelé par le provider —
 * limite généreuse (les providers émettent des bursts) mais borne la surface DoS (vérification
 * de signature = coût crypto/API). Fail-open sans Redis, comme les autres limites.
 */
export const webhookRateLimitOptions = createRateLimitOptions({
  prefix: 'rl:webhook:',
  duration: 60_000,
  max: 60,
  message: 'Trop de requêtes webhook. Veuillez réessayer dans une minute.',
});

/** Contact form rate limit: 3 requests per 10 minutes */
export const contactRateLimitOptions = createRateLimitOptions({
  prefix: 'rl:contact:',
  duration: 60_000 * 10,
  max: 3,
  message: 'Trop de messages envoyés. Veuillez réessayer dans 10 minutes.',
});
