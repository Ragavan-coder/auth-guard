import { AuditRepository, AuditRecord } from '../repositories/audit.repository.js';
import { logger } from '../utils/logger.js';

export class AuditService {
  constructor(private auditRepo: AuditRepository = new AuditRepository()) {}

  public recordDecision(entry: AuditRecord): void {
    // Log structured event to pino logger (sanitized)
    logger.info(
      {
        requestId: entry.requestId,
        userId: entry.userId,
        action: entry.action,
        resource: entry.resource,
        decision: entry.decision,
        reasonCode: entry.reasonCode,
        matchedPolicyIds: entry.matchedPolicyIds
      },
      'Authorization decision evaluated'
    );

    // Persist to SQLite audit table
    this.auditRepo.record(entry);
  }
}
