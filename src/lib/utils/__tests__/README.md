# Test Suite

This directory contains comprehensive unit and integration tests for the Mapp Labs application.

## Setup

### Install Dependencies

```bash
npm install
```

This will install the following testing dependencies:
- `jest` - Testing framework
- `@testing-library/react` - React component testing utilities
- `@testing-library/jest-dom` - Custom Jest matchers for DOM

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

### Phase 1: Security & Authentication (CRITICAL) ✅

#### Security Tests (`src/lib/utils/__tests__/security.test.ts`)
- ✅ Environment security validation
- ✅ Input sanitization
- ✅ Email validation with XSS protection
- ✅ Secure token generation
- ✅ Rate limiting
- ✅ File upload validation

#### XSS Protection Tests (`src/lib/utils/__tests__/xss-protection.test.ts`)
- ✅ HTML sanitization (server-side)
- ✅ URL sanitization
- ✅ XSS detection
- ✅ CSP nonce generation
- ✅ Protection against script injection
- ✅ Protection against event handler injection

### Phase 2: Core Utilities (HIGH VALUE) ✅

#### URL Utilities Tests (`src/lib/utils/__tests__/url-utils.test.ts`)
- ✅ URL validation
- ✅ Base domain extraction
- ✅ URL sanitization for IDs
- ✅ URL processing for review
- ✅ Slug creation
- ✅ Page ID encoding/decoding
- ✅ Round-trip encoding verification

## Coverage Goals

The test suite aims for the following coverage thresholds:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

## Test Organization

Tests are organized following the source code structure:
```
src/
├── lib/
│   └── utils/
│       └── __tests__/
│           ├── security.test.ts
│           ├── xss-protection.test.ts
│           └── url-utils.test.ts
```

## Writing Tests

### Test File Naming
- Unit tests: `*.test.ts` or `*.test.tsx`
- Place tests in `__tests__` folder next to the code being tested

### Test Structure
```typescript
import { describe, it, expect } from '@jest/globals';

describe('Component/Function Name', () => {
  describe('method/feature name', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on what the code does, not how it does it
   - Test public APIs and user-facing behavior

2. **Use Descriptive Test Names**
   - Start with "should"
   - Be specific about what is being tested
   - Example: `'should reject emails with consecutive dots'`

3. **Follow AAA Pattern**
   - **Arrange**: Set up test data
   - **Act**: Execute the code under test
   - **Assert**: Verify the results

4. **Test Edge Cases**
   - Null/undefined inputs
   - Empty strings
   - Very large inputs
   - Boundary conditions

5. **Mock External Dependencies**
   - Use `jest.mock()` for modules
   - Mock API calls and database operations
   - Keep tests isolated and fast

## Mocking

### Mock Logger
```typescript
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
```

### Mock Config
```typescript
jest.mock('@/config', () => ({
  config: {
    // Mock configuration values
  },
}));
```

### Mock Next.js Router
```typescript
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    // ... other router methods
  }),
}));
```

## Continuous Integration

Tests should be run as part of your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: npm test

- name: Generate coverage report
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Troubleshooting

### Tests Fail to Run

1. **Check Node.js version**: Ensure you're using Node.js >= 22
2. **Clear Jest cache**: `npx jest --clearCache`
3. **Reinstall dependencies**: `rm -rf node_modules && npm install`

### Type Errors in Tests

1. **Update TypeScript**: Ensure `typescript` is at version 5+
2. **Check type definitions**: Ensure `@types/jest` is installed
3. **Restart TypeScript server**: In VS Code, run "TypeScript: Restart TS Server"

### Coverage Reports Not Generated

1. **Check jest.config.ts**: Ensure `collectCoverageFrom` is configured
2. **Run with verbose flag**: `npm run test:coverage -- --verbose`

## Next Steps

### Phase 3: Components (Planned)
- Table component tests
- Button component tests
- Icon component tests
- Form components tests

### Phase 4: Integration Tests (Planned)
- Authentication flow tests
- Server action tests
- API route tests
- Database operation tests

### Phase 5: E2E Tests (Optional)
- Customer journey tests
- Admin dashboard tests
- Complete user flows

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
