import { CATALOG_PROFILES, parseCatalogProfileConfig } from "../profiles";
import { configuredDepartmentLabel } from "../department-label";

describe("configured department labels", () => {
  it("returns the configured label while preserving unknown keys as a fallback", () => {
    const config = parseCatalogProfileConfig({
      ...CATALOG_PROFILES[0].config,
      departments: [...CATALOG_PROFILES[0].config.departments, {
        key: "CHILDREN_BABY", label: "Children & Baby", code: "CB", generationWeight: 0.1,
      }],
    });

    expect(configuredDepartmentLabel(config, "CHILDREN_BABY")).toBe("Children & Baby");
    expect(configuredDepartmentLabel(config, "WOMEN")).toBe("Women");
    expect(configuredDepartmentLabel(config, "LEGACY_KEY")).toBe("LEGACY_KEY");
  });
});
