import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  LOCAL_SESSION_COOKIE,
  verifyLocalSession,
  signLocalSession,
  extractUserFromSupabaseCookies,
} from "@/lib/auth/session";

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({
    request,
  });

  // 1. FAST PATH: Check persistent local session cookie (0ms, 100% offline-proof)
  const localCookieValue = request.cookies.get(LOCAL_SESSION_COOKIE)?.value;
  if (localCookieValue) {
    const session = await verifyLocalSession(localCookieValue);
    if (session) {
      const user = {
        id: session.authUserId,
        email: session.email || `${session.name.toLowerCase().replace(/\s+/g, "")}@pepsidepot.local`,
        user_metadata: { name: session.name, role: session.role },
        app_metadata: { role: session.role },
        aud: "authenticated",
        created_at: new Date(session.createdAt).toISOString(),
      };
      return { response: supabaseResponse, user, supabase: null };
    }
  }

  // 2. OFFLINE EXTRACTION: Check existing Supabase auth cookies in the browser
  const allCookies = request.cookies.getAll();
  const extracted = extractUserFromSupabaseCookies(allCookies);
  if (extracted) {
    // Automatically mint persistent local session cookie so subsequent reloads are instantaneous
    const localToken = await signLocalSession({
      authUserId: extracted.id,
      role: (extracted.role as string) || "STAFF",
      name:
        (extracted.user_metadata?.name as string) ||
        extracted.email?.split("@")[0] ||
        "Depot User",
      email: extracted.email,
      createdAt: Date.now(),
    });

    supabaseResponse.cookies.set(LOCAL_SESSION_COOKIE, localToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60, // 1 year
    });
    request.cookies.set(LOCAL_SESSION_COOKIE, localToken);

    const user = {
      id: extracted.id,
      email: extracted.email || "user@pepsidepot.local",
      user_metadata: extracted.user_metadata || {},
      app_metadata: { role: extracted.role },
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };
    return { response: supabaseResponse, user, supabase: null };
  }

  // 3. Fallback: Initialize Supabase SSR client for online validation / token refresh
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { response: supabaseResponse, user: null, supabase: null };
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          supabaseResponse.cookies.set(name, value, options);
        });
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        }
      },
    },
  });

  let user = null;
  try {
    const res = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null }; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error("Supabase auth timeout")), 1500)
      ),
    ]);

    if (!res.error && res.data?.user) {
      user = res.data.user;
      const localToken = await signLocalSession({
        authUserId: user.id,
        role: user.app_metadata?.role || user.user_metadata?.role || "STAFF",
        name: user.user_metadata?.name || user.email?.split("@")[0] || "Depot User",
        email: user.email,
        createdAt: Date.now(),
      });
      supabaseResponse.cookies.set(LOCAL_SESSION_COOKIE, localToken, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
      });
      request.cookies.set(LOCAL_SESSION_COOKIE, localToken);
    }
  } catch {
    // Offline or network timeout
  }

  return { response: supabaseResponse, user, supabase };
}
