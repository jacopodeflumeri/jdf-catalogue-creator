import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Link from 'next/link';

interface ErrorPageProps {
  searchParams: Promise<{
    message?: string;
  }>;
}

export default async function MagicLinkErrorPage({ searchParams }: ErrorPageProps) {
  const params = await searchParams;
  const errorMessage = params.message || 'Verification failed';

  return (
    <div className="flex-1 bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <Icon type="x" className="text-red-600" size="lg" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            Verification Failed
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {decodeURIComponent(errorMessage)}
          </p>
        </div>
      </div>
      
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <div className="text-center">
            <div className="space-y-4">
              <div className="space-y-2">
                <Link href="/auth/signin">
                  <Button variant="primary" className="w-full">
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
