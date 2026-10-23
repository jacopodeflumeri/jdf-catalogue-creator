import { CATALOG_PROFILES } from "../../config/profiles";
import { planAssortment } from "../../domain/planner";
import { MockProductGenerator } from "../mock-product-generator";
import { generatedProductSpecSchema } from "../product-generator";

describe("MockProductGenerator", () => {
  it("returns deterministic structured data from controlled vocabularies", async () => {
    const profile = CATALOG_PROFILES[2];
    const plan = planAssortment({
      sequences: [7],
      departmentMode: "WOMEN",
      config: profile.config,
      seed: "mock-provider",
    })[0]!;
    const provider = new MockProductGenerator();
    const input = {
      model: profile.defaultTextModel,
      catalog: {
        slug: profile.slug,
        segment: profile.segment,
        brandName: profile.brandName,
        config: profile.config,
      },
      plan,
    };

    const first = await provider.generateProduct(input);
    const second = await provider.generateProduct(input);
    expect(second).toEqual(first);
    expect(generatedProductSpecSchema.parse(first)).toEqual(first);
    expect(profile.config.materials).toContain(first.material);
    expect(profile.config.colors.map((color) => color.code)).toContain(first.colorCode);
    expect(profile.config.seasons).toContain(first.season);
  });

  it("returns exactly the frozen assignment", async () => {
    const profile = CATALOG_PROFILES[0]!;
    const plain = planAssortment({ sequences: [8], departmentMode: "WOMEN", config: profile.config, seed: "assigned-design" })[0]!;
    const plan = { ...plain, design: { patternCode: "STRIPED", embellishmentCodes: ["EMBROIDERY"] } };
    const spec = await new MockProductGenerator().generateProduct({ model: profile.defaultTextModel, catalog: { slug: profile.slug, segment: profile.segment, brandName: profile.brandName, config: profile.config }, plan });
    expect(spec.design.patternCode).toBe("STRIPED");
    expect(spec.design.embellishmentCodes).toEqual(["EMBROIDERY"]);
    expect(generatedProductSpecSchema.parse(spec)).toEqual(spec);
  });
});
