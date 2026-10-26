import { render, screen } from "@testing-library/react";
import type { ButtonHTMLAttributes } from "react";
import DownloadCsvButton from "../DownloadCsvButton";

jest.mock("@/components/providers/ToastProvider", () => ({ useToast: () => ({ addToast: jest.fn() }) }));
jest.mock("@/components/ui/Button", () => ({
  __esModule: true,
  default: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));
jest.mock("@/components/ui/Icon", () => ({ __esModule: true, default: () => null }));

describe("DownloadCsvButton", () => {
  it("labels the downloadable export as a UPC CSV", () => {
    render(<DownloadCsvButton catalogSlug="premium-apparel" />);
    expect(screen.getByRole("button", { name: "Download UPC CSV" })).toBeInTheDocument();
  });
});
