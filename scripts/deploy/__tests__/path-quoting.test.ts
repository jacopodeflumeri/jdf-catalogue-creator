import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("deploy orchestrator paths", () => {
  it.each(["first-deploy.sh", "full-deploy.sh"])(
    "quotes helper paths in %s so repository paths may contain spaces",
    (scriptName) => {
      const script = readFileSync(
        resolve(process.cwd(), "scripts", "deploy", scriptName),
        "utf8",
      );

      expect(script).not.toMatch(/^\s*(?:if !\s+)?\$\{SCRIPT_DIR\}\//m);
    },
  );
});
