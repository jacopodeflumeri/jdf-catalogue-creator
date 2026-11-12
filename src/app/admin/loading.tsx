export default function AdminDashboardLoading() {
  return (
    <div className="px-8 py-6 space-y-8" aria-busy="true" aria-label="Loading Dashboard">
      <div className="animate-pulse space-y-3">
        <div className="ds-skeleton h-10 w-64 rounded-xl" />
        <div className="ds-skeleton h-6 w-96 max-w-full rounded-lg" />
      </div>
      <section className="space-y-4">
        <div className="ds-skeleton h-7 w-56 rounded-lg" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="glass-card h-32 rounded-2xl" />)}</div>
      </section>
      <section className="space-y-4">
        <div className="flex justify-between gap-4"><div className="ds-skeleton h-7 w-56 rounded-lg" /><div className="ds-skeleton h-10 w-72 rounded-xl" /></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="glass-card h-32 rounded-2xl" />)}</div>
      </section>
      {Array.from({ length: 4 }, (_, index) => <div key={index} className="glass-card h-72 rounded-2xl" />)}
    </div>
  );
}
