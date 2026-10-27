import { assertJobTransition, deriveCatalogJobProgress } from "../job-state";

describe("catalog generation job state transitions", () => {
  it("allows execution, partial progress, and retry transitions", () => {
    expect(() => assertJobTransition("QUEUED", "RUNNING")).not.toThrow();
    expect(() => assertJobTransition("RUNNING", "QUEUED")).not.toThrow();
    expect(() => assertJobTransition("RUNNING", "COMPLETED_WITH_ERRORS")).not.toThrow();
    expect(() => assertJobTransition("COMPLETED_WITH_ERRORS", "QUEUED")).not.toThrow();
  });

  it("rejects reopening a completed job", () => {
    expect(() => assertJobTransition("COMPLETED", "RUNNING")).toThrow(
      "COMPLETED -> RUNNING",
    );
  });

  it("keeps a bulk rename job running while proposal chunks remain queued", () => {
    expect(deriveCatalogJobProgress([
      { taskType: "PROPOSE_PRODUCT_NAMES", status: "COMPLETED", count: 1 },
      { taskType: "PROPOSE_PRODUCT_NAMES", status: "QUEUED", count: 5 },
    ])).toEqual(expect.objectContaining({
      pendingTasks: 5,
      failedTasks: 0,
      nextStatus: "RUNNING",
      nextStage: "PRODUCTS",
    }));
  });

  it("finishes bulk rename only after every proposal chunk settles", () => {
    expect(deriveCatalogJobProgress([
      { taskType: "PROPOSE_PRODUCT_NAMES", status: "COMPLETED", count: 6 },
    ])).toEqual(expect.objectContaining({
      pendingTasks: 0,
      failedTasks: 0,
      nextStatus: "COMPLETED",
      nextStage: "COMPLETE",
    }));
    expect(deriveCatalogJobProgress([
      { taskType: "PROPOSE_PRODUCT_NAMES", status: "COMPLETED", count: 5 },
      { taskType: "PROPOSE_PRODUCT_NAMES", status: "FAILED", count: 1 },
    ])).toEqual(expect.objectContaining({
      pendingTasks: 0,
      failedTasks: 1,
      nextStatus: "COMPLETED_WITH_ERRORS",
      nextStage: "COMPLETE",
    }));
  });
});
