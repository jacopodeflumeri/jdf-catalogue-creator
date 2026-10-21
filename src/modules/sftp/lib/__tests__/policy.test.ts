/** @jest-environment node */

/**
 * Tests for the SFTP transfer policy.
 *
 * These checks previously lived only in the upload component, so calling the
 * server action directly bypassed both the size cap and the extension
 * allowlist. They are enforced server-side now; this pins that behaviour.
 */

jest.mock('@/config/env', () => ({
  env: { SFTP_MAX_FILE_BYTES: 25 * 1024 * 1024 },
}));

import { checkUpload, defaultSftpPolicy, fileExtension } from '../policy';
import type { SftpPolicy } from '../policy';

describe('fileExtension', () => {
  it.each([
    ['data.csv', 'csv'],
    ['DATA.CSV', 'csv'],
    ['archive.tar.gz', 'gz'],
    ['noextension', null],
    ['.hidden', null],
  ])('extracts from %p', (name, expected) => {
    expect(fileExtension(name)).toBe(expected);
  });
});

describe('checkUpload', () => {
  it('accepts an allowed type within the size cap', () => {
    expect(checkUpload('report.csv', 1024)).toBeNull();
  });

  it('rejects a disallowed extension', () => {
    expect(checkUpload('payload.sh', 1024)).toMatch(/not allowed/i);
  });

  it('rejects a file with no extension', () => {
    expect(checkUpload('payload', 1024)).toMatch(/not allowed/i);
  });

  it('rejects an empty file', () => {
    expect(checkUpload('report.csv', 0)).toMatch(/empty/i);
  });

  it('rejects a file over the size cap', () => {
    expect(checkUpload('report.csv', 26 * 1024 * 1024)).toMatch(/limit/i);
  });

  it('accepts a file exactly at the cap', () => {
    expect(checkUpload('report.csv', 25 * 1024 * 1024)).toBeNull();
  });

  it('refuses everything when writes are disabled', () => {
    const readOnly: SftpPolicy = { ...defaultSftpPolicy, allowWrites: false };
    expect(checkUpload('report.csv', 1024, readOnly)).toMatch(/disabled/i);
  });

  it('allows any extension when the allowlist is null', () => {
    const open: SftpPolicy = {
      ...defaultSftpPolicy,
      allowedUploadExtensions: null,
    };
    expect(checkUpload('payload.sh', 1024, open)).toBeNull();
  });
});
