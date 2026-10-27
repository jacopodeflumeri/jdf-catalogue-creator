/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import ManualCatalogWorkflow from "../ManualCatalogWorkflow";

it("keeps the three desktop action regions aligned and preserves the workflow actions", () => {
  const onGenerateInformation = jest.fn(); const onStartCoreImages = jest.fn(); const onStartAllMissingImages = jest.fn(); const onStartCompleteLooks = jest.fn();
  const { container } = render(<ManualCatalogWorkflow canEdit jobs={[{ id: 1, createdAt: "2026-10-27T09:00:00.000Z", informationReadyProducts: 4, informationReadyStyles: 8 }]} coreSourceJobId="1" onCoreSourceJobChange={jest.fn()} canStartCoreImages coreBusy={false} lookBusy={false} lookTarget="ALL" onLookTargetChange={jest.fn()} onGenerateInformation={onGenerateInformation} onStartCoreImages={onStartCoreImages} onStartAllMissingImages={onStartAllMissingImages} onStartCompleteLooks={onStartCompleteLooks} counts={{ readyCoreImages: 2, pendingCoreImages: 1, failedCoreImages: 0 }} />);
  expect(container.querySelector(".md\\:grid-cols-3.md\\:auto-rows-fr")).not.toBeNull();
  for (const step of ["step-1", "step-2", "step-3"]) expect(container.querySelector(`[data-workflow-actions="${step}"]`)).toHaveClass("mt-auto");
  fireEvent.click(screen.getByRole("button", { name: /Generate information/ }));
  fireEvent.click(screen.getByRole("button", { name: "Generate batch core images" }));
  fireEvent.click(screen.getByRole("button", { name: "All products missing core images" }));
  fireEvent.click(screen.getByRole("button", { name: "Generate Complete the Look" }));
  expect(onGenerateInformation).toHaveBeenCalledTimes(1); expect(onStartCoreImages).toHaveBeenCalledTimes(1); expect(onStartAllMissingImages).toHaveBeenCalledTimes(1); expect(onStartCompleteLooks).toHaveBeenCalledTimes(1);
});
