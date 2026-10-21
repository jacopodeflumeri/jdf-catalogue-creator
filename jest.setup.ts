import "@testing-library/jest-dom";

// Automatically switch to test database when DATABASE_URL_TEST is set
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: "/",
      query: {},
      asPath: "/",
    };
  },
  usePathname() {
    return "/";
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  useParams() {
    return {};
  },
}));

// Mock environment variables for tests
process.env.NEXTAUTH_SECRET =
  "test-secret-at-least-32-characters-long-for-security";
process.env.NEXTAUTH_URL = "http://localhost:3000";
