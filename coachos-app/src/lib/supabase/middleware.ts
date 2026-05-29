import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const authRoutes = ["/login", "/signup"];

function isProtectedRoute(pathname: string) {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding");
}

function isAuthRoute(pathname: string) {
  return authRoutes.includes(pathname);
}

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  redirectUrl.search = "";

  const redirectResponse = NextResponse.redirect(redirectUrl);

  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      redirectResponse.headers.set(key, value);
    }
  });

  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const isLoggedIn = !error && Boolean(claims);
  const pathname = request.nextUrl.pathname;

  if (!isLoggedIn && isProtectedRoute(pathname)) {
    return redirectWithCookies(request, response, "/login");
  }

  if (isLoggedIn && isAuthRoute(pathname)) {
    return redirectWithCookies(request, response, "/dashboard");
  }

  return response;
}
