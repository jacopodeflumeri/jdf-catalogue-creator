/** @jest-environment node */

import { isCatalogWorkerSchemaMissing } from "../worker-readiness";

describe("catalog worker deployment readiness", () => {
  it("recognizes an unapplied Prisma schema as a temporary bootstrap state", () => {
    expect(isCatalogWorkerSchemaMissing({ code: "P2021" })).toBe(true);
  });

  it("does not hide unrelated worker startup failures", () => {
    expect(isCatalogWorkerSchemaMissing({ code: "P1001" })).toBe(false);
    expect(isCatalogWorkerSchemaMissing(new Error("unexpected"))).toBe(false);
  });
});
