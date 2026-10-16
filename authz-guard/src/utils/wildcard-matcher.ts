/**
 * Deterministic segment-aware wildcard and hierarchical inheritance matcher.
 *
 * Rules:
 * - '*' alone: matches every valid resource path.
 * - Literal top-level collection ('transactions'): matches exact and descendants at segment boundaries ('transactions/txn-123').
 * - Literal multi-segment entity ('wallets/wallet-789'): matches exact entity only.
 * - Internal '*': matches exactly one path segment.
 * - Terminal '/*': matches zero or more trailing segments after the preceding prefix.
 */
export function matchResource(pattern: string, resource: string): boolean {
  if (!pattern || typeof pattern !== 'string') {
    return false;
  }
  if (typeof resource !== 'string') {
    return false;
  }

  // 1. Global wildcard matches everything
  if (pattern === '*') {
    return true;
  }

  // 2. Exact match
  if (pattern === resource) {
    return true;
  }

  // 3. Literal patterns (no wildcards)
  if (!pattern.includes('*')) {
    // Top-level collection inheritance: if pattern is a single collection segment (no '/'),
    // it applies to the collection and its descendant items.
    if (!pattern.includes('/')) {
      return resource.startsWith(pattern + '/');
    }
    // Multi-segment literal entity: requires exact match
    return false;
  }

  // 4. Wildcard patterns
  const pSegs = pattern.split('/');
  const rSegs = resource.split('/');

  const isTerminalWildcard = pattern.endsWith('/*');

  if (isTerminalWildcard) {
    // Prefix length before terminal '/*'
    const prefixLen = pSegs.length - 1;
    if (rSegs.length < prefixLen) {
      return false;
    }

    for (let i = 0; i < prefixLen; i++) {
      const p = pSegs[i];
      const r = rSegs[i];
      if (p !== '*' && p !== r) {
        return false;
      }
    }

    // Terminal '/*' matches zero or more trailing segments after the prefix
    return true;
  }

  // Pattern with internal wildcards but no terminal wildcard: requires exact segment count
  if (pSegs.length !== rSegs.length) {
    return false;
  }

  for (let i = 0; i < pSegs.length; i++) {
    const p = pSegs[i];
    const r = rSegs[i];
    if (p !== '*' && p !== r) {
      return false;
    }
  }

  return true;
}
