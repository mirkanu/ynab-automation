import { describe, it } from 'vitest';

describe('generateMailboxHash', () => {
  it.todo('returns a string with user_ prefix');
  it.todo('returns different hashes for different userIds');
  it.todo('same userId always produces same hash (deterministic)');
  it.todo('hash does not contain plaintext userId');
});

describe('assignForwardingAddress', () => {
  it.todo('generates and stores forwardingEmail on User row');
  it.todo('creates EmailForwardingAddress record with matching mailboxHash');
  it.todo('idempotent: calling twice for same user does not create duplicate');
});
