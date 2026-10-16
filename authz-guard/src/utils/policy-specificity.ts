import { SpecificityScore } from '../domain/policy.types.js';

/**
 * Calculates the specificity ranking score of a matching policy pattern
 * relative to a canonical target resource path.
 *
 * Ranking criteria (in priority order):
 * 1. Scope Tier:
 *    4: Exact literal match (resource === pattern, no wildcards)
 *    3: Wildcard pattern matching segments (e.g. wallets/* or wallets/*\/transactions/*)
 *    2: Literal collection inheritance (e.g. 'transactions' on 'transactions/txn-123')
 *    1: Global wildcard ('*')
 * 2. Fixed segment count (higher count = narrower scope)
 * 3. Wildcard segment count (lower count = narrower scope)
 * 4. Pattern segment depth (deeper pattern = more specific)
 */
export function calculateSpecificity(pattern: string, resource: string): SpecificityScore {
  if (pattern === '*') {
    return {
      scopeTier: 1,
      fixedSegments: 0,
      wildcardSegments: 1,
      patternDepth: 1
    };
  }

  if (pattern === resource) {
    const segs = pattern.split('/');
    return {
      scopeTier: 4,
      fixedSegments: segs.length,
      wildcardSegments: 0,
      patternDepth: segs.length
    };
  }

  if (!pattern.includes('*')) {
    // Literal collection inheritance (e.g., 'transactions' matching 'transactions/txn-123')
    const segs = pattern.split('/');
    return {
      scopeTier: 2,
      fixedSegments: segs.length,
      wildcardSegments: 0,
      patternDepth: segs.length
    };
  }

  // Wildcard pattern match
  const segs = pattern.split('/');
  let fixedCount = 0;
  let wildCount = 0;

  for (const seg of segs) {
    if (seg === '*') {
      wildCount++;
    } else {
      fixedCount++;
    }
  }

  return {
    scopeTier: 3,
    fixedSegments: fixedCount,
    wildcardSegments: wildCount,
    patternDepth: segs.length
  };
}

/**
 * Compares two specificity scores.
 * Returns:
 * > 0 if scoreA is more specific than scoreB
 * < 0 if scoreB is more specific than scoreA
 *   0 if scoreA and scoreB have equal specificity
 */
export function compareSpecificity(scoreA: SpecificityScore, scoreB: SpecificityScore): number {
  // 1. Scope tier comparison
  if (scoreA.scopeTier !== scoreB.scopeTier) {
    return scoreA.scopeTier - scoreB.scopeTier;
  }

  // 2. Fixed segment count (more fixed segments = more specific)
  if (scoreA.fixedSegments !== scoreB.fixedSegments) {
    return scoreA.fixedSegments - scoreB.fixedSegments;
  }

  // 3. Wildcard segment count (fewer wildcards = more specific)
  if (scoreA.wildcardSegments !== scoreB.wildcardSegments) {
    return scoreB.wildcardSegments - scoreA.wildcardSegments;
  }

  // 4. Pattern depth (deeper pattern = more specific)
  if (scoreA.patternDepth !== scoreB.patternDepth) {
    return scoreA.patternDepth - scoreB.patternDepth;
  }

  return 0;
}
