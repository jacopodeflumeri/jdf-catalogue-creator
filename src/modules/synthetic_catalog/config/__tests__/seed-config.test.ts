import { CATALOG_PROFILES } from "../profiles";
import { catalogCategories, catalogSubcategories } from "../profiles";
import { mergeSeedCatalogConfig } from "../seed-config";

describe("catalog seed taxonomy merge", () => {
  it("reseeds profile defaults while preserving runtime departments, categories, and subcategories", () => {
    const profile = CATALOG_PROFILES[0]!;
    const existing = JSON.parse(JSON.stringify(profile.config)) as Record<string, unknown>;
    existing.departments = [
      ...profile.config.departments,
      { key: "CHILDREN_BABY", label: "Children & Baby", code: "CB", generationWeight: 0.2 },
    ];
    existing.categories = ["coats", "babywear"];
    existing.subcategories = {
      coats: ["wool coats", "trench coats", "raincoats"],
      babywear: ["onesies"],
    };
    existing.assortmentPlan = [...profile.config.assortmentPlan, {
      departmentKey: "CHILDREN_BABY", category: "babywear", subcategory: "onesies", productCount: 4, outfitSlot: "ONE_PIECE",
    }];
    const parsedExisting = mergeSeedCatalogConfig(profile.config, existing);
    existing.designMix = { ...parsedExisting.designMix, patternPercentage: 37, patterns: parsedExisting.designMix.patterns.filter((item) => item.code !== "ANIMAL") };

    const reseeded = mergeSeedCatalogConfig(profile.config, existing);

    expect(reseeded.departments).toContainEqual({ key: "CHILDREN_BABY", label: "Children & Baby", code: "CB", generationWeight: 0.2 });
    expect(catalogCategories(reseeded)).toContain("babywear");
    expect(catalogSubcategories(reseeded).coats).toContain("raincoats");
    expect(catalogSubcategories(reseeded).babywear).toEqual(["onesies"]);
    expect(JSON.stringify(reseeded)).not.toContain('"categories"');
    expect(JSON.stringify(reseeded)).not.toContain('"subcategories"');
    expect(reseeded.assortmentPlan).toContainEqual(expect.objectContaining({
      departmentKey: "CHILDREN_BABY", category: "babywear", subcategory: "onesies", productCount: 4,
      outfitSlot: "ONE_PIECE",
    }));
    expect(reseeded.materials).toEqual(profile.config.materials);
    expect(reseeded.designMix.patternPercentage).toBe(37);
    expect(reseeded.designMix.patterns.some((item) => item.code === "ANIMAL")).toBe(false);
    expect(mergeSeedCatalogConfig(profile.config, reseeded)).toEqual(reseeded);
  });
});
