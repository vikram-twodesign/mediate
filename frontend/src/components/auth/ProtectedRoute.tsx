'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

type ProtectedRouteProps = {
  children: React.ReactNode;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      // User is not authenticated, redirect to login page with redirect back path
      // Ensure pathname is a string before encoding, default to '/' if null
      const redirectPath = pathname || '/';
      router.push(`/auth/login?redirectTo=${encodeURIComponent(redirectPath)}`);
    }
  }, [user, loading, router, pathname]);

  // Show nothing while checking authentication status
  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)] w-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
      </div>
    );
  }

  // If not loading and user exists, render children
  return user ? <>{children}</> : null;
} 