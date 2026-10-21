/**
 * @jest-environment node
 */
const mockConfig = {
  auth: {
    secret: 'valid-secret-with-at-least-32-chars-for-testing-purposes',
  },
  azure: {
    clientId: 'valid-azure-client-id',
    clientSecret: 'valid-azure-secret-with-32-chars',
    tenantId: 'valid-azure-tenant-id',
  },
  keycloak: {
    enabled: false,
    issuer: '',
    clientId: '',
    clientSecret: '',
  },
  app: {
    isDevelopment: true,
    url: 'http://localhost:3000',
  },
};

jest.mock('@/config', () => ({
  get config() {
    return mockConfig;
  },
}));

jest.mock('../logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  validateEnvironmentSecurity,
  sanitizeInput,
  validateSecureEmail,
  generateSecureToken,
  checkRateLimit,
  validateFileUpload,
} from '../security';

describe('Security Utils', () => {
  describe('validateEnvironmentSecurity', () => {
    it('should pass with valid environment variables', () => {
      const result = validateEnvironmentSecurity();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect short secrets as warnings', () => {
      const originalSecret = mockConfig.auth.secret;
      mockConfig.auth.secret = 'short';

      const result = validateEnvironmentSecurity();
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w: string) => w.includes('too short'))).toBe(true);

      mockConfig.auth.secret = originalSecret;
    });
  });

  describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
      const result = sanitizeInput('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('should remove dangerous characters', () => {
      const result = sanitizeInput('test<>!@#$%^&*()');
      expect(result).toBe('test@');
    });

    it('should preserve safe characters', () => {
      const result = sanitizeInput('test@example.com');
      expect(result).toBe('test@example.com');
    });

    it('should handle alphanumeric with spaces', () => {
      const result = sanitizeInput('Hello World 123');
      expect(result).toBe('Hello World 123');
    });

    it('should throw error for invalid input', () => {
      expect(() => sanitizeInput(null as any)).toThrow('Invalid input provided');
      expect(() => sanitizeInput(undefined as any)).toThrow('Invalid input provided');
    });

    it('should trim whitespace', () => {
      const result = sanitizeInput('  test  ');
      expect(result).toBe('test');
    });
  });

  describe('validateSecureEmail', () => {
    it('should accept valid emails', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.co.uk',
        'user+tag@example.com',
        'user_name@example-domain.com',
      ];

      validEmails.forEach(email => {
        const result = validateSecureEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject invalid emails', () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user @example.com',
        'user@.com',
      ];

      invalidEmails.forEach(email => {
        const result = validateSecureEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should reject emails with consecutive dots', () => {
      const result = validateSecureEmail('user..name@example.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid email format');
    });

    it('should reject emails that are too long', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      const result = validateSecureEmail(longEmail);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email too long');
    });

    it('should reject XSS attempts in emails', () => {
      const xssEmails = [
        'test<script>@example.com',
        'test@example.com<script>alert("xss")</script>',
        'javascript:alert(1)@example.com',
        'test@example.com onload=alert(1)',
      ];

      xssEmails.forEach(email => {
        const result = validateSecureEmail(email);
        expect(result.isValid).toBe(false);
      });
    });

    it('should handle null/undefined input', () => {
      expect(validateSecureEmail(null as any).isValid).toBe(false);
      expect(validateSecureEmail(undefined as any).isValid).toBe(false);
      expect(validateSecureEmail('').isValid).toBe(false);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate token of specified length', () => {
      const token = generateSecureToken(32);
      expect(token).toHaveLength(32);
    });

    it('should generate token with default length', () => {
      const token = generateSecureToken();
      expect(token).toHaveLength(32);
    });

    it('should generate different tokens', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      expect(token1).not.toBe(token2);
    });

    it('should only contain alphanumeric characters', () => {
      const token = generateSecureToken(50);
      expect(token).toMatch(/^[A-Za-z0-9]+$/);
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(() => {
      // Clear rate limit store between tests
      jest.clearAllMocks();
    });

    it('should allow first attempt', () => {
      const result = checkRateLimit('test-key', {
        windowMs: 60000,
        maxAttempts: 3,
      });
      expect(result).toBe(true);
    });

    it('should allow attempts within limit', () => {
      const config = { windowMs: 60000, maxAttempts: 3 };
      
      expect(checkRateLimit('test-key-2', config)).toBe(true);
      expect(checkRateLimit('test-key-2', config)).toBe(true);
      expect(checkRateLimit('test-key-2', config)).toBe(true);
    });

    it('should block attempts over limit', () => {
      const config = { windowMs: 60000, maxAttempts: 2 };
      
      expect(checkRateLimit('test-key-3', config)).toBe(true);
      expect(checkRateLimit('test-key-3', config)).toBe(true);
      expect(checkRateLimit('test-key-3', config)).toBe(false);
    });

    it('should reset after window expires', () => {
      const config = { windowMs: 100, maxAttempts: 1 };
      
      expect(checkRateLimit('test-key-4', config)).toBe(true);
      expect(checkRateLimit('test-key-4', config)).toBe(false);
      
      // Wait for window to expire
      setTimeout(() => {
        expect(checkRateLimit('test-key-4', config)).toBe(true);
      }, 150);
    });
  });

  describe('validateFileUpload', () => {
    it('should accept valid image files', () => {
      const validFile = {
        name: 'test.jpg',
        size: 1024 * 1024, // 1MB
        type: 'image/jpeg',
      };
      
      const result = validateFileUpload(validFile);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid document files', () => {
      const validFiles = [
        { name: 'doc.pdf', size: 1024 * 1024, type: 'application/pdf' },
        { name: 'doc.docx', size: 1024 * 1024, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      ];

      validFiles.forEach(file => {
        const result = validateFileUpload(file);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject files over size limit', () => {
      const largeFile = {
        name: 'large.jpg',
        size: 51 * 1024 * 1024, // 51MB (over 50MB limit)
        type: 'image/jpeg',
      };
      
      const result = validateFileUpload(largeFile);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('should reject disallowed file types', () => {
      const invalidFile = {
        name: 'test.exe',
        size: 1024,
        type: 'application/x-msdownload',
      };
      
      const result = validateFileUpload(invalidFile);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should reject suspicious file extensions', () => {
      const suspiciousFiles = [
        { name: 'malware.exe', size: 1024, type: 'image/jpeg' },
        { name: 'script.bat', size: 1024, type: 'image/jpeg' },
        { name: 'hack.php', size: 1024, type: 'image/jpeg' },
        { name: 'virus.js', size: 1024, type: 'image/jpeg' },
      ];

      suspiciousFiles.forEach(file => {
        const result = validateFileUpload(file);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('security');
      });
    });

    it('should reject double extensions', () => {
      const doubleExtFile = {
        name: 'image.jpg.exe',
        size: 1024,
        type: 'image/jpeg',
      };
      
      const result = validateFileUpload(doubleExtFile);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Suspicious');
    });

    it('should reject null/undefined file', () => {
      expect(validateFileUpload(null).isValid).toBe(false);
      expect(validateFileUpload(undefined).isValid).toBe(false);
    });
  });
});
