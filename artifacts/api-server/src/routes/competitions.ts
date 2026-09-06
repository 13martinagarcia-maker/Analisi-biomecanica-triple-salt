import { Router } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, athletesTable, competitionsTable, jumpsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();
const text = (body: unknown, key: string) => {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" ? value.trim() : "";
};
const optionalNumber = (body: unknown, key: string) => {
  const raw = text(body, key);
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value.toFixed(2) : null;
};
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const routeId = (value: string | string[]) => Array.isArray(value) ? value[0] : value;
const jumpsFromBody = (body: unknown, competitionId: string) => {
  const rawJumps = body && typeof body === "object" && Array.isArray((body as Record<string, unknown>).jumps)
    ? (body as Record<string, unknown>).jumps as Array<Record<string, unknown>>
    : [];
  return Array.from({ length: 6 }, (_, index) => {
    const jump = rawJumps[index] ?? {};
    const markRaw = typeof jump.mark === "string" ? jump.mark.replace(",", ".").trim() : "";
    const mark = markRaw && Number.isFinite(Number(markRaw)) ? Number(markRaw).toFixed(2) : null;
    return { competitionId, jumpNumber: index + 1, mark, isFoul: Boolean(jump.isFoul) };
  });
};

async function competitionForUser(userId: string, id: string) {
  const [competition] = await db.select().from(competitionsTable)
    .where(and(eq(competitionsTable.id, id), eq(competitionsTable.userId, userId))).limit(1);
  return competition;
}

router.get("/competitions", requireAuth, async (request, response) => {
  const competitions = await db.select().from(competitionsTable)
    .where(eq(competitionsTable.userId, request.user!.id))
    .orderBy(desc(competitionsTable.eventDate), desc(competitionsTable.createdAt));
  const allJumps = competitions.length
    ? await db.select().from(jumpsTable).where(inArray(jumpsTable.competitionId, competitions.map((competition) => competition.id))).orderBy(asc(jumpsTable.jumpNumber))
    : [];
  response.json({ competitions: competitions.map((competition) => ({
    ...competition,
    jumps: allJumps.filter((jump) => jump.competitionId === competition.id),
  })) });
});

router.get("/competitions/:id", requireAuth, async (request, response) => {
  const competition = await competitionForUser(request.user!.id, routeId(request.params.id));
  if (!competition) {
    response.status(404).json({ message: "Competició no trobada." });
    return;
  }
  const jumps = await db.select().from(jumpsTable).where(eq(jumpsTable.competitionId, competition.id)).orderBy(asc(jumpsTable.jumpNumber));
  response.json({ competition: { ...competition, jumps } });
});

router.post("/competitions", requireAuth, async (request, response) => {
  const location = text(request.body, "location");
  const eventDate = text(request.body, "eventDate");
  const objective = text(request.body, "objective");
  const athleteId = text(request.body, "athleteId");
  const achieved = request.body?.achieved;
  if (!location || !eventDate || !objective || !validDate(eventDate)) {
    response.status(400).json({ message: "Indica lloc, data vàlida i objectiu de la competició." });
    return;
  }
  if (typeof achieved !== "boolean") {
    response.status(400).json({ message: "Indica si s’ha assolit l’objectiu." });
    return;
  }
  if (athleteId) {
    const [athlete] = await db.select({ id: athletesTable.id }).from(athletesTable).where(and(eq(athletesTable.id, athleteId), eq(athletesTable.userId, request.user!.id))).limit(1);
    if (!athlete) {
      response.status(400).json({ message: "L’atleta seleccionat no és vàlid." });
      return;
    }
  }
  const [competition] = await db.insert(competitionsTable).values({
    userId: request.user!.id,
    athleteId: athleteId || null,
    location,
    eventDate,
    objective,
    personalBest: optionalNumber(request.body, "personalBest"),
    seasonGoal: optionalNumber(request.body, "seasonGoal"),
    achieved,
    resultNote: text(request.body, "resultNote") || null,
  }).returning();
  const jumpValues = jumpsFromBody(request.body, competition.id);
  await db.insert(jumpsTable).values(jumpValues);
  response.status(201).json({ competition: { ...competition, jumps: jumpValues } });
});

router.patch("/competitions/:id", requireAuth, async (request, response) => {
  const competition = await competitionForUser(request.user!.id, routeId(request.params.id));
  if (!competition) {
    response.status(404).json({ message: "Competició no trobada." });
    return;
  }
  const location = text(request.body, "location");
  const eventDate = text(request.body, "eventDate");
  const objective = text(request.body, "objective");
  const athleteId = text(request.body, "athleteId");
  const achieved = request.body?.achieved;
  if (!location || !eventDate || !objective || !validDate(eventDate)) {
    response.status(400).json({ message: "Indica lloc, data vàlida i objectiu de la competició." });
    return;
  }
  if (typeof achieved !== "boolean") {
    response.status(400).json({ message: "Indica si s’ha assolit l’objectiu." });
    return;
  }
  if (athleteId) {
    const [athlete] = await db.select({ id: athletesTable.id }).from(athletesTable)
      .where(and(eq(athletesTable.id, athleteId), eq(athletesTable.userId, request.user!.id))).limit(1);
    if (!athlete) {
      response.status(400).json({ message: "L’atleta seleccionat no és vàlid." });
      return;
    }
  }
  const jumpValues = jumpsFromBody(request.body, competition.id);
  const updated = await db.transaction(async (transaction) => {
    const [updatedCompetition] = await transaction.update(competitionsTable).set({
      athleteId: athleteId || null,
      location,
      eventDate,
      objective,
      personalBest: optionalNumber(request.body, "personalBest"),
      seasonGoal: optionalNumber(request.body, "seasonGoal"),
      achieved,
      resultNote: text(request.body, "resultNote") || null,
      updatedAt: new Date(),
    }).where(eq(competitionsTable.id, competition.id)).returning();
    await transaction.delete(jumpsTable).where(eq(jumpsTable.competitionId, competition.id));
    await transaction.insert(jumpsTable).values(jumpValues);
    return updatedCompetition;
  });
  response.json({ competition: { ...updated, jumps: jumpValues } });
});

router.patch("/competitions/:id/result", requireAuth, async (request, response) => {
  const achieved = request.body?.achieved;
  if (typeof achieved !== "boolean") {
    response.status(400).json({ message: "Indica si s’ha assolit l’objectiu." });
    return;
  }
  const competition = await competitionForUser(request.user!.id, routeId(request.params.id));
  if (!competition) {
    response.status(404).json({ message: "Competició no trobada." });
    return;
  }
  const [updated] = await db.update(competitionsTable).set({
    achieved,
    resultNote: text(request.body, "resultNote") || null,
    updatedAt: new Date(),
  }).where(eq(competitionsTable.id, competition.id)).returning();
  response.json({ competition: updated });
});

export default router;