import { buildCompleteLookPrompt } from "../complete-look-prompt";

describe("Complete the Look prompt", () => {
  it("labels references in the stored order and keeps each companion role explicit", () => {
    const prompt = buildCompleteLookPrompt({
      anchor: { name: "Top", category: "tops", subcategory: "training top", material: "jersey", season: "Core", colorName: "Navy", colorCode: "NAVY", visualSpec: {} },
      catalog: { brandName: "Fictional", segment: "activewear", visualDirection: "clean studio" },
      references: [
        { data: Buffer.from("1"), mimeType: "image/webp", assetId: 1, description: "anchor item already worn by the model" },
        { data: Buffer.from("2"), mimeType: "image/webp", assetId: 2, description: "authoritative anchor product reference" },
        { data: Buffer.from("3"), mimeType: "image/webp", assetId: 3, description: "companion bottom leggings in black" },
      ],
    });
    expect(prompt.indexOf("Image 1:")).toBeLessThan(prompt.indexOf("Image 2:"));
    expect(prompt.indexOf("Image 2:")).toBeLessThan(prompt.indexOf("Image 3:"));
    expect(prompt).toContain("one adult fictional model");
    expect(prompt).toContain("No real brands");
  });
});
