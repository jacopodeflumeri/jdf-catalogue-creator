import { buildCatalogImagePrompt } from "../image-prompt";

function input(role: "FRONT" | "BACK" | "ON_MODEL", hasFrontReference = false) {
  return {
    role,
    catalog: {
      segment: "premium",
      brandName: "Aureline",
      visualDirection: "restrained editorial studio",
    },
    product: {
      name: "Elara Coat",
      department: "WOMEN",
      category: "Outerwear",
      subcategory: "Coats",
      material: "wool",
      season: "Autumn/Winter",
    },
    style: {
      externalId: "PRE-W-000001-IVY",
      colorName: "Ivy",
      colorCode: "IVY",
      visualSpec: { silhouette: "longline", details: ["notched collar"] },
    },
    hasFrontReference,
  };
}

describe("catalog image prompts", () => {
  it("keeps the front image product-only and free of branding", () => {
    const prompt = buildCatalogImagePrompt(input("FRONT"));
    expect(prompt).toContain("garment alone from the front");
    expect(prompt).toContain("No person, mannequin, hanger");
    expect(prompt).toContain("Do not include any logo");
    expect(prompt).toContain("PRE-W-000001-IVY");
  });

  it("treats the front as authoritative for back and on-model images", () => {
    for (const role of ["BACK", "ON_MODEL"] as const) {
      const prompt = buildCatalogImagePrompt(input(role, true));
      expect(prompt).toContain("authoritative front reference");
      expect(prompt).toContain("do not redesign it");
    }
  });
});
