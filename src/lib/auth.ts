// JWT-based session auth. Sessions are stored as an HTTP-only cookie signed
// with AUTH_SECRET. Keeps the deployable surface small (no external auth
// service required) while leaving room to swap in NextAuth / Clerk later.

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "./enums";

const COOKIE = "cdm_session";
const ALG = "HS256";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export type SessionPayload = {
  userId: string;
  email: string;
  role: Role;
  clientId: string | null;
  name: string;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(user: SessionPayload): Promise<string> {
  return await new SignJWT(user as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE);
}

export async function login(email: string, password: string): Promise<SessionPayload | null> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.status !== "ACTIVE") return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    role: user.role as Role,
    clientId: user.clientId,
    name: user.name,
  };
  const token = await createSession(payload);
  setSessionCookie(token);
  return payload;
}

export async function requireSession(): Promise<SessionPayload> {
  const s = await readSession();
  if (!s) throw new HttpError(401, "Not authenticated");
  return s;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
