import { Router } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, athletesTable, competitionsTable, jumpsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();
const text = (body: unknown, key: string) => {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" ? value.trim() : "";
};
const decimalValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return { value: null, valid: true };
  if (typeof value !== "string" && typeof value !== "number") return { value: null, valid: false };
  const raw = String(value).trim();
  if (!raw) return { value: null, valid: true };
  const normalized = raw.replace(/\s*m$/i, "").replace(",", ".").trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return { value: null, valid: false };
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0
    ? { value: number.toFixed(2), valid: true }
    : { value: null, valid: false };
};
const optionalNumber = (body: unknown, key: string) => {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
  return decimalValue(value);
};
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const routeId = (value: string | string[]) => Array.isArray(value) ? value[0] : value;
const jumpsFromBody = (body: unknown, competitionId: string) => {
  const rawJumps = body && typeof body === "object" && Array.isArray((body as Record<string, unknown>).jumps)
    ? (body as Record<string, unknown>).jumps as Array<Record<string, unknown>>
    : [];
  const jumps = Array.from({ length: 6 }, (_, index) => {
    const jump = rawJumps[index] ?? {};
    const parsedMark = decimalValue(jump.mark);
    return {
      value: { competitionId, jumpNumber: index + 1, mark: parsedMark.value, isFoul: Boolean(jump.isFoul) },
      valid: parsedMark.valid,
    };
  });
  return {
    jumps: jumps.map((jump) => jump.value),
    invalidJump: jumps.findIndex((jump) => !jump.valid) + 1,
  };
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
  const personalBest = optionalNumber(request.body, "personalBest");
  const seasonGoal = optionalNumber(request.body, "seasonGoal");
  const parsedJumps = jumpsFromBody(request.body, "");
  if (!athleteId || !location || !eventDate || !objective || !validDate(eventDate)) {
    response.status(400).json({ message: "Selecciona l’atleta i indica lloc, data vàlida i objectiu de la competició." });
    return;
  }
  if (typeof achieved !== "boolean") {
    response.status(400).json({ message: "Indica si s’ha assolit l’objectiu." });
    return;
  }
  if (!personalBest.valid || !seasonGoal.valid || parsedJumps.invalidJump) {
    response.status(400).json({
      message: parsedJumps.invalidJump
        ? `La marca del salt ${parsedJumps.invalidJump} no és vàlida. Utilitza un número, per exemple 15,34.`
        : "La millor marca personal i l’objectiu de temporada han de ser números vàlids.",
    });
    return;
  }
  const [athlete] = await db.select({ id: athletesTable.id }).from(athletesTable).where(and(eq(athletesTable.id, athleteId), eq(athletesTable.userId, request.user!.id))).limit(1);
  if (!athlete) {
    response.status(400).json({ message: "L’atleta seleccionat no és vàlid." });
    return;
  }
  const { competition, jumpValues } = await db.transaction(async (transaction) => {
    const [createdCompetition] = await transaction.insert(competitionsTable).values({
      userId: request.user!.id,
      athleteId,
      location,
      eventDate,
      objective,
      personalBest: personalBest.value,
      seasonGoal: seasonGoal.value,
      achieved,
      resultNote: text(request.body, "resultNote") || null,
    }).returning();
    const createdJumps = jumpsFromBody(request.body, createdCompetition.id).jumps;
    await transaction.insert(jumpsTable).values(createdJumps);
    return { competition: createdCompetition, jumpValues: createdJumps };
  });
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
  const personalBest = optionalNumber(request.body, "personalBest");
  const seasonGoal = optionalNumber(request.body, "seasonGoal");
  const parsedJumps = jumpsFromBody(request.body, competition.id);
  if (!location || !eventDate || !objective || !validDate(eventDate)) {
    response.status(400).json({ message: "Indica lloc, data vàlida i objectiu de la competició." });
    return;
  }
  if (typeof achieved !== "boolean") {
    response.status(400).json({ message: "Indica si s’ha assolit l’objectiu." });
    return;
  }
  if (athleteId !== competition.athleteId) {
    response.status(400).json({ message: "La competició no pertany a l’atleta seleccionat." });
    return;
  }
  if (!personalBest.valid || !seasonGoal.valid || parsedJumps.invalidJump) {
    response.status(400).json({
      message: parsedJumps.invalidJump
        ? `La marca del salt ${parsedJumps.invalidJump} no és vàlida. Utilitza un número, per exemple 15,34.`
        : "La millor marca personal i l’objectiu de temporada han de ser números vàlids.",
    });
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
  const jumpValues = parsedJumps.jumps;
  const updated = await db.transaction(async (transaction) => {
    const [updatedCompetition] = await transaction.update(competitionsTable).set({
      athleteId: athleteId || null,
      location,
      eventDate,
      objective,
      personalBest: personalBest.value,
      seasonGoal: seasonGoal.value,
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

router.delete("/competitions/:id", requireAuth, async (request, response) => {
  const competition = await competitionForUser(request.user!.id, routeId(request.params.id));
  if (!competition) {
    response.status(404).json({ message: "Competició no trobada." });
    return;
  }
  await db.delete(competitionsTable).where(and(
    eq(competitionsTable.id, competition.id),
    eq(competitionsTable.userId, request.user!.id),
  ));
  response.status(204).send();
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