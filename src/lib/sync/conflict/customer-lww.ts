/**
 * LWW (Last-Write-Wins) Conflict Resolution for Customer Master Data.
 *
 * Implements a deterministic, mathematically commutative comparison between
 * two customer mutation stamps:
 *
 * Stamp = <version: number, clientCreatedAt: string, operationId: string>
 *
 * Ordering Rules:
 * 1. Primary: Causal version (higher mutation version dominates).
 * 2. Secondary: Physical/logical timestamp (clientCreatedAt in ms, later write wins).
 * 3. Tertiary: Deterministic tie-breaker via UUID lexicographical comparison (operationId).
 *
 * Guarantees:
 * - Deterministic on all nodes (Cloud, Depot).
 * - Total ordering: compare(a, b) === 0 iff a.operationId === b.operationId.
 * - Commutative: max(a, b) === max(b, a), ensuring identical state whether Push-before-Pull
 *   or Pull-before-Push occurs.
 */

export interface CustomerLwwStamp {
  version: number;
  clientCreatedAt: string; // ISO 8601 string
  operationId: string;     // UUID v4 idempotency key
}

export function compareCustomerLww(
  incoming: CustomerLwwStamp,
  current: CustomerLwwStamp
): number {
  // 1. Primary: Higher causal version dominates
  if (incoming.version !== current.version) {
    return incoming.version - current.version;
  }

  // 2. Secondary: Later client timestamp wins
  const incomingTime = new Date(incoming.clientCreatedAt).getTime();
  const currentTime = new Date(current.clientCreatedAt).getTime();
  if (incomingTime !== currentTime) {
    return incomingTime - currentTime;
  }

  // 3. Tertiary: Deterministic tie-breaker via operationId
  return incoming.operationId.localeCompare(current.operationId);
}
