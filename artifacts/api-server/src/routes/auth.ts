import { Router } from "express";
import type { Request } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  authMiddleware,
  clearSessionCookie,
  createSession,
  deleteSession,
  hashPassword,
  normalizeEmail,
  requireAuth,
  setSessionCookie,
  sameOriginGuard,
  verifyPassword,
  SESSION_COOKIE,
} from "../lib/auth";

const router = Router();
const attempts = new Map<string, { count: number; resetAt: number }>();

function value(body: unknown, key: string) {
  if (!body || typeof body !== "object") return "";
  const candidate = (body as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate.trim() : "";
}

function rateLimit(request: Request) {
  const key = request.ip || "unknown";
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  if (current.count >= 12) return false;
  current.count += 1;
  return true;
}

router.get("/auth/me", authMiddleware, (request, response) => {
  response.json({ user: request.user ?? null });
});

router.post("/auth/register", sameOriginGuard, async (request, response) => {
  if (!rateLimit(request)) {
    response.status(429).json({ message: "Massa intents. Torna-ho a provar més tard." });
    return;
  }
  const firstName = value(request.body, "firstName");
  const lastName = value(request.body, "lastName");
  const email = normalizeEmail(value(request.body, "email"));
  const password = value(request.body, "password");
  if (!firstName || !lastName || !email || !password || password.length < 8 || !email.includes("@")) {
    response.status(400).json({ message: "Completa nom, cognom, correu vàlid i una contrasenya de 8 caràcters." });
    return;
  }
  try {
    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length) {
      response.status(409).json({ message: "Aquest correu ja té un compte." });
      return;
    }
    const [user] = await db.insert(usersTable).values({ firstName, lastName, email, passwordHash: await hashPassword(password) }).returning({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
    });
    const session = await createSession(user.id);
    setSessionCookie(response, session.token, session.expiresAt);
    response.status(201).json({ user });
  } catch (error) {
    request.log.error({ err: error }, "Registration failed");
    response.status(500).json({ message: "No s’ha pogut crear el compte." });
  }
});

router.post("/auth/login", sameOriginGuard, async (request, response) => {
  if (!rateLimit(request)) {
    response.status(429).json({ message: "Massa intents. Torna-ho a provar més tard." });
    return;
  }
  const email = normalizeEmail(value(request.body, "email"));
  const password = value(request.body, "password");
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      response.status(401).json({ message: "Correu o contrasenya incorrectes." });
      return;
    }
    const session = await createSession(user.id);
    setSessionCookie(response, session.token, session.expiresAt);
    response.json({ user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email } });
  } catch (error) {
    request.log.error({ err: error }, "Login failed");
    response.status(500).json({ message: "No s’ha pogut iniciar sessió." });
  }
});

router.post("/auth/logout", sameOriginGuard, async (request, response) => {
  try {
    await deleteSession(request.cookies?.[SESSION_COOKIE] as string | undefined);
    clearSessionCookie(response);
    response.status(204).send();
  } catch (error) {
    request.log.error({ err: error }, "Logout failed");
    response.status(500).json({ message: "No s’ha pogut tancar la sessió." });
  }
});

export { authMiddleware, requireAuth };
export default router;