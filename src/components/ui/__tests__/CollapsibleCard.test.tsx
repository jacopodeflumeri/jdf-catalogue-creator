/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import CollapsibleCard from "../CollapsibleCard";

describe("CollapsibleCard", () => {
  it("starts collapsed, exposes an accessible toggle, and keeps child state mounted", () => {
    function StatefulContent() {
      return <input aria-label="draft value" defaultValue="unsaved" />;
    }
    render(<CollapsibleCard title="Settings"><StatefulContent /></CollapsibleCard>);
    const toggle = screen.getByRole("button", { name: "Expand Settings" });
    const input = screen.getByLabelText("draft value");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(input.parentElement).toHaveAttribute("hidden");
    fireEvent.change(input, { target: { value: "edited" } });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("draft value")).toHaveValue("edited");
    fireEvent.click(screen.getByRole("button", { name: "Collapse Settings" }));
    expect(screen.getByLabelText("draft value")).toHaveValue("edited");
  });
});
