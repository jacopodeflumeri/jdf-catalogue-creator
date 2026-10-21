import Loading from '@/components/ui/Loading';

export default function VerifyLoadingPage() {
  return (
      <div className="flex-1 bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center py-8">
            <Loading size="lg" text="&nbsp;" />
          </div>
        </div>
      </div>
  );
}
