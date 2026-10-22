import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readDeployScript(name: string): string {
  return readFileSync(resolve(process.cwd(), "scripts", "deploy", name), "utf8");
}

describe("multi-container deployment contracts", () => {
  it("discovers NEXTAUTH_URL from App without relying on ECS array order", () => {
    const script = readDeployScript("register-keycloak-uris.sh");

    expect(script).toContain("containerDefinitions[?name==`App`]");
    expect(script).not.toContain("containerDefinitions[0]");
  });

  it("updates both application containers for immutable deployments", () => {
    const script = readDeployScript("deploy-app.sh");

    expect(script).toContain('.name == "App" or .name == "CatalogWorker"');
    expect(script).not.toContain(".containerDefinitions[0].image");
  });
});
