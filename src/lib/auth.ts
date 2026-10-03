/**
 * Authentication & authorization for ASIM AUTOS.
 *
 * - Passwords hashed with bcryptjs.
 * - Sessions are signed JWTs (jose, HS256) stored in an httpOnly cookie.
 * - Role checks are enforced here and MUST be called server-side in every
 *   server action / route handler. Never trust client-side role info.
 */

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

const COOKIE_NAME = "aa_session";
const SESSION_DAYS = 7;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "AUTH_SECRET must be set to a random string of at least 32 characters"
    );
  }
  return new TextEncoder().encode(s);
}

export type SessionUser = {
  id: string;
  shopId: string;
  name: string;
  email: string;
  role: "OWNER" | "STAFF";
};

export class AuthError extends Error {
  constructor(message = "Please log in to continue.") {
    super(message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function createSessionCookie(user: SessionUser): Promise<void> {
  const token = await signSession(user);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Returns the current session user, or null when not logged in. */
export async function getSession(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret());
    if (
      typeof payload.id !== "string" ||
      typeof payload.shopId !== "string" ||
      (payload.role !== "OWNER" && payload.role !== "STAFF")
    ) {
      return null;
    }
    // Re-check the user still exists and is active (server-side truth).
    const [user] = await db
      .select({
        id: users.id,
        shopId: users.shopId,
        name: users.name,
        email: users.email,
        role: users.role,
        active: users.active,
      })
      .from(users)
      .where(eq(users.id, payload.id as string))
      .limit(1);
    if (!user || !user.active) return null;
    return {
      id: user.id,
      shopId: user.shopId,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  } catch {
    return null;
  }
}

/** Throws AuthError when not logged in. */
export async function requireSession(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new AuthError();
  return s;
}

/**
 * Server-side role gate. OWNER passes everything; STAFF passes only when
 * "STAFF" is in the allowed list. Throws ForbiddenError otherwise.
 */
export async function requireRole(
  ...allowed: Array<"OWNER" | "STAFF">
): Promise<SessionUser> {
  const s = await requireSession();
  if (!allowed.includes(s.role)) {
    throw new ForbiddenError(
      "This action requires OWNER permission. Your STAFF account cannot perform it."
    );
  }
  return s;
}

/** Credential login. Returns the user on success, throws AuthError on failure. */
export async function loginWithPassword(
  email: string,
  password: string
): Promise<SessionUser> {
  const normalized = email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, normalized), eq(users.active, true)))
    .limit(1);
  if (!user) throw new AuthError("Invalid email or password.");
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new AuthError("Invalid email or password.");
  const sessionUser: SessionUser = {
    id: user.id,
    shopId: user.shopId,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  await createSessionCookie(sessionUser);
  return sessionUser;
}

export async function logout(): Promise<void> {
  await destroySessionCookie();
}
