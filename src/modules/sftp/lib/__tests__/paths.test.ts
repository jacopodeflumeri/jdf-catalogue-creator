/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- getSftpAppRoot reads
 * `env` at call time, but the app-prefix tests need different env values per
 * case, so they re-require the module after jest.resetModules(). ESM imports are
 * hoisted and cached and cannot express that. */

/**
 * Tests for SFTP path confinement.
 *
 * This is the security boundary of the SFTP capability: every remote path the
 * module touches is resolved here. The previous implementation used a regex
 * that did not resolve `..`, and no caller joined to the configured root, so
 * `/etc/passwd` reached the server verbatim. These tests exist to keep that
 * from coming back.
 */

const mockEnv: Record<string, unknown> = {};

jest.mock('@/config/env', () => ({
  get env() {
    return mockEnv;
  },
}));

jest.mock('../../../../../app.config.json', () => ({ appName: 'myapp' }), {
  virtual: true,
});

function freshModule() {
  jest.resetModules();
  return require('../paths');
}

beforeEach(() => {
  for (const key of Object.keys(mockEnv)) delete mockEnv[key];
  mockEnv.SFTP_ROOT_PATH = '/srv/sftp';
});

describe('getSftpAppRoot', () => {
  it('appends the app slug to the configured root', () => {
    expect(freshModule().getSftpAppRoot()).toBe('/srv/sftp/myapp');
  });

  it('handles a root of / without doubling the separator', () => {
    mockEnv.SFTP_ROOT_PATH = '/';
    expect(freshModule().getSftpAppRoot()).toBe('/myapp');
  });

  it('normalizes a messy configured root', () => {
    mockEnv.SFTP_ROOT_PATH = '/srv//sftp/./';
    expect(freshModule().getSftpAppRoot()).toBe('/srv/sftp/myapp');
  });

  it('drops the app component when SFTP_DISABLE_APP_PREFIX is set', () => {
    mockEnv.SFTP_DISABLE_APP_PREFIX = true;
    expect(freshModule().getSftpAppRoot()).toBe('/srv/sftp');
  });
});

describe('resolveSftpPath', () => {
  it('resolves a relative path under the app root', () => {
    expect(freshModule().resolveSftpPath('reports/q3.csv')).toBe(
      '/srv/sftp/myapp/reports/q3.csv'
    );
  });

  it('treats a leading slash as the app root, not the filesystem root', () => {
    expect(freshModule().resolveSftpPath('/reports')).toBe(
      '/srv/sftp/myapp/reports'
    );
  });

  it('returns the root itself for empty input', () => {
    const { resolveSftpPath } = freshModule();
    expect(resolveSftpPath('')).toBe('/srv/sftp/myapp');
    expect(resolveSftpPath('/')).toBe('/srv/sftp/myapp');
  });

  it('collapses redundant separators and dot segments', () => {
    expect(freshModule().resolveSftpPath('a//b/./c')).toBe(
      '/srv/sftp/myapp/a/b/c'
    );
  });

  it('resolves .. within the root', () => {
    expect(freshModule().resolveSftpPath('a/b/../c')).toBe(
      '/srv/sftp/myapp/a/c'
    );
  });

  // The original report: plain /etc/passwd reached the server untouched.
  it('confines an absolute-looking system path to the app root', () => {
    expect(freshModule().resolveSftpPath('/etc/passwd')).toBe(
      '/srv/sftp/myapp/etc/passwd'
    );
  });

  describe('rejects traversal', () => {
    const escapes = [
      '..',
      '../',
      '../etc/passwd',
      '../../../../etc/passwd',
      'a/../../etc/passwd',
      '/../etc/passwd',
      'a/b/../../../c',
      '..\\..\\etc\\passwd',
    ];

    it.each(escapes)('throws for %p', (attempt) => {
      const { resolveSftpPath, SftpPathError } = freshModule();
      expect(() => resolveSftpPath(attempt)).toThrow(SftpPathError);
    });
  });

  it('rejects NUL bytes', () => {
    const { resolveSftpPath, SftpPathError } = freshModule();
    expect(() => resolveSftpPath('a\0b')).toThrow(SftpPathError);
  });

  it('rejects non-string input', () => {
    const { resolveSftpPath, SftpPathError } = freshModule();
    expect(() => resolveSftpPath(42 as unknown as string)).toThrow(
      SftpPathError
    );
  });

  it('still confines when the app prefix is disabled', () => {
    mockEnv.SFTP_DISABLE_APP_PREFIX = true;
    const { resolveSftpPath, SftpPathError } = freshModule();
    expect(resolveSftpPath('x')).toBe('/srv/sftp/x');
    expect(() => resolveSftpPath('../etc/passwd')).toThrow(SftpPathError);
  });
});

describe('toDisplayPath', () => {
  it('strips the app root', () => {
    expect(freshModule().toDisplayPath('/srv/sftp/myapp/reports/q3.csv')).toBe(
      '/reports/q3.csv'
    );
  });

  it('maps the root itself to /', () => {
    expect(freshModule().toDisplayPath('/srv/sftp/myapp')).toBe('/');
  });

  it('refuses to display a path outside the root', () => {
    const { toDisplayPath, SftpPathError } = freshModule();
    expect(() => toDisplayPath('/etc/passwd')).toThrow(SftpPathError);
  });
});
