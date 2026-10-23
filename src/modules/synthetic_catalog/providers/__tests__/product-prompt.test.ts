import { CATALOG_PROFILES } from "../../config/profiles";
import { allocateDesignMix, planAssortment } from "../../domain/planner";
import { buildProductPrompt } from "../product-prompt";

describe("buildProductPrompt", () => {
  it("fixes the planned slot and controlled vocabularies without delegating domain rules", () => {
    const profile = CATALOG_PROFILES[0];
    const plan = allocateDesignMix(planAssortment({
      sequences: [21],
      departmentMode: "WOMEN",
      config: profile.config,
      seed: "prompt-test",
    }), { ...profile.config.designMix, patternPercentage: 100, embellishmentPercentage: 0 }, "prompt-test")[0]!;
    const prompt = buildProductPrompt({
      model: profile.defaultTextModel,
      catalog: {
        slug: profile.slug,
        segment: profile.segment,
        brandName: profile.brandName,
        config: profile.config,
      },
      plan,
    });
    const user = JSON.parse(prompt.user);

    expect(prompt.system).toContain("exactly one JSON object");
    expect(prompt.system).toContain("do not return those fields");
    expect(user.plannedSlot).toEqual({
      department: plan.department,
      category: plan.category,
      subcategory: plan.subcategory,
    });
    expect(user.controlledVocabulary.materials).toEqual(profile.config.materials);
    expect(user.controlledVocabulary.colors).toEqual(
      profile.config.colors.map(({ name, code }) => ({ name, code })),
    );
    expect(user.responseShape).not.toHaveProperty("price");
    expect(user.responseShape).not.toHaveProperty("stock");
    expect(user.responseShape).not.toHaveProperty("id");
    expect(user.plannedDesign.patternCode).toBeTruthy();
    expect(user.responseShape.design.patternCode).toContain("plannedDesign.patternCode");
    expect(prompt.system).toContain("Do not add patterns or embellishments");
  });

  it("permits only the current fictional logo for an explicitly assigned logo repeat", () => {
    const profile = CATALOG_PROFILES[0]!;
    const plan = { sequence: 10, seed: "logo", department: "Women", category: "dresses", subcategory: "midi dresses", design: { patternCode: "BRAND_LOGO_REPEAT", embellishmentCodes: [] } };
    const prompt = buildProductPrompt({ model: profile.defaultTextModel, catalog: { slug: profile.slug, segment: profile.segment, brandName: profile.brandName, config: profile.config }, plan });
    expect(prompt.system).toContain("Aureline");
    expect(prompt.system).toContain("repeated textile or surface motif");
    expect(prompt.system).toContain("invented lettering");
    expect(JSON.parse(prompt.user).plannedDesign.patternCode).toBe("BRAND_LOGO_REPEAT");
  });
});
