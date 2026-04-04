import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";

const PUBLIC_ROUTES = ["/login", "/auth/callback"];
const MOBILE_ONLY_ROLES = ["fiscal"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Allow public routes
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    if (user) {
      // Redirect authenticated users away from login
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return supabaseResponse;
  }

  // Require authentication for all other routes
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Get user role from perfis table
  const { data: profile } = await supabase
    .from("perfis")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  // Fiscais only access /mobile (except /perfil — accessible to all roles)
  if (
    role &&
    MOBILE_ONLY_ROLES.includes(role) &&
    !pathname.startsWith("/mobile") &&
    !pathname.startsWith("/perfil")
  ) {
    return NextResponse.redirect(new URL("/mobile", request.url));
  }

  // Non-fiscais cannot access /mobile
  if (
    role &&
    !MOBILE_ONLY_ROLES.includes(role) &&
    pathname.startsWith("/mobile")
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}
