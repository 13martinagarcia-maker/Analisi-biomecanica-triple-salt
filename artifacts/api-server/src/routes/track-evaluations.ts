import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { athletesTable, competitionsTable, db, trackEvaluationsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/track-evaluations", requireAuth, async (request, response) => {
  const evaluations = await db.select().from(trackEvaluationsTable)
    .where(eq(trackEvaluationsTable.userId, request.user!.id))
    .orderBy(desc(trackEvaluationsTable.createdAt));
  response.json({ evaluations });
});

router.post("/track-evaluations", requireAuth, async (request, response) => {
  const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
  const criteria = Array.isArray(body.criteria) ? body.criteria : [];
  const validScores = new Set([0, 7, 8.5, 10]);
  const parsedCriteria = criteria.map((item) => {
    const criterion = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      key: typeof criterion.key === "string" ? criterion.key : "",
      question: typeof criterion.question === "string" ? criterion.question : "",
      level: typeof criterion.level === "string" ? criterion.level : "",
      criterion: typeof criterion.criterion === "string" ? criterion.criterion : "",
      score: Number(criterion.score),
    };
  });
  if (parsedCriteria.length !== 9 || parsedCriteria.some((criterion) =>
    !criterion.key || !criterion.question || !criterion.level || !criterion.criterion || !validScores.has(criterion.score)
  )) {
    response.status(400).json({ message: "Respon els nou criteris tècnics abans de guardar l’anàlisi." });
    return;
  }
  const validity = body.validity && typeof body.validity === "object" ? body.validity as Record<string, unknown> : {};
  const validityKey = typeof validity.key === "string" ? validity.key : "";
  const validityLevel = typeof validity.level === "string" ? validity.level : "";
  const validityDescription = typeof validity.description === "string" ? validity.description : "";
  const improvement = typeof validity.improvement === "string" ? validity.improvement : "";
  if (!["valid", "far", "foul"].includes(validityKey) || !validityLevel || !validityDescription || !improvement) {
    response.status(400).json({ message: "Indica si l’intent és vàlid o nul abans de guardar l’anàlisi." });
    return;
  }
  const finalScore = parsedCriteria.reduce((sum, criterion) => sum + criterion.score, 0) / parsedCriteria.length;
  const athleteId = typeof body.athleteId === "string" && body.athleteId ? body.athleteId : null;
  const competitionId = typeof body.competitionId === "string" && body.competitionId ? body.competitionId : null;
  const [athlete] = athleteId
    ? await db.select({ id: athletesTable.id }).from(athletesTable).where(and(eq(athletesTable.id, athleteId), eq(athletesTable.userId, request.user!.id)))
    : [];
  if (athleteId && !athlete) {
    response.status(404).json({ message: "No s’ha trobat l’atleta seleccionat." });
    return;
  }
  const [competition] = competitionId
    ? await db.select({ id: competitionsTable.id, athleteId: competitionsTable.athleteId }).from(competitionsTable)
      .where(and(eq(competitionsTable.id, competitionId), eq(competitionsTable.userId, request.user!.id)))
    : [];
  if (competitionId && !competition) {
    response.status(404).json({ message: "No s’ha trobat la competició seleccionada." });
    return;
  }
  if (athleteId && competition?.athleteId && competition.athleteId !== athleteId) {
    response.status(400).json({ message: "L’atleta i la competició seleccionats no coincideixen." });
    return;
  }
  const [evaluation] = await db.insert(trackEvaluationsTable).values({
    userId: request.user!.id,
    athleteId,
    competitionId,
    approachScore: parsedCriteria[0].score.toFixed(2),
    rhythmScore: parsedCriteria[6].score.toFixed(2),
    landingScore: parsedCriteria[3].score.toFixed(2),
    approachAnswer: `${parsedCriteria[0].level}: ${parsedCriteria[0].criterion}`,
    rhythmAnswer: `${parsedCriteria[6].level}: ${parsedCriteria[6].criterion}`,
    landingAnswer: `${parsedCriteria[3].level}: ${parsedCriteria[3].criterion}`,
    finalScore: finalScore.toFixed(2),
    assessmentData: {
      criteria: parsedCriteria,
      validity: {
        key: validityKey,
        level: validityLevel,
        description: validityDescription,
        improvement,
      },
    },
  }).returning();
  response.status(201).json({ evaluation });
});

export default router;