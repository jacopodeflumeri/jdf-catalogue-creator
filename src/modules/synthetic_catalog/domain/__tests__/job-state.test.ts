import { assertJobTransition } from "../job-state";

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
});
