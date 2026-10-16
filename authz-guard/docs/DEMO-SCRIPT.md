# AuthZ Guard: Timed Assessment Demo Script (2–3 Minutes)

This script provides an evaluator with an exact, reproducible walkthrough to assess AuthZ Guard in under 3 minutes.

---

## Prerequisites

- Node.js LTS (v20+ or v22+)
- Terminal in project directory `./authz-guard` (or workspace root with `npm --prefix authz-guard`)

---

## 0:00 – 0:30: Project Architecture & Automated Verification

### Step 1: Run Full Test Suite

Run the 73-test automated test suite verifying unit, integration, and end-to-end security scenarios:

```bash
npm test
```

_Expected output_: 12 test files passed, 73 tests passed (in ~5 seconds).

### Step 2: Run Strict Typecheck and Lint

```bash
npm run typecheck
npm run lint
```

_Expected output_: Zero errors, clean compile.

---

## 0:30 – 1:30: Executable Interactive Demo Script

Run the automated walkthrough script:

```bash
npm run demo
```

The script will automatically:

1. Initialize an isolated in-memory SQLite database.
2. Apply schema migrations.
3. Seed the official specification permissions (`user123`, `user456`, `user789`, `admin789`).
4. Generate an RSA-256 test keypair.
5. Execute and print the real HTTP evaluations for:
   - **ALLOW Scenario**: `user123` GET `/transactions` -> `ALLOW`
   - **Explicit Deny Scenario**: `user123` DELETE `/transactions/txn-456` -> `DENY` (`INHERITED_DENY`)
   - **Wildcard Nested Scenario**: `user789` POST `/wallets/wallet-456/transactions/txn-999` -> `ALLOW` (matches `wallets/*/transactions/*`)
   - **Missing Permission Scenario**: `user123` GET `/wallets/wallet-789` -> `DENY` (`NO_MATCHING_POLICY`)
   - **Expired Token Scenario**: Expired JWT -> HTTP 401 (`INVALID_TOKEN`)
   - **Path Traversal Attack Scenario**: `/transactions/../admin` -> HTTP 400 (`INVALID_REQUEST`)

---

## 1:30 – 2:30: Live Server & curl Demonstration

### Step 1: Start the Development Server

```bash
npm run dev
```

### Step 2: Open OpenAPI / Swagger Documentation

In your browser, visit:

```
http://localhost:3000/docs
```

Explore the interactive API contract with pre-populated examples.

### Step 3: Check Health Endpoints

```bash
curl -i http://localhost:3000/health/live
curl -i http://localhost:3000/health/ready
```

---

## 2:30 – 3:00: Precedence & Specificity Summary

Explain the 3 key design guarantees:

1. **Explainable Determinism**: Decisions are derived strictly via a 4-dimensional specificity vector, not arbitrary SQLite row order.
2. **Deny Wins Ties**: At the highest applicable specificity tier, any matching deny wins. Broader inherited denies can be overridden by explicit, narrower item allows.
3. **Fail-Closed Security**: Any database unavailability, token signature mismatch, or missing permission defaults to `DENY` or non-200 safe error.
