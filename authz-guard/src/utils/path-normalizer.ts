import { InvalidRequestError } from '../domain/authorization.errors.js';

// Valid segment characters: standard unreserved URI characters plus colons
const SEGMENT_REGEX = /^[A-Za-z0-9._~:-]+$/;

/**
 * Normalizes an origin-form HTTP path into a canonical resource identifier.
 * Enforces strict security boundaries against path traversal, ambiguous separators,
 * control characters, and malformed encodings.
 */
export function normalizeResourcePath(rawPath: string): string {
  if (typeof rawPath !== 'string' || rawPath.length === 0) {
    throw new InvalidRequestError('Resource path must be a non-empty string.');
  }

  if (rawPath.length > 2048) {
    throw new InvalidRequestError('Resource path exceeds maximum length of 2048 characters.');
  }

  // Must begin with a single slash (origin-form absolute path)
  if (!rawPath.startsWith('/')) {
    throw new InvalidRequestError('Resource path must begin with a forward slash ("/").');
  }

  // Reject query strings, URL fragments, backslashes, and duplicate slashes
  if (rawPath.includes('?') || rawPath.includes('#')) {
    throw new InvalidRequestError('Resource path must not contain query parameters or fragments.');
  }

  if (rawPath.includes('\\')) {
    throw new InvalidRequestError('Resource path must not contain backslashes.');
  }

  if (rawPath.includes('//')) {
    throw new InvalidRequestError('Resource path must not contain duplicate slashes.');
  }

  // Reject control characters (0x00-0x1F, 0x7F)
  for (let i = 0; i < rawPath.length; i++) {
    const code = rawPath.charCodeAt(i);
    if ((code >= 0 && code <= 31) || code === 127) {
      throw new InvalidRequestError('Resource path must not contain control characters.');
    }
  }

  // Reject encoded slashes (%2f), backslashes (%5c), or malformed percent-encoding
  if (/%(?:2f|5c)/i.test(rawPath)) {
    throw new InvalidRequestError('Resource path must not contain encoded path separators.');
  }

  // Check for malformed percent encoding: '%' not followed by two hex digits
  if (/%(?![0-9A-Fa-f]{2})/i.test(rawPath)) {
    throw new InvalidRequestError('Resource path contains malformed percent-encoding.');
  }

  // Remove leading slash and split into segments
  let pathWithoutLeading = rawPath.slice(1);

  // Remove harmless trailing slash
  if (pathWithoutLeading.endsWith('/') && pathWithoutLeading.length > 0) {
    pathWithoutLeading = pathWithoutLeading.slice(0, -1);
  }

  if (pathWithoutLeading === '') {
    // Root path '/'
    return '';
  }

  const rawSegments = pathWithoutLeading.split('/');
  const normalizedSegments: string[] = [];

  for (const rawSeg of rawSegments) {
    if (!rawSeg) {
      throw new InvalidRequestError('Resource path contains empty segments.');
    }

    let decodedSeg: string;
    try {
      decodedSeg = decodeURIComponent(rawSeg);
    } catch {
      throw new InvalidRequestError('Resource path contains invalid URI percent-encoding.');
    }

    // Traversal check (dot segments)
    if (decodedSeg === '.' || decodedSeg === '..' || decodedSeg.includes('..')) {
      throw new InvalidRequestError('Resource path traversal attempts are strictly forbidden.');
    }

    // Segment character validation
    if (!SEGMENT_REGEX.test(decodedSeg)) {
      throw new InvalidRequestError(
        `Resource path segment '${decodedSeg}' contains illegal characters.`
      );
    }

    normalizedSegments.push(decodedSeg);
  }

  return normalizedSegments.join('/');
}
