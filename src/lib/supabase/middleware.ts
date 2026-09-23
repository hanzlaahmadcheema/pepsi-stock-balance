import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({
    request,
  });

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

  // Primary: Revalidate token against Supabase Auth servers.
  // Resilient Offline Fallback: If depot internet is down, timeout fast (2s)
  // and fall back to local session cookie so local operations are never blocked.
  let user = null;
  try {
    const res = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null }; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error("Supabase auth timeout")), 2000)
      ),
    ]);
    user = res.data?.user || null;
  } catch {
    // Offline mode: fallback to local session without remote network call
    try {
      const { data } = await supabase.auth.getSession();
      user = data.session?.user || null;
    } catch {
      user = null;
    }
  }

  return { response: supabaseResponse, user, supabase };
}
