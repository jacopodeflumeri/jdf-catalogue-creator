import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("catalog settings department controls", () => {
  it("shows department metadata without generation weights", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/admin/catalogs/[catalogRef]/CatalogDetailClient.tsx"), "utf8");
    expect(source).toContain('label="Label"');
    expect(source).toContain('label="Product ID code"');
    expect(source).not.toContain("Generation weight");
    expect(source).not.toContain("generationWeight");
    expect(source).not.toContain("departmentWeight");
    expect(source).not.toContain(" · weight ");
  });
});
