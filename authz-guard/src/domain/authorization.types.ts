

export type Action = 'read' | 'write' | 'delete';
export type Decision = 'ALLOW' | 'DENY';
export type Effect = 'allow' | 'deny';
export interface AuthorizeRequestBody {
  access_token: string;
  method: string;
  path: string;
}
export interface MatchedPermission {
  id: number;
  action: Action;
  resource: string;
  effect: Effect;
}
export interface AuthorizeSuccessResponse {
  decision: Decision;
  user_id: string;
  action: Action;
  resource: string;
  reason_code: string;
  reason: string;
  matched_permissions: MatchedPermission[];
  request_id: string;
}
export interface SafeErrorPayload {
  error: {
    code: string;
    message: string;
    request_id?: string;
    details?: unknown;
  };
}
