/**
 * URL validation utility to prevent open redirect vulnerabilities.
 * Only allows redirect URLs to whitelisted domains (STORE_URL, ADMIN_URL).
 */

function getAllowedHosts(): string[] {
  const hosts: string[] = [];

  const storeUrl = process.env.STORE_URL;
  const adminUrl = process.env.ADMIN_URL;

  if (storeUrl) {
    try {
      hosts.push(new URL(storeUrl).hostname);
    } catch {
      // Invalid URL, ignore
    }
  }

  if (adminUrl) {
    try {
      hosts.push(new URL(adminUrl).hostname);
    } catch {
      // Invalid URL, ignore
    }
  }

  // Allow localhost in development
  if (process.env.NODE_ENV !== 'production') {
    hosts.push('localhost', '127.0.0.1');
  }

  return hosts;
}

/**
 * Check if a URL is allowed for redirects.
 * Returns true if the URL's hostname is in the whitelist.
 */
export function isAllowedRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const allowedHosts = getAllowedHosts();

    // Must be http or https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // In production, require HTTPS
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      return false;
    }

    // Check if hostname is in allowed list
    return allowedHosts.some((host) => parsed.hostname === host);
  } catch {
    return false;
  }
}

/**
 * Validate successUrl and cancelUrl for checkout.
 * Returns an error message if validation fails, null otherwise.
 */
export function validateCheckoutUrls(successUrl: string, cancelUrl: string): string | null {
  if (!isAllowedRedirectUrl(successUrl)) {
    return 'URL de redirection succès non autorisée';
  }

  if (!isAllowedRedirectUrl(cancelUrl)) {
    return 'URL de redirection annulation non autorisée';
  }

  return null;
}
