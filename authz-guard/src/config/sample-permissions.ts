import { Action, Effect } from '../domain/authorization.types.js';

export interface SamplePermissionRecord {
  user_id: string;
  action: Action;
  resource: string;
  effect: Effect;
}

export const SAMPLE_PERMISSIONS: ReadonlyArray<SamplePermissionRecord> = Object.freeze([
  {
    user_id: 'user123',
    action: 'read',
    resource: 'transactions',
    effect: 'allow'
  },
  {
    user_id: 'user123',
    action: 'write',
    resource: 'transactions',
    effect: 'allow'
  },
  {
    user_id: 'user123',
    action: 'delete',
    resource: 'transactions',
    effect: 'deny'
  },
  {
    user_id: 'user123',
    action: 'read',
    resource: 'accounts',
    effect: 'allow'
  },
  {
    user_id: 'user456',
    action: 'read',
    resource: 'wallets/*',
    effect: 'allow'
  },
  {
    user_id: 'user456',
    action: 'write',
    resource: 'wallets/wallet-789',
    effect: 'allow'
  },
  {
    user_id: 'user456',
    action: 'read',
    resource: 'wallets/wallet-789/transactions',
    effect: 'allow'
  },
  {
    user_id: 'user789',
    action: 'write',
    resource: 'wallets/*/transactions/*',
    effect: 'allow'
  },
  {
    user_id: 'admin789',
    action: 'read',
    resource: '*',
    effect: 'allow'
  },
  {
    user_id: 'admin789',
    action: 'write',
    resource: '*',
    effect: 'allow'
  },
  {
    user_id: 'admin789',
    action: 'delete',
    resource: '*',
    effect: 'allow'
  }
]);
