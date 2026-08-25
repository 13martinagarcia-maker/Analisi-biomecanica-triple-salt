import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, athletesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

const stringValue = (body: unknown, key: string) => {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" ? value.trim() : "";
};
const routeId = (value: string | string[]) => Array.isArray(value) ? value[0] : value;

router.get("/athletes", requireAuth, async (request, response) => {
  const rows = await db.select().from(athletesTable).where(eq(athletesTable.userId, request.user!.id)).orderBy(asc(athletesTable.lastName), asc(athletesTable.firstName));
  response.json({ athletes: rows });
});

router.post("/athletes", requireAuth, async (request, response) => {
  const firstName = stringValue(request.body, "firstName");
  const lastName = stringValue(request.body, "lastName");
  if (!firstName || !lastName) {
    response.status(400).json({ message: "El nom i el cognom de l’atleta són obligatoris." });
    return;
  }
  const [athlete] = await db.insert(athletesTable).values({
    userId: request.user!.id,
    firstName,
    lastName,
    goals: stringValue(request.body, "goals") || null,
    technicalNotes: stringValue(request.body, "technicalNotes") || null,
  }).returning();
  response.status(201).json({ athlete });
});

router.patch("/athletes/:id", requireAuth, async (request, response) => {
  const firstName = stringValue(request.body, "firstName");
  const lastName = stringValue(request.body, "lastName");
  if (!firstName || !lastName) {
    response.status(400).json({ message: "El nom i el cognom de l’atleta són obligatoris." });
    return;
  }
  const [athlete] = await db.update(athletesTable).set({
    firstName,
    lastName,
    goals: stringValue(request.body, "goals") || null,
    technicalNotes: stringValue(request.body, "technicalNotes") || null,
    updatedAt: new Date(),
  }).where(and(eq(athletesTable.id, routeId(request.params.id)), eq(athletesTable.userId, request.user!.id))).returning();
  if (!athlete) {
    response.status(404).json({ message: "Atleta no trobat." });
    return;
  }
  response.json({ athlete });
});

router.delete("/athletes/:id", requireAuth, async (request, response) => {
  const deleted = await db.delete(athletesTable).where(and(eq(athletesTable.id, routeId(request.params.id)), eq(athletesTable.userId, request.user!.id))).returning({ id: athletesTable.id });
  if (!deleted.length) {
    response.status(404).json({ message: "Atleta no trobat." });
    return;
  }
  response.status(204).send();
});

export default router;