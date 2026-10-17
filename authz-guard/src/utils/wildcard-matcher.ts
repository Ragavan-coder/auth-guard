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

  // Canonicalize leading and trailing slashes for comparison
  const p = pattern === '*' ? '*' : pattern.replace(/^\/+/, '').replace(/\/+$/, '');
  const r = resource === '*' ? '*' : resource.replace(/^\/+/, '').replace(/\/+$/, '');

  // 1. Global wildcard matches everything
  if (p === '*') {
    return true;
  }

  // 2. Exact match
  if (p === r) {
    return true;
  }

  // 3. Literal patterns (no wildcards)
  if (!p.includes('*')) {
    // Top-level collection inheritance: if pattern is a single collection segment (no '/'),
    // it applies to the collection and its descendant items.
    if (!p.includes('/')) {
      return r.startsWith(p + '/');
    }
    // Multi-segment literal entity: requires exact match
    return false;
  }

  // 4. Wildcard patterns
  const pSegs = p.split('/');
  const rSegs = r.split('/');

  const isTerminalWildcard = p.endsWith('/*');

  if (isTerminalWildcard) {
    // Prefix length before terminal '/*'
    const prefixLen = pSegs.length - 1;
    if (rSegs.length < prefixLen) {
      return false;
    }

    for (let i = 0; i < prefixLen; i++) {
      const pSeg = pSegs[i];
      const rSeg = rSegs[i];
      if (pSeg !== '*' && pSeg !== rSeg) {
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
    const pSeg = pSegs[i];
    const rSeg = rSegs[i];
    if (pSeg !== '*' && pSeg !== rSeg) {
      return false;
    }
  }

  return true;
}
