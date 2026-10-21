import Card from "@/components/ui/Card";

/**
 * Shown while a customer page renders on the server (first load and client
 * navigations between `/account/*` pages).
 *
 * Shaped like the customer home it most often stands in for
 * (`CompanyCustomerHome.tsx`) — same page container, a page header (title +
 * one-line subtitle) and a card of label/value rows — so the real page replaces
 * it without the layout, or the footer below it, jumping. When you change the
 * home page's container or header, change this to match; when you build your
 * app's own customer pages, shape this like the one customers land on.
 */
export default function AccountLoading() {
  return (
    <div className="flex-1" aria-busy="true" aria-label="Loading">
      <div className="mx-auto w-full max-w-3xl px-6 py-10 space-y-6 animate-fade-in">
        <div className="space-y-1">
          {/* text-3xl title (h-9) + text-sm subtitle (h-5) */}
          <div className="animate-pulse ds-skeleton rounded-xl h-9 w-72 max-w-full" />
          <div className="animate-pulse ds-skeleton rounded-xl h-5 w-96 max-w-full" />
        </div>

        <Card>
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex justify-between gap-4">
                <div className="animate-pulse ds-skeleton rounded h-5 w-24" />
                <div className="animate-pulse ds-skeleton rounded h-5 w-40" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
