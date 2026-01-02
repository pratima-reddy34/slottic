'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext'; // Import useAuth to access authentication state
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode; // The component to be protected
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth(); // Access user and loading state from AuthContext
  const router = useRouter(); // Access Next.js router for redirection

  useEffect(() => {
    if (!loading && !user) {
      // If not authenticated and not loading, redirect to login
      router.push('/login'); // Change '/login' to the route of your login page
    }
  }, [user, loading, router]); // Dependency array ensures it triggers when user state or loading changes

  // While the auth state is loading, you can show a loading spinner or keep the component hidden
  if (loading) {
    return <div>Loading...</div>;
  }

  // If authenticated, render the children (protected content)
  return <>{user ? children : null}</>;
};

export default ProtectedRoute;
