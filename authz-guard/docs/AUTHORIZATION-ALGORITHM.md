# AuthZ Guard: Authorization Policy & Precedence Algorithm

## 1. Overview & Core Philosophy

AuthZ Guard implements a **deterministic, explainable, and fail-closed** authorization policy engine. Policy evaluation never relies on SQLite table insertion order or non-deterministic hash iteration. Given identical inputs and permissions, the evaluation result is provably identical.

---

## 2. Decision Pipeline

```
1. Ingress Method & Path
       |
       v
2. Method Mapping (GET -> read, POST/PUT/PATCH -> write, DELETE -> delete)
       |
       v
3. Path Normalization (strip trailing slash, prevent traversal, resolve canonical resource)
       |
       v
4. Database Query (retrieve rules where user_id = :sub AND action IN (:action, '*'))
       |
       v
5. Pattern Matching (literal, wildcard, and hierarchical inheritance)
       |
   [0 matches] ---> RETURN DENY (NO_MATCHING_POLICY)
       |
   [>= 1 match]
       |
       v
6. Specificity Ranking (rank candidate rules by effective matched scope)
       |
       v
7. Select Highest Specificity Tier
       |
       +---> Contains any 'deny' rule? ---> RETURN DENY (EXPLICIT_DENY / INHERITED_DENY)
       |
       +---> All rules are 'allow'?   ---> RETURN ALLOW (POLICY_ALLOW)
```

---

## 3. Wildcard and Inheritance Semantics

### 3.1 Global Wildcard (`*`)

- A resource pattern of `'*'` matches every valid canonical resource path.
- It operates at the broadest possible scope (Scope Tier 1).

### 3.2 Internal Wildcard (`*`)

- An asterisk surrounded by slashes (e.g. `wallets/*/transactions/*`) matches **exactly one path segment** at that position.
- Example: `wallets/*/transactions` matches `wallets/wallet-1/transactions`, but **not** `wallets/wallet-1/sub/transactions`.

### 3.3 Terminal Wildcard (`/*`)

- A trailing `/*` matches **zero or more trailing segments** following the fixed prefix.
- Examples:
  - Pattern: `wallets/*` matches:
    - `wallets/wallet-789` (1 trailing segment)
    - `wallets/wallet-789/transactions` (2 trailing segments)
    - `wallets/wallet-789/transactions/txn-999` (3 trailing segments)
  - Pattern: `wallets/*/transactions/*` matches:
    - `wallets/wallet-789/transactions` (0 trailing segments after prefix)
    - `wallets/wallet-789/transactions/txn-999` (1 trailing segment after prefix)
    - Does **not** match `wallets/wallet-789/accounts` (segment mismatch on `transactions`).

### 3.4 Literal Collection Inheritance

- A literal single-segment collection policy (e.g. `transactions`) inherits to the collection itself and all descendant items (`transactions/txn-123`, `transactions/txn-123/receipts`).
- Multi-segment literal entity paths (e.g. `wallets/wallet-789`) apply strictly to the entity itself unless an explicit terminal wildcard (`wallets/wallet-789/*`) is used. This prevents inadvertent privilege escalation where access to an entity unintentionally grants write access to sensitive sub-collections.

---

## 4. Specificity Ranking Model

Matching policies are ranked using a 4-dimensional specificity vector:

$$\text{Rank} = \langle \text{ScopeTier}, \text{FixedSegments}, -\text{WildcardSegments}, \text{PatternDepth} \rangle$$

1. **Scope Tier** (primary comparator):
   - **Tier 4 (Exact Literal Match)**: $P \equiv R$ with no wildcards.
   - **Tier 3 (Wildcard Pattern Match)**: Patterns with internal or terminal wildcards.
   - **Tier 2 (Collection Inheritance)**: Literal collection prefix inherited by descendant.
   - **Tier 1 (Global Wildcard)**: `'*'`.
2. **Fixed Segments**: More fixed literal string segments denote a narrower, more constrained pattern.
3. **Wildcard Segments**: Fewer wildcard segments denote higher specificity among patterns with identical fixed segment counts.
4. **Pattern Depth**: Deeper path segment length denotes higher specificity.

---

## 5. Precedence Rules & Worked Scenarios

### Rule 1: Deny Wins Ties at Equal Specificity

When multiple matching rules share the identical highest specificity score, `deny` takes precedence over `allow`.

### Rule 2: Specificity Trumps Breadth

A narrower, higher-specificity `allow` rule overrides a broader, lower-specificity `deny` rule. Conversely, a narrower, higher-specificity `deny` overrides a broader `allow`.

### Rule 3: Default Deny

If no policies match the requested user, action, and resource, access is denied with reason code `NO_MATCHING_POLICY`.

---

## 6. Worked Examples

### Example A: Inherited Explicit Denial

- **User**: `user123`
- **Request**: `DELETE /transactions/txn-456`
- **Applicable Rules**:
  - `id: 3, action: delete, resource: transactions, effect: deny`
- **Evaluation**:
  - `transactions` matches `transactions/txn-456` via Collection Inheritance (Scope Tier 2).
  - Highest specificity tier contains `id: 3` (`deny`).
- **Outcome**: `DENY`, Reason Code: `INHERITED_DENY`.

### Example B: Specific Allow Overrides Inherited Broad Deny

- **User**: `user123`
- **Request**: `GET /transactions/txn-special`
- **Applicable Rules**:
  - `id: 1, action: read, resource: transactions, effect: deny` (Tier 2)
  - `id: 2, action: read, resource: transactions/txn-special, effect: allow` (Tier 4)
- **Evaluation**:
  - Rule 2 (Tier 4 exact match) outranks Rule 1 (Tier 2 collection inheritance).
  - Winning rule is Rule 2 (`allow`).
- **Outcome**: `ALLOW`, Reason Code: `POLICY_ALLOW`.

### Example C: Terminal Wildcard & Zero Trailing Segments

- **User**: `user789`
- **Request**: `POST /wallets/wallet-789/transactions`
- **Applicable Rules**:
  - `id: 8, action: write, resource: wallets/*/transactions/*, effect: allow`
- **Evaluation**:
  - Fixed prefix `wallets/*/transactions` matches the 3 segments of `/wallets/wallet-789/transactions`.
  - Terminal `/*` matches 0 trailing segments.
- **Outcome**: `ALLOW`, Reason Code: `POLICY_ALLOW`.
