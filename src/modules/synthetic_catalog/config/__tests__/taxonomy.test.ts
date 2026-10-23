import { CATALOG_PROFILES } from "../profiles";
import { addCatalogDepartment } from "../taxonomy";

const config = CATALOG_PROFILES[0].config;

describe("editable catalog taxonomy", () => {
  it("adds normalized departments and rejects duplicate labels or codes case-insensitively", () => {
    const next = addCatalogDepartment(config, { label: "  Kids  ", code: "k", generationWeight: 0.2 });
    expect(next.departments.at(-1)).toEqual({ key: "KIDS", label: "Kids", code: "K", generationWeight: 0.2 });
    expect(() => addCatalogDepartment(next, { label: "kids", code: "KID", generationWeight: 1 })).toThrow("already exists");
    expect(() => addCatalogDepartment(next, { label: "Junior", code: "k", generationWeight: 1 })).toThrow("code already exists");
  });

});
