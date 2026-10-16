import { describe, it, expect } from 'vitest';
import { mapHttpMethodToAction } from '../../src/utils/http-method.mapper.js';
import { MethodNotAllowedError } from '../../src/domain/authorization.errors.js';

describe('HTTP Method to Action Mapper', () => {
  it('maps GET and HEAD to read action', () => {
    expect(mapHttpMethodToAction('GET')).toBe('read');
    expect(mapHttpMethodToAction('HEAD')).toBe('read');
    expect(mapHttpMethodToAction('get')).toBe('read');
    expect(mapHttpMethodToAction('head')).toBe('read');
    expect(mapHttpMethodToAction('  GET  ')).toBe('read');
  });

  it('maps POST, PUT, and PATCH to write action', () => {
    expect(mapHttpMethodToAction('POST')).toBe('write');
    expect(mapHttpMethodToAction('PUT')).toBe('write');
    expect(mapHttpMethodToAction('PATCH')).toBe('write');
    expect(mapHttpMethodToAction('post')).toBe('write');
    expect(mapHttpMethodToAction('put')).toBe('write');
    expect(mapHttpMethodToAction('patch')).toBe('write');
  });

  it('maps DELETE to delete action', () => {
    expect(mapHttpMethodToAction('DELETE')).toBe('delete');
    expect(mapHttpMethodToAction('delete')).toBe('delete');
  });

  it('rejects unsupported HTTP methods with MethodNotAllowedError (HTTP 405)', () => {
    const unsupported = ['OPTIONS', 'CONNECT', 'TRACE', 'CUSTOM', 'PURGE'];
    for (const method of unsupported) {
      expect(() => mapHttpMethodToAction(method)).toThrow(MethodNotAllowedError);
      try {
        mapHttpMethodToAction(method);
      } catch (err) {
        expect(err).toBeInstanceOf(MethodNotAllowedError);
        expect((err as MethodNotAllowedError).statusCode).toBe(405);
        expect((err as MethodNotAllowedError).errorCode).toBe('METHOD_NOT_ALLOWED');
      }
    }
  });

  it('rejects empty or malformed method input', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => mapHttpMethodToAction('' as any)).toThrow(MethodNotAllowedError);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => mapHttpMethodToAction(null as any)).toThrow(MethodNotAllowedError);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => mapHttpMethodToAction(undefined as any)).toThrow(MethodNotAllowedError);
  });
});
