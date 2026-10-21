import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/modules/auth/server';

/**
 * Root page - Redirects based on authentication status
 * - Admin users → /admin
 * - Customer users → /account
 * - Not authenticated → /auth/signin
 */
export default async function Home() {
  const session = await getServerSession(authOptions);

  // Check if user is authenticated
  if (!session) {
    redirect('/auth/signin');
  }

  // Redirect based on user role
  if (session.user.role === 'admin') {
    redirect('/admin');
  } else if (session.user.role === 'customer') {
    redirect('/account');
  }

  // Fallback to signin if role is not recognized
  redirect('/auth/signin');
}
