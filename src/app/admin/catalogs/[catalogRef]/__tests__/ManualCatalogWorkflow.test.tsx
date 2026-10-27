/** @jest-environment jsdom */

import { fireEvent, render, screen, within } from "@testing-library/react";
import ManualCatalogWorkflow from "../ManualCatalogWorkflow";
import { coreImageActionInput, defaultCoreWorkflowTarget } from "../workflow-targets";

const jobs = [
  { id: 21, createdAt: "2026-10-26T08:30:00.000Z", informationReadyProducts: 80, informationReadyStyles: 160 },
  { id: 22, createdAt: "2026-10-27T08:50:00.000Z", informationReadyProducts: 109, informationReadyStyles: 218 },
];

function renderWorkflow(overrides: Partial<React.ComponentProps<typeof ManualCatalogWorkflow>> = {}) {
  const props: React.ComponentProps<typeof ManualCatalogWorkflow> = {
    canEdit: true,
    jobs,
    coreTarget: defaultCoreWorkflowTarget(jobs),
    onCoreTargetChange: jest.fn(),
    coreBusy: false,
    lookBusy: false,
    lookTarget: "ALL",
    onLookTargetChange: jest.fn(),
    onGenerateInformation: jest.fn(),
    onStartCoreImages: jest.fn(),
    onStartCompleteLooks: jest.fn(),
    counts: { styles: 10, readyCoreImages: 20, pendingCoreImages: 2, failedCoreImages: 0 },
    canStartCompleteLooks: true,
    ...overrides,
  };
  return { ...render(<ManualCatalogWorkflow {...props} />), props };
}

it("offers one Step 2 action and uses completed batches plus the all-missing target", () => {
  const { props } = renderWorkflow();
  const step2 = screen.getByRole("region", { name: "Core images" });
  expect(within(step2).getAllByRole("button")).toHaveLength(1);
  expect(within(step2).getByRole("button", { name: "Generate core images" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "All products missing core images" })).not.toBeInTheDocument();
  const selector = within(step2).getByLabelText("Target") as HTMLSelectElement;
  const optionLabels = Array.from(selector.options).map((option) => option.textContent ?? "");
  expect(optionLabels[0]).toContain("109 products / 218 styles");
  expect(optionLabels[1]).toContain("80 products / 160 styles");
  expect(optionLabels[2]).toBe("All active products missing core images");
  expect(selector.value).toBe("batch:22");
  fireEvent.change(selector, { target: { value: "batch:21" } });
  expect(props.onCoreTargetChange).toHaveBeenCalledWith("batch:21");
  fireEvent.change(selector, { target: { value: "all-missing" } });
  expect(props.onCoreTargetChange).toHaveBeenCalledWith("all-missing");
});

it("defaults to the latest completed batch and to all-missing when no batches exist", () => {
  expect(defaultCoreWorkflowTarget(jobs)).toBe("batch:22");
  expect(defaultCoreWorkflowTarget([])).toBe("all-missing");
});

it("builds batch and all-missing requests without carrying a stale source job", () => {
  expect(coreImageActionInput(7, "batch:22")).toEqual({ catalogId: 7, sourceJobId: 22, allMissing: false });
  expect(coreImageActionInput(7, "all-missing")).toEqual({ catalogId: 7, allMissing: true });
  expect(coreImageActionInput(7, "batch:invalid" as `batch:${number}`)).toBeNull();
});

it("shows all image counts and suppresses danger styling when there are no failures", () => {
  renderWorkflow();
  const step2 = screen.getByRole("region", { name: "Core images" });
  expect(within(step2).getByText("Ready 20")).toBeInTheDocument();
  expect(within(step2).getByText("Pending 2")).toBeInTheDocument();
  expect(within(step2).getByText("Failed 0")).toBeInTheDocument();
  expect(within(step2).getByText("Failed 0")).not.toHaveClass("text-[rgba(147,34,49,0.96)]");
  renderWorkflow({ counts: { styles: 10, readyCoreImages: 18, pendingCoreImages: 0, failedCoreImages: 2 } });
  expect(screen.getByText("Failed 2")).toBeInTheDocument();
});

it("uses the required action labels and shared footer sizing and layout", () => {
  const { container } = renderWorkflow();
  for (const label of ["Create catalogue information", "Generate core images", "Generate Complete the Look"]) {
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  }
  for (const step of ["step-1", "step-2", "step-3"]) {
    const footer = container.querySelector(`[data-workflow-actions="${step}"]`);
    expect(footer).toHaveClass("border-t", "pt-4");
    expect(within(footer as HTMLElement).getByRole("button")).toHaveClass("w-full", "min-h-11", "prism-button");
  }
  expect(container.querySelector("[data-workflow-grid]")).toHaveClass("md:auto-rows-fr");
  expect(container.querySelectorAll("[data-workflow-control]")).toHaveLength(3);
  expect(Array.from(container.querySelectorAll("[data-workflow-control]")).some((node) => (node as HTMLElement).className.includes("min-h-[132px]"))).toBe(false);
});

it("describes Step 1 scope and disables Step 3 until full-catalogue core images are ready", () => {
  renderWorkflow({ counts: { styles: 10, readyCoreImages: 19, pendingCoreImages: 1, failedCoreImages: 0 }, canStartCompleteLooks: false });
  expect(screen.getByText("Scope, quantity, and colour variants are selected in the next dialog.")).toBeInTheDocument();
  expect(screen.getByText("Complete all required FRONT and BACK images before generating looks.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Generate Complete the Look" })).toBeDisabled();
});

it("keeps Step 3 enabled when the prerequisite is satisfied", () => {
  renderWorkflow();
  expect(screen.getByText("Ready", { selector: "span" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Generate Complete the Look" })).toBeEnabled();
});

it("preserves read-only viewer guidance without exposing mutation buttons", () => {
  renderWorkflow({ canEdit: false });
  expect(screen.queryByRole("button", { name: "Create catalogue information" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Generate core images" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Generate Complete the Look" })).not.toBeInTheDocument();
  expect(screen.getAllByText("You have read-only access to this workflow.")).toHaveLength(2);
  expect(screen.getByText(/Editors can start this step/)).toBeInTheDocument();
});
