# Transaction Safeguards - Preventing Fund Loss

## Incident Report
**Date**: 2025-11-19
**Issue**: User swap failed after TX1 completed, causing temporary fund loss
**Root Cause**: Backend TX2 failed with "Pool not found" error due to async pool discovery
**Impact**: User sent KTA to pool but didn't receive output tokens

**This would destroy user trust in production. Implementing comprehensive safeguards.**

---

## Current Risk: Two-Transaction Flow

### How It Works (Keythings Wallets)
1. **TX1**: User signs transaction to send tokens to pool
2. **TX2**: Backend sends tokens back to user using SEND_ON_BEHALF

### The Danger
```
TX1 succeeds → User tokens sent to pool ✅
TX2 fails → User doesn't get output tokens ❌
Result: User loses funds 🚨
```

---

## Implemented Safeguards ✅

### 1. On-Demand Pool Loading (DONE)
**Files**: `swap-keythings.js`, `liquidity-keythings.js`
- Added `getPoolInstance()` helper
- Loads pools from database if not in memory
- Prevents "Pool not found" errors

### 2. Transaction State Tracking (READY TO DEPLOY)
**Files**:
- `db/transaction-state.js` - State tracking functions
- `db/migrations/004_transaction_state_tracking.sql` - Database schema

**Tracks every transaction through states:**
```
PENDING_TX1 → TX1_COMPLETE → TX2_COMPLETE (success)
                          ↘ TX2_FAILED → RECOVERED (manual)
```

**Benefits:**
- Identify stuck transactions automatically
- Enable manual recovery of failed TX2s
- Audit trail for debugging
- Alert admins of failures

---

## Required Safeguards (TO IMPLEMENT)

### Priority 1: CRITICAL (Before Mainnet) 🚨

#### A. Pre-Flight Validation Endpoint
**Purpose**: Check if TX2 will succeed BEFORE user sends TX1

**Implementation**:
```javascript
POST /api/swap/keythings/preflight
Body: { userAddress, poolAddress, tokenIn, tokenOut, amountIn }

Response: {
  canProceed: true/false,
  reason: "Pool loaded and ready" | "Pool not found" | "Insufficient liquidity",
  estimatedOutput: "1234567890" // if canProceed=true
}
```

**Frontend Flow**:
1. User enters swap amount
2. Call preflight endpoint
3. If `canProceed=false`: Show error, prevent TX1
4. If `canProceed=true`: Allow user to sign TX1

#### B. TX2 Retry Logic with Exponential Backoff
**Purpose**: Don't give up on TX2 after single failure

**Implementation**:
```javascript
async function executeTX2WithRetry(txParams, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await executeTX2(txParams);
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
      console.log(`🔄 Retrying TX2 (attempt ${i + 2}/${maxRetries})...`);
    }
  }
}
```

#### C. Manual Recovery Endpoint (Admin Only)
**Purpose**: Recover stuck transactions manually

**Implementation**:
```javascript
POST /api/admin/recover-transaction
Headers: { Authorization: "Bearer ADMIN_SECRET" }
Body: { transactionId: "uuid" }

Response: {
  success: true,
  recoveryTxHash: "0x...",
  userAddress: "keeta_...",
  amountRecovered: "1234567890"
}
```

**Usage**:
1. Query failed transactions: `SELECT * FROM pending_transactions WHERE state='TX2_FAILED'`
2. For each: Call recovery endpoint with transaction ID
3. Endpoint re-executes TX2 with stored parameters
4. Updates state to 'RECOVERED'

#### D. Circuit Breaker Pattern
**Purpose**: Stop accepting TX1s if backend is having issues

**Implementation**:
```javascript
class CircuitBreaker {
  constructor(threshold = 3, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN - backend temporarily unavailable');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      console.error(`🚨 Circuit breaker OPEN - ${this.failureCount} consecutive failures`);
      // TODO: Alert admins
    }
  }
}
```

---

### Priority 2: HIGH (Soon After Mainnet) ⚠️

#### E. Background Recovery Job
**Purpose**: Automatically retry failed TX2s

