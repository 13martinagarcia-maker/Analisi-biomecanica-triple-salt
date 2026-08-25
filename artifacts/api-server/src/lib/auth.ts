import { createHash, createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, sessionsTable, usersTable } from "@workspace/db";

const scrypt = promisify(nodeScrypt);
export const SESSION_COOKIE = "triple_salt_session";
const SESSION_DAYS = 14;
const sessionSecret: string | undefined = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set for the API server.");
}

export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [, salt, expectedHex] = stored.split("$");
  if (!salt || !expectedHex) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashSessionToken(token: string) {
  return createHmac("sha256", sessionSecret as string).update(token).digest("hex");
}

export function safeTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });
  return { token, expiresAt };
}

export async function deleteSession(token: string | undefined) {
  if (!token) return;
  await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashSessionToken(token)));
}

export function setSessionCookie(response: Response, token: string, expiresAt: Date) {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: Response) {
  response.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function authMiddleware(request: Request, _response: Response, next: NextFunction) {
  try {
    const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) {
      const rows = await db
        .select({
          user: {
            id: usersTable.id,
            firstName: usersTable.firstName,
            lastName: usersTable.lastName,
            email: usersTable.email,
          },
        })
        .from(sessionsTable)
        .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
        .where(and(eq(sessionsTable.tokenHash, hashSessionToken(token)), gt(sessionsTable.expiresAt, new Date())))
        .limit(1);
      if (rows[0]?.user) request.user = rows[0].user;
    }
    next();
  } catch (error) {
    request.log?.error({ err: error }, "Unable to load session");
    next();
  }
}

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  if (!request.user) {
    response.status(401).json({ message: "Cal iniciar sessió per continuar." });
    return;
  }
  next();
}

export function sameOriginGuard(request: Request, response: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    next();
    return;
  }
  const origin = request.get("origin");
  if (!origin) {
    next();
    return;
  }
  try {
    if (new URL(origin).host !== request.get("host")) {
      response.status(403).json({ message: "Origen de petició no vàlid." });
      return;
    }
  } catch {
    response.status(403).json({ message: "Origen de petició no vàlid." });
    return;
  }
  next();
}