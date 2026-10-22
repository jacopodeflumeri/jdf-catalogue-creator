import Loading from "@/components/ui/Loading";

export default function LLMUsageLoading() {
  return (
    <div className="px-8 py-6 min-h-[420px] flex items-center justify-center">
      <Loading text="Loading LiteLLM usage…" />
    </div>
  );
}
