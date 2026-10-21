import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  // Add more setup options before each test is run
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@test/(.*)$": "<rootDir>/test/$1",
  },
  // Ignore tsc output from `infra`. Without this, a stale infra/dist left by a
  // prior `npm run build` gets its compiled __tests__/*.js picked up by
  // testMatch and fails with a bogus app.config.json ENOENT (the relative path
  // resolves differently from dist/ than from source).
  //
  // This is modulePathIgnorePatterns, not testPathIgnorePatterns, on purpose:
  // the test scripts pass --testPathIgnorePatterns on the CLI, and that flag
  // replaces the config value rather than merging with it.
  //
  // .claude/worktrees/ holds full checkouts made by coding agents working in
  // isolation; without this their copies of every test run too.
  modulePathIgnorePatterns: ["<rootDir>/infra/dist/", "<rootDir>/.claude/"],
  testMatch: [
    "**/__tests__/**/*.test.[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)",
  ],

  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{js,jsx,ts,tsx}",
    "!src/**/__tests__/**",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
// We override transformIgnorePatterns after next/jest resolves to allow Prisma 7's ESM .mjs files
const jestConfig = createJestConfig(config);
const jestConfigWithOverrides = async () => {
  const resolved = await jestConfig();
  return {
    ...resolved,
    transformIgnorePatterns: [
      "/node_modules/(?!.pnpm)(?!(@prisma/client|geist)/)",
      "/node_modules/.pnpm/(?!(@prisma\\+client|geist)@)",
      "^.+\\.module\\.(css|sass|scss)$",
    ],
  };
};
export default jestConfigWithOverrides;
