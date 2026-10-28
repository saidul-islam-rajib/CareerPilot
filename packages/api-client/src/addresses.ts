const HTTPS_PROTOCOL = 'https:';
const SECURE_SCHEME = 'https://';
const INSECURE_SCHEME = /^http:\/\//i;
const SCHEME_PATTERN = /^[a-z]+:\/\//i;
const SITE_PREFIX = /^www\./;
const TRAILING_SLASHES = /\/+$/;

export function secureAddress(address: string): string {
  const trimmed = address.trim().replace(INSECURE_SCHEME, SECURE_SCHEME);
  return SCHEME_PATTERN.test(trimmed) ? trimmed : `${SECURE_SCHEME}${trimmed}`;
}

export function isHttpsAddress(address: string): boolean {
  try {
    const url = new URL(address.trim());
    return url.protocol === HTTPS_PROTOCOL && url.hostname.length > 0 && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function addressKey(address: string): string {
  try {
    const url = new URL(secureAddress(address).toLowerCase());
    return `${url.hostname.replace(SITE_PREFIX, '')}${url.pathname.replace(TRAILING_SLASHES, '')}${url.search}`;
  } catch {
    return address.trim().toLowerCase();
  }
}

export function sameAddress(left: string, right: string): boolean {
  return left.trim().length > 0 && right.trim().length > 0 && addressKey(left) === addressKey(right);
}

export function siteName(address: string): string {
  try {
    return new URL(secureAddress(address)).hostname.replace(SITE_PREFIX, '');
  } catch {
    return address.trim();
  }
}
