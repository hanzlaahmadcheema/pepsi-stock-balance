export const LOCAL_SESSION_COOKIE = "pepsi_session";

export interface LocalSessionPayload {
  authUserId: string;
  userId?: string;
  role: string;
  name: string;
  email?: string;
  createdAt: number;
}

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "pepsi-depot-permanent-offline-secret-key-2026";

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToUint8Array(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Signs a local session payload with HMAC-SHA256 for tamper-proof storage in cookies.
 * Uses Web Crypto API for full compatibility with Edge Runtime and Node.js.
 */
export async function signLocalSession(payload: LocalSessionPayload): Promise<string> {
  const enc = new TextEncoder();
  const payloadStr = JSON.stringify(payload);
  const payloadBase64 = uint8ArrayToBase64Url(enc.encode(payloadStr));
  const key = await getHmacKey(SESSION_SECRET);
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(payloadBase64));
  const hmac = uint8ArrayToBase64Url(new Uint8Array(sigBuffer));
  return `${payloadBase64}.${hmac}`;
}

/**
 * Verifies an HMAC-SHA256 signed local session token and returns the payload if valid.
 * Uses Web Crypto API for full compatibility with Edge Runtime and Node.js.
 */
export async function verifyLocalSession(
  token: string | undefined | null
): Promise<LocalSessionPayload | null> {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  try {
    const [payloadBase64, hmac] = token.split(".");
    if (!payloadBase64 || !hmac) {
      return null;
    }

    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const key = await getHmacKey(SESSION_SECRET);
    const sigBytes = base64UrlToUint8Array(hmac);
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as unknown as BufferSource,
      enc.encode(payloadBase64)
    );

    if (!isValid) {
      return null;
    }

    const payloadBytes = base64UrlToUint8Array(payloadBase64);
    const payloadStr = dec.decode(payloadBytes);
    const payload = JSON.parse(payloadStr) as LocalSessionPayload;

    if (!payload.authUserId || !payload.role) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Resiliently extracts user credentials from Supabase session cookies (including chunked cookies).
 * Works offline even when JWT is expired or Supabase servers are unreachable.
 */
export function extractUserFromSupabaseCookies(
  allCookies: { name: string; value: string }[]
): {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  role?: string;
} | null {
  const authCookies = allCookies.filter(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  );

  if (authCookies.length === 0) {
    return null;
  }

  let rawValue = "";
  const single = authCookies.find((c) => !c.name.match(/\.\d+$/));
  if (single) {
    rawValue = single.value;
  } else {
    const chunkMap: Record<number, string> = {};
    for (const c of authCookies) {
      const match = c.name.match(/\.(\d+)$/);
      if (match) {
        chunkMap[parseInt(match[1], 10)] = c.value;
      }
    }
    const sortedIndices = Object.keys(chunkMap)
      .map(Number)
      .sort((a, b) => a - b);
    rawValue = sortedIndices.map((i) => chunkMap[i]).join("");
  }

  if (!rawValue) {
    return null;
  }

  let jsonString = rawValue;
  if (rawValue.startsWith("base64-")) {
    try {
      const dec = new TextDecoder();
      const bytes = base64UrlToUint8Array(rawValue.slice(7));
      jsonString = dec.decode(bytes);
    } catch {
      return null;
    }
  }

  try {
    const parsed = JSON.parse(jsonString);
    if (parsed.user?.id) {
      return {
        id: parsed.user.id,
        email: parsed.user.email,
        user_metadata: parsed.user.user_metadata || {},
        role: parsed.user.role || parsed.user.app_metadata?.role,
      };
    }

    const token = parsed.access_token || (Array.isArray(parsed) ? parsed[0] : null);
    if (token && typeof token === "string" && token.includes(".")) {
      const parts = token.split(".");
      if (parts.length >= 2) {
        const dec = new TextDecoder();
        const payloadBytes = base64UrlToUint8Array(parts[1]);
        const payload = JSON.parse(dec.decode(payloadBytes));
        if (payload.sub) {
          return {
            id: payload.sub,
            email: payload.email,
            user_metadata: payload.user_metadata || {},
            role: payload.role || payload.app_metadata?.role,
          };
        }
      }
    }
  } catch {
    if (rawValue.includes(".")) {
      const parts = rawValue.split(".");
      if (parts.length >= 2) {
        try {
          const dec = new TextDecoder();
          const payloadBytes = base64UrlToUint8Array(parts[1]);
          const payload = JSON.parse(dec.decode(payloadBytes));
          if (payload.sub) {
            return {
              id: payload.sub,
              email: payload.email,
              user_metadata: payload.user_metadata || {},
              role: payload.role || payload.app_metadata?.role,
            };
          }
        } catch {
          // ignore
        }
      }
    }
  }

  return null;
}
