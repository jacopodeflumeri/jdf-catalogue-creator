import { CATALOG_PROFILES } from "../../config/profiles";
import { planAssortment } from "../../domain/planner";
import { buildProductPrompt } from "../product-prompt";

describe("buildProductPrompt", () => {
  it("fixes the planned slot and controlled vocabularies without delegating domain rules", () => {
    const profile = CATALOG_PROFILES[0];
    const plan = planAssortment({
      sequences: [21],
      departmentMode: "WOMEN",
      config: profile.config,
      seed: "prompt-test",
    })[0]!;
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
  });
});
