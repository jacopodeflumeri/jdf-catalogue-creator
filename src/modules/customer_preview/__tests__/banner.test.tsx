/** @jest-environment jsdom */

/**
 * The preview banner must hydrate cleanly whatever the server's and browser's
 * time zones are. Formatting the end time during render printed the server's
 * hour (the container runs in UTC) in the HTML and the browser's hour on
 * hydration — a React hydration mismatch on every preview page. The time is
 * now a client-only island.
 *
 * A Jest worker cannot switch its own time zone reliably, so the zone-dependent
 * formatter is replaced with one that answers differently on the "server" and
 * in the "browser". A banner that formats during render fails this test (it
 * was checked against exactly that implementation).
 */
import React, { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import type { CustomerPreviewSessionInfo } from "@/modules/auth/types";

let mockZone: "server" | "browser" = "server";
jest.mock("../lib/format", () => {
  const actual = jest.requireActual("../lib/format");
  return {
    ...actual,
    formatPreviewEndTime: () => (mockZone === "server" ? "12:30" : "14:30"),
  };
});

import CustomerPreviewBanner from "../components/CustomerPreviewBanner";

// Tell React this environment supports act() (otherwise it warns on console.error).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const preview: CustomerPreviewSessionInfo = {
  adminEmail: "ada@mapp.com",
  adminMappUserId: 7,
  companyId: 5046,
  companyName: "Acme Retail",
  expiresAt: "2026-10-15T12:30:00.000Z",
  workspaceNames: ["Acme North"],
};

function serverHtml(): string {
  mockZone = "server";
  return renderToString(<CustomerPreviewBanner preview={preview} />);
}

describe("CustomerPreviewBanner", () => {
  it("puts no zone-dependent time in the server HTML", () => {
    const html = serverHtml();
    const text = html.replace(/<!-- -->/g, ""); // React separates text nodes with comments
    expect(text).toContain("Acme Retail");
    expect(text).toContain("(Acme North only)");
    expect(text).toContain("read-only");
    expect(text).not.toContain("ends");
    expect(text).not.toContain("12:30");
  });

  it("links Exit to the end route with a plain anchor", () => {
    expect(serverHtml()).toContain('href="/admin/customer-preview/end"');
  });

  it("hydrates without a mismatch when the browser's zone differs, then shows the browser's time", async () => {
    const container = document.createElement("div");
    container.innerHTML = serverHtml();
    document.body.appendChild(container);

    mockZone = "browser";
    const errors = jest.spyOn(console, "error").mockImplementation(() => {});
    const recoverable: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, <CustomerPreviewBanner preview={preview} />, {
        onRecoverableError: (e) => recoverable.push(e),
      });
    });

    expect(recoverable).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
    expect(container.textContent).toContain("ends 14:30");
    expect(container.querySelector("time")?.getAttribute("dateTime")).toBe(preview.expiresAt);
    errors.mockRestore();
    container.remove();
  });
});
