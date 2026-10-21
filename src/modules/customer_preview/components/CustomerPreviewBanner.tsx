import type { CustomerPreviewSessionInfo } from "@/modules/auth/types";
import { CUSTOMER_PREVIEW_END_PATH } from "../lib/constants";
import PreviewEndTime from "./PreviewEndTime";

/**
 * Shown on every customer page while an admin is using "View as customer".
 * Render it from the SERVER session (`session.user.customerPreview`) — the
 * browser's `useSession()` is still the admin's and knows nothing of the
 * preview. `CompanyCustomerLayout` already does.
 *
 * Design system §6.K (environment/impersonation banners): an inline glass
 * badge, top-right, semantic tint at restrained saturation — not a ribbon.
 *
 * No hooks and no client state, so it renders on the server; only the end
 * time is a client island (see `PreviewEndTime` for why). Exit is a plain
 * `<a>` to the end route: a `<Link>` would try to fetch a route handler as a
 * page.
 */
export default function CustomerPreviewBanner({
  preview,
}: {
  preview: CustomerPreviewSessionInfo;
}) {
  const names = preview.workspaceNames ?? [];
  return (
    <div className="pointer-events-none sticky top-0 z-40 flex justify-end px-6 pt-3">
      <div
        role="status"
        className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/75 bg-[rgba(216,162,74,0.18)] px-4 py-1.5 text-[13px] text-[#1a1a1a]/80 shadow-[0_8px_32px_0_rgba(0,0,0,0.05)] backdrop-blur-md"
      >
        <span>
          Viewing as{" "}
          <strong className="font-semibold">
            {preview.companyName ?? `company ${preview.companyId}`}
          </strong>
          {names.length > 0 && (
            <span className="text-[#1a1a1a]/70"> ({names.join(", ")} only)</span>
          )}
          <span className="text-[#1a1a1a]/55">
            {" · read-only"}
            <PreviewEndTime expiresAt={preview.expiresAt} />
          </span>
        </span>
        <a
          href={CUSTOMER_PREVIEW_END_PATH}
          className="rounded-full border border-white/75 bg-white/70 px-2.5 py-0.5 text-xs font-semibold text-[#1a1a1a]/80 transition-colors duration-300 hover:bg-white"
        >
          Exit
        </a>
      </div>
    </div>
  );
}
