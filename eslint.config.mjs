import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import eslintPluginUnusedImports from "eslint-plugin-unused-imports";
import eslintPluginSecurity from "eslint-plugin-security";

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      // tsc output (infra/dist). Compiled .js copies of infra sources would
      // otherwise be linted as if they were hand-written.
      "**/dist/**",
      "next-env.d.ts",
      "src/generated/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "unused-imports": eslintPluginUnusedImports,
      security: eslintPluginSecurity,
    },
    rules: {
      // Security rules for OWASP compliance
      "security/detect-object-injection": "off", // Disabled - too many false positives in React components
      "security/detect-non-literal-fs-filename": "error",
      "security/detect-non-literal-regexp": "error",
      "security/detect-non-literal-require": "error",
      "security/detect-possible-timing-attacks": "warn",
      "security/detect-pseudoRandomBytes": "error",
      "security/detect-buffer-noassert": "error",
      "security/detect-child-process": "warn",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-new-buffer": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-unsafe-regex": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      // "@typescript-eslint/no-unused-imports": "off",

      "@next/next/no-img-element": "off",

      // React Compiler rules, new in eslint-config-next 16. They flag real
      // smells, but this template's admin UI predates them and has no test
      // coverage, so "fixing" them here would be an unverifiable refactor of
      // code every fork diverges from anyway. Kept as warnings so the template
      // ships a green `make dev-check-all` while still handing builders the
      // list to clean up in their own app.
      //
      // Currently: 5 set-state-in-effect (EditAccessModal syncing props to
      // state, a Modal.tsx SSR mount guard, and one each in
      // AccessManagementTable, AuditLogClient and CompanyUsersClient) and no
      // immutability hits.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];

export default eslintConfig;
