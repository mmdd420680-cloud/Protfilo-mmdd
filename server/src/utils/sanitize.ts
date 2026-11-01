import crypto from 'crypto';

/**
 * Recursively strips keys starting with '$' or containing '.' to prevent NoSQL operator injection,
 * and trims dangerous script/null-byte payloads from string inputs.
 */
export function sanitizePayload<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    return input.replace(/\0/g, '').trim() as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizePayload(item)) as unknown as T;
  }

  if (typeof input === 'object') {
    const cleanObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (key.startsWith('$') || key.includes('.')) {
        continue;
      }
      cleanObj[key] = sanitizePayload(value);
    }
    return cleanObj as T;
  }

  return input;
}

/**
 * Generates a privacy-preserving daily visitor identifier hash without storing raw IP addresses.
 */
export function createPrivacyVisitorHash(ip: string, userAgent: string, dateBucket: string): string {
  return crypto
    .createHash('sha256')
    .update(`${ip || 'unknown'}::${userAgent || 'ua'}::${dateBucket}`)
    .digest('hex')
    .slice(0, 24);
}

/**
 * Generates URL-friendly slugs from titles.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Safely parses a positive integer query parameter with fallback and upper bound,
 * preventing NaN skip/limit database errors on malformed query strings.
 */
export function parsePositiveInt(raw: unknown, fallback: number, max = 100): number {
  const parsed = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(max, Math.floor(parsed));
}

/**
 * Strips keys whose values are undefined so partial updates never overwrite existing fields.
 */
export function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}

/**
 * Validates that a link or asset reference is empty, a safe relative path, hash anchor,
 * or uses an explicit safe protocol (http, https, mailto, tel), blocking javascript:/data:/vbscript:.
 */
export function isSafeUrlOrPath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return false;

  if (trimmed.startsWith('/')) {
    return !trimmed.startsWith('//');
  }
  if (trimmed.startsWith('#')) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Validates iframe embed URLs (must be empty or valid https:// URL).
 */
export function isSafeHttpsEmbedUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol.toLowerCase() === 'https:';
  } catch {
    return false;
  }
}
