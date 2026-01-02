// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const protectedRoutes = ['/dashboard', '/admin'];
const authRoutes = ['/login', '/signup', '/forgot-password'];

const isProtectedRoute = (pathname: string) => {
  return protectedRoutes.some(route => pathname.startsWith(route));
};

const log = (message: string, details?: Record<string, any>) => {
  if (process.env.NODE_ENV === 'development' && message.startsWith('Decision:')) {
    console.log(`[Middleware] ${message}`, details || '');
  }
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authToken = request.cookies.get('firebaseAuthToken')?.value;

  const isProtectedPath = isProtectedRoute(pathname);
  const isAuthPath = authRoutes.includes(pathname);

  if (isProtectedPath && !authToken) {
    log('Decision: Auth required for protected route, no token. Redirecting to /login.', { path: pathname });
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectedFrom', pathname);
    loginUrl.searchParams.set('reason', 'protected_no_token_middleware');
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPath && authToken) {
    log('Decision: Authenticated user on auth route. Redirecting to /dashboard.', { path: pathname });
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
