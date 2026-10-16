import { normalizeResourcePath } from '../utils/path-normalizer.js';

export class ResourceResolverService {
  /**
   * Resolves a raw HTTP request path into a canonical resource identifier.
   */
  public resolve(rawPath: string): string {
    return normalizeResourcePath(rawPath);
  }
}