**Implementation**:
- Cron job runs every 5 minutes
- Queries `pending_transactions` for TX2_FAILED and stuck TX1_COMPLETE
- Automatically retries TX2 for each
- Alerts admin if retry fails 3 times

#### F. Health Check Endpoint
**Purpose**: Frontend can check backend health before allowing swaps

**Implementation**:
```javascript
GET /api/health

Response: {
  status: "healthy" | "degraded" | "down",
  checks: {
    database: true,
    opsClient: true,
    poolsLoaded: true,
    circuitBreaker: "CLOSED"
  }
}
```

#### G. Transaction Timeout Detection
**Purpose**: Alert if TX2 takes too long

**Implementation**:
- Monitor time between TX1_COMPLETE and TX2_COMPLETE
- Alert if > 30 seconds
- Auto-retry if > 60 seconds

---

### Priority 3: NICE TO HAVE (Future) 📋

#### H. User-Facing Recovery UI
- Users can see pending transactions
- Request manual recovery if stuck > 5 minutes
- View transaction status in real-time

#### I. Escrow Pattern (Architectural Change)
- User sends tokens to escrow address (not pool)
- Backend verifies, then atomically:
  - Transfer from escrow to pool
  - Transfer from pool to user
- If either fails, return tokens to user

#### J. Monitoring & Alerting
- Datadog/Sentry integration
- Alert on any TX2_FAILED
- Daily digest of transaction stats

---

## Implementation Checklist

### Phase 1: Emergency Safeguards (ASAP)
- [x] Fix "Pool not found" with on-demand loading
- [ ] Run database migration (004_transaction_state_tracking.sql)
- [ ] Integrate transaction state tracking into endpoints
- [ ] Create preflight validation endpoints
- [ ] Add TX2 retry logic
- [ ] Create admin recovery endpoint

### Phase 2: Production Hardening (Before Mainnet)
- [ ] Implement circuit breaker
- [ ] Add health check endpoint
- [ ] Set up monitoring alerts
- [ ] Test recovery procedures
- [ ] Document admin recovery process

### Phase 3: Long-term Improvements (Post-Mainnet)
- [ ] Background recovery job
- [ ] User-facing recovery UI
- [ ] Consider escrow pattern migration

---

## Testing Checklist

Before Mainnet:
- [ ] Simulate TX2 failure and test recovery
- [ ] Test preflight validation rejects bad requests
- [ ] Test retry logic with transient failures
- [ ] Test circuit breaker trips after 3 failures
- [ ] Test admin recovery endpoint
- [ ] Load test: 100 concurrent swaps
- [ ] Chaos test: Kill database mid-swap

---

## Monitoring Queries

**Find stuck transactions:**
```sql
SELECT * FROM pending_transactions
WHERE state = 'TX1_COMPLETE'
  AND tx1_completed_at < NOW() - INTERVAL '5 minutes';
```

**Find failed transactions:**
```sql
SELECT * FROM pending_transactions
WHERE state = 'TX2_FAILED'
ORDER BY tx2_failed_at DESC;
```

**Transaction success rate (last 24h):**
```sql
SELECT
  COUNT(*) FILTER (WHERE state = 'TX2_COMPLETE') as successful,
  COUNT(*) FILTER (WHERE state = 'TX2_FAILED') as failed,
  COUNT(*) FILTER (WHERE state = 'TX1_COMPLETE' AND tx1_completed_at < NOW() - INTERVAL '5 minutes') as stuck,
  ROUND(100.0 * COUNT(*) FILTER (WHERE state = 'TX2_COMPLETE') / NULLIF(COUNT(*), 0), 2) as success_rate
FROM pending_transactions
WHERE created_at > NOW() - INTERVAL '24 hours';
```

---

## Next Steps

1. **Immediate**: Deploy on-demand pool loading fix (already pushed)
2. **Today**: Run database migration for transaction tracking
3. **This Week**: Implement preflight validation and retry logic
4. **Before Mainnet**: Complete Phase 1 checklist
5. **Ongoing**: Monitor and improve

**Goal**: Zero fund loss incidents. User trust is non-negotiable.
