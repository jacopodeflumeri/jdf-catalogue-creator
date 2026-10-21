/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";

// Keep the test focused on the boundary control-flow logic — stub the fallback
// deps so we don't pull their import chains into jsdom.
jest.mock("@/lib/utils/logger", () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), log: jest.fn(), debug: jest.fn() },
}));
jest.mock("next-auth/react", () => ({ signOut: jest.fn() }));
jest.mock("@/components/ui/Icon", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/ui/Button", () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
}));
jest.mock("@/modules/auth/components/AdminAuthErrorHandler", () => ({
  __esModule: true,
  default: () => <div>admin-auth-error</div>,
}));
jest.mock("@/modules/auth/components/AuthErrorCard", () => ({
  __esModule: true,
  default: () => <div>auth-error-card</div>,
}));

import { AuthErrorBoundary } from "../AuthErrorBoundary";
import AdminErrorBoundary from "../AdminErrorBoundary";

// Outer boundary: if the inner boundary RE-THROWS, this one catches it and shows
// "propagated". If the inner boundary swallows it (the bug), this never fires.
class Catcher extends React.Component<
  { children: React.ReactNode },
  { caught: boolean }
> {
  state = { caught: false };
  static getDerivedStateFromError() {
    return { caught: true };
  }
  render() {
    return this.state.caught ? <div>propagated</div> : this.props.children;
  }
}

function Thrower({ error }: { error: unknown }): React.ReactElement {
  throw error;
}

const controlFlow = Object.assign(new Error("nf"), { digest: "NEXT_NOT_FOUND" });

describe("error boundaries + Next control-flow signals", () => {
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  it("AuthErrorBoundary re-throws notFound()/redirect() signals", () => {
    render(
      <Catcher>
        <AuthErrorBoundary>
          <Thrower error={controlFlow} />
        </AuthErrorBoundary>
      </Catcher>,
    );
    expect(screen.queryByText("propagated")).not.toBeNull();
  });

  it("AuthErrorBoundary shows its fallback for a real error (does not re-throw)", () => {
    render(
      <Catcher>
        <AuthErrorBoundary>
          <Thrower error={new Error("boom")} />
        </AuthErrorBoundary>
      </Catcher>,
    );
    expect(screen.queryByText("propagated")).toBeNull();
    expect(screen.queryByText("Something went wrong")).not.toBeNull();
  });

  it("AdminErrorBoundary re-throws notFound()/redirect() signals", () => {
    render(
      <Catcher>
        <AdminErrorBoundary>
          <Thrower error={controlFlow} />
        </AdminErrorBoundary>
      </Catcher>,
    );
    expect(screen.queryByText("propagated")).not.toBeNull();
  });
});
