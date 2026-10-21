/**
 * @jest-environment node
 */
import {
  isValidUrl,
  extractBaseDomain,
  sanitizeUrlForPrimaryId,
  processUrlForReview,
  createSlug,
  encodePageId,
  decodePageId,
  createPageSlug,
  extractPageIdFromSlug,
} from '../url-utils';

describe('URL Utils', () => {
  describe('isValidUrl', () => {
    it('should return true for valid HTTP URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('http://www.example.com')).toBe(true);
      expect(isValidUrl('http://example.com/path')).toBe(true);
      expect(isValidUrl('http://example.com:8080')).toBe(true);
    });

    it('should return true for valid HTTPS URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('https://www.example.com')).toBe(true);
      expect(isValidUrl('https://example.com/path?query=value')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('example.com')).toBe(false);
      expect(isValidUrl('//example.com')).toBe(false);
    });

    it('should return false for non-http protocols', () => {
      expect(isValidUrl('ftp://example.com')).toBe(false);
      expect(isValidUrl('file:///path/to/file')).toBe(false);
      expect(isValidUrl('javascript:alert(1)')).toBe(false);
    });

    it('should return false for empty/null input', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl(null as any)).toBe(false);
      expect(isValidUrl(undefined as any)).toBe(false);
    });
  });

  describe('extractBaseDomain', () => {
    it('should extract domain from full URL', () => {
      expect(extractBaseDomain('https://example.com/path/to/page')).toBe('https://example.com');
      expect(extractBaseDomain('http://www.example.com/path')).toBe('http://www.example.com');
    });

    it('should preserve protocol', () => {
      expect(extractBaseDomain('http://example.com')).toBe('http://example.com');
      expect(extractBaseDomain('https://example.com')).toBe('https://example.com');
    });

    it('should remove query parameters', () => {
      expect(extractBaseDomain('https://example.com/path?query=value')).toBe('https://example.com');
    });

    it('should remove hash fragments', () => {
      expect(extractBaseDomain('https://example.com/path#section')).toBe('https://example.com');
    });

    it('should handle subdomains', () => {
      expect(extractBaseDomain('https://sub.example.com/path')).toBe('https://sub.example.com');
      expect(extractBaseDomain('https://api.v2.example.com')).toBe('https://api.v2.example.com');
    });

    it('should throw error for invalid URL', () => {
      expect(() => extractBaseDomain('not-a-url')).toThrow('Invalid URL provided');
      expect(() => extractBaseDomain('example.com')).toThrow('Invalid URL provided');
    });
  });

  describe('sanitizeUrlForPrimaryId', () => {
    it('should remove www prefix', () => {
      expect(sanitizeUrlForPrimaryId('https://www.example.com')).toBe('example.com');
      expect(sanitizeUrlForPrimaryId('http://www.example.com/path')).toBe('example.com');
    });

    it('should preserve non-www domains', () => {
      expect(sanitizeUrlForPrimaryId('https://example.com')).toBe('example.com');
      expect(sanitizeUrlForPrimaryId('https://api.example.com')).toBe('api.example.com');
    });

    it('should return clean hostname', () => {
      expect(sanitizeUrlForPrimaryId('https://example.com/path?query=value')).toBe('example.com');
    });

    it('should handle subdomains', () => {
      expect(sanitizeUrlForPrimaryId('https://blog.example.com')).toBe('blog.example.com');
      expect(sanitizeUrlForPrimaryId('https://www.blog.example.com')).toBe('blog.example.com');
    });

    it('should throw error for invalid URL', () => {
      expect(() => sanitizeUrlForPrimaryId('not-a-url')).toThrow('Invalid URL provided');
    });
  });

  describe('processUrlForReview', () => {
    it('should process valid URL correctly', () => {
      const result = processUrlForReview('https://www.example.com/path');
      
      expect(result.isValid).toBe(true);
      expect(result.baseDomainUrl).toBe('https://www.example.com');
      expect(result.primaryId).toBe('example.com');
      expect(result.error).toBeUndefined();
    });

    it('should handle invalid URL', () => {
      const result = processUrlForReview('not-a-url');
      
      expect(result.isValid).toBe(false);
      expect(result.baseDomainUrl).toBe('');
      expect(result.primaryId).toBe('');
      expect(result.error).toBe('Invalid URL format');
    });

    it('should process URL with query parameters', () => {
      const result = processUrlForReview('https://example.com/page?query=value');
      
      expect(result.isValid).toBe(true);
      expect(result.baseDomainUrl).toBe('https://example.com');
      expect(result.primaryId).toBe('example.com');
    });

    it('should process URL with subdomain', () => {
      const result = processUrlForReview('https://blog.example.com');
      
      expect(result.isValid).toBe(true);
      expect(result.baseDomainUrl).toBe('https://blog.example.com');
      expect(result.primaryId).toBe('blog.example.com');
    });
  });

  describe('createSlug', () => {
    it('should convert text to slug', () => {
      expect(createSlug('Hello World')).toBe('hello-world');
      expect(createSlug('The Quick Brown Fox')).toBe('the-quick-brown-fox');
    });

    it('should remove special characters', () => {
      expect(createSlug('Hello, World!')).toBe('hello-world');
      expect(createSlug('Test@Email.com')).toBe('testemailcom');
    });

    it('should replace multiple spaces with single hyphen', () => {
      expect(createSlug('Hello    World')).toBe('hello-world');
    });

    it('should remove leading/trailing hyphens', () => {
      expect(createSlug('-Hello World-')).toBe('hello-world');
      expect(createSlug('---Test---')).toBe('test');
    });

    it('should replace multiple hyphens with single hyphen', () => {
      expect(createSlug('Hello--World')).toBe('hello-world');
      expect(createSlug('Test---Page')).toBe('test-page');
    });

    it('should handle empty string', () => {
      expect(createSlug('')).toBe('');
      expect(createSlug('   ')).toBe('');
    });

    it('should preserve numbers', () => {
      expect(createSlug('Product 123')).toBe('product-123');
      expect(createSlug('2024 Report')).toBe('2024-report');
    });
  });

  describe('encodePageId', () => {
    it('should encode numeric ID', () => {
      const encoded = encodePageId(123);
      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe('string');
    });

    it('should encode string ID', () => {
      const encoded = encodePageId('abc123');
      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe('string');
    });

    it('should be URL-safe', () => {
      const encoded = encodePageId(123456);
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    });

    it('should produce different encodings for different IDs', () => {
      const encoded1 = encodePageId(123);
      const encoded2 = encodePageId(456);
      expect(encoded1).not.toBe(encoded2);
    });
  });

  describe('decodePageId', () => {
    it('should decode encoded ID', () => {
      const original = '123';
      const encoded = encodePageId(original);
      const decoded = decodePageId(encoded);
      expect(decoded).toBe(original);
    });

    it('should handle string IDs', () => {
      const original = 'abc123';
      const encoded = encodePageId(original);
      const decoded = decodePageId(encoded);
      expect(decoded).toBe(original);
    });

    it('should throw error for invalid encoded ID', () => {
      expect(() => decodePageId('invalid!!!')).toThrow('Invalid encoded page ID');
    });
  });

  describe('createPageSlug', () => {
    it('should create slug with encoded ID', () => {
      const slug = createPageSlug('Hello World', 123);
      expect(slug).toContain('hello-world');
      expect(slug).toContain('-');
    });

    it('should handle empty title', () => {
      const slug = createPageSlug('', 123);
      const encoded = encodePageId(123);
      expect(slug).toBe(encoded);
    });

    it('should handle special characters in title', () => {
      const slug = createPageSlug('Hello, World!', 123);
      expect(slug).toContain('hello-world');
    });
  });

  describe('extractPageIdFromSlug', () => {
    it('should extract ID from full slug', () => {
      const originalId = '123';
      const slug = createPageSlug('Test Page', originalId);
      const extractedId = extractPageIdFromSlug(slug);
      expect(extractedId).toBe(originalId);
    });

    it('should handle slug with just encoded ID', () => {
      const originalId = '456';
      const encoded = encodePageId(originalId);
      const extractedId = extractPageIdFromSlug(encoded);
      expect(extractedId).toBe(originalId);
    });

    it('should extract from complex slugs', () => {
      const originalId = 'abc123';
      const slug = createPageSlug('The Power of Product Data', originalId);
      const extractedId = extractPageIdFromSlug(slug);
      expect(extractedId).toBe(originalId);
    });

    it('should handle slugs with multiple hyphens', () => {
      const originalId = '789';
      const slug = createPageSlug('Multi-Word-Title-Here', originalId);
      const extractedId = extractPageIdFromSlug(slug);
      expect(extractedId).toBe(originalId);
    });
  });

  describe('Round-trip encoding', () => {
    it('should successfully encode and decode', () => {
      const testCases = ['1', '123', '456789', 'abc', 'test-id'];
      
      testCases.forEach(id => {
        const encoded = encodePageId(id);
        const decoded = decodePageId(encoded);
        expect(decoded).toBe(id);
      });
    });

    it('should successfully create and extract page slugs', () => {
      const testCases = [
        { title: 'Test Page', id: '123' },
        { title: 'The Power of Data', id: '456' },
        { title: 'Product Review 2024', id: 'abc789' },
      ];

      testCases.forEach(({ title, id }) => {
        const slug = createPageSlug(title, id);
        const extractedId = extractPageIdFromSlug(slug);
        expect(extractedId).toBe(id);
      });
    });
  });
});
