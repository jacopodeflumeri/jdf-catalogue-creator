import { CATALOG_PROFILES } from "../profiles";
import { mergeSeedCatalogConfig } from "../seed-config";

describe("catalog seed taxonomy merge", () => {
  it("reseeds profile defaults while preserving runtime departments, categories, and subcategories", () => {
    const profile = CATALOG_PROFILES[0]!;
    const existing = JSON.parse(JSON.stringify(profile.config)) as Record<string, unknown>;
    existing.departments = [
      ...profile.config.departments,
      { key: "CHILDREN_BABY", label: "Children & Baby", code: "CB", generationWeight: 0.2 },
    ];
    existing.categories = [...profile.config.categories, "babywear"];
    existing.subcategories = {
      ...profile.config.subcategories,
      coats: [...profile.config.subcategories.coats!, "raincoats"],
      babywear: ["onesies"],
    };

    const reseeded = mergeSeedCatalogConfig(profile.config, existing);

    expect(reseeded.departments).toContainEqual({ key: "CHILDREN_BABY", label: "Children & Baby", code: "CB", generationWeight: 0.2 });
    expect(reseeded.categories).toContain("babywear");
    expect(reseeded.subcategories.coats).toContain("raincoats");
    expect(reseeded.subcategories.babywear).toEqual(["onesies"]);
    expect(reseeded.materials).toEqual(profile.config.materials);
  });
});
