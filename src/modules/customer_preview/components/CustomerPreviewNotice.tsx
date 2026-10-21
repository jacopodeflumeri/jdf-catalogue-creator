import NoticeBox, { type NoticeBoxVariant } from "@/components/ui/NoticeBox";
import { isCustomerPreviewStatus } from "../lib/format";
import type { CustomerPreviewStatus } from "../lib/constants";

const NOTICES: Record<CustomerPreviewStatus, { variant: NoticeBoxVariant; text: string }> = {
  exited: { variant: "info", text: "You've stopped viewing as a customer." },
  ended: {
    variant: "warning",
    text: "Your customer preview ended (it lasts 30 minutes, and stops if your admin access changes). Start it again to keep looking.",
  },
  unavailable: {
    variant: "warning",
    text: "That company's customer view couldn't be loaded, so the preview was ended.",
  },
  "not-found": {
    variant: "warning",
    text: "That company, or one of the chosen workspaces, could not be found. No preview was started.",
  },
  disabled: { variant: "warning", text: "View as customer is not enabled in this app." },
};

/**
 * The notice an admin page shows after a preview ends or a start is refused.
 * Pass the page's `?preview=` search param; anything else renders nothing.
 * Put it on every page that hosts a launch point (the end route returns to
 * the page the preview was started from).
 */
export default function CustomerPreviewNotice({
  status,
  className = "",
}: {
  status: string | string[] | null | undefined;
  className?: string;
}) {
  if (!isCustomerPreviewStatus(status)) return null;
  const notice = NOTICES[status];
  return (
    <NoticeBox variant={notice.variant} className={className}>
      {notice.text}
    </NoticeBox>
  );
}
