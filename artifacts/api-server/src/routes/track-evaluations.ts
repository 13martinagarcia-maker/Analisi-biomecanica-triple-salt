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

router.get("/track-evaluations/:id", requireAuth, async (request, response): Promise<void> => {
  const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const [evaluation] = await db.select().from(trackEvaluationsTable).where(and(
    eq(trackEvaluationsTable.id, id),
    eq(trackEvaluationsTable.userId, request.user!.id),
  ));
  if (!evaluation) {
    response.status(404).json({ message: "No s’ha trobat la valoració." });
    return;
  }
  response.json({ evaluation });
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
      principalError: typeof criterion.principalError === "string" ? criterion.principalError : undefined,
      associatedErrors: Array.isArray(criterion.associatedErrors)
        ? criterion.associatedErrors.filter((error): error is string => typeof error === "string")
        : undefined,
      consequence: typeof criterion.consequence === "string" ? criterion.consequence : undefined,
      improvement: typeof criterion.improvement === "string" ? criterion.improvement : undefined,
    };
  });
  if (parsedCriteria.length !== 5 || parsedCriteria.some((criterion) =>
    !criterion.key || !criterion.question || !criterion.level || !criterion.criterion || !validScores.has(criterion.score)
  )) {
    response.status(400).json({ message: "Respon les cinc preguntes abans de guardar l’anàlisi." });
    return;
  }
  const finalScore = parsedCriteria.reduce((sum, criterion) => sum + criterion.score, 0) / parsedCriteria.length;
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const evaluationDate = typeof body.evaluationDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.evaluationDate)
    ? body.evaluationDate
    : "";
  if (!location || !evaluationDate) {
    response.status(400).json({ message: "Indica el dia i el lloc de la valoració." });
    return;
  }
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
    location,
    evaluationDate,
    approachScore: parsedCriteria[0].score.toFixed(2),
    rhythmScore: parsedCriteria[1].score.toFixed(2),
    landingScore: parsedCriteria[3].score.toFixed(2),
    approachAnswer: `${parsedCriteria[0].level}: ${parsedCriteria[0].criterion}`,
    rhythmAnswer: `${parsedCriteria[1].level}: ${parsedCriteria[1].criterion}`,
    landingAnswer: `${parsedCriteria[3].level}: ${parsedCriteria[3].criterion}`,
    finalScore: finalScore.toFixed(2),
    assessmentData: {
      schemaVersion: 2,
      criteria: parsedCriteria,
      validity: parsedCriteria[4],
    },
  }).returning();
  response.status(201).json({ evaluation });
});

router.patch("/track-evaluations/:id", requireAuth, async (request, response): Promise<void> => {
  const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
  const assessmentData = body.assessmentData && typeof body.assessmentData === "object"
    ? body.assessmentData as Record<string, unknown>
    : {};
  const rawCriteria = Array.isArray(body.criteria) ? body.criteria
    : Array.isArray(assessmentData.criteria) ? assessmentData.criteria : [];
  const validScores = new Set([0, 7, 8.5, 10]);
  const parsedCriteria = rawCriteria.map((item) => {
    const criterion = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      key: typeof criterion.key === "string" ? criterion.key : "",
      question: typeof criterion.question === "string" ? criterion.question : "",
      level: typeof criterion.level === "string" ? criterion.level : "",
      criterion: typeof criterion.criterion === "string" ? criterion.criterion : "",
      score: Number(criterion.score),
      principalError: typeof criterion.principalError === "string" ? criterion.principalError : undefined,
      associatedErrors: Array.isArray(criterion.associatedErrors)
        ? criterion.associatedErrors.filter((error): error is string => typeof error === "string")
        : undefined,
      consequence: typeof criterion.consequence === "string" ? criterion.consequence : undefined,
      improvement: typeof criterion.improvement === "string" ? criterion.improvement : undefined,
    };
  });
  if (parsedCriteria.length !== 5 || parsedCriteria.some((criterion) =>
    !criterion.key || !criterion.question || !criterion.level || !criterion.criterion || !validScores.has(criterion.score)
  )) {
    response.status(400).json({ message: "Respon les cinc preguntes abans de guardar l’anàlisi." });
    return;
  }
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const evaluationDate = typeof body.evaluationDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.evaluationDate)
    ? body.evaluationDate
    : "";
  if (!location || !evaluationDate) {
    response.status(400).json({ message: "Indica el dia i el lloc de la valoració." });
    return;
  }
  const athleteId = typeof body.athleteId === "string" ? body.athleteId : "";
  const [existing] = await db.select({
    id: trackEvaluationsTable.id,
    athleteId: trackEvaluationsTable.athleteId,
  }).from(trackEvaluationsTable).where(and(
    eq(trackEvaluationsTable.id, id),
    eq(trackEvaluationsTable.userId, request.user!.id),
  ));
  if (!existing) {
    response.status(404).json({ message: "No s’ha trobat la valoració." });
    return;
  }
  if (!athleteId || athleteId !== existing.athleteId) {
    response.status(400).json({ message: "La valoració no pertany a l’atleta seleccionat." });
    return;
  }
  const finalScore = parsedCriteria.reduce((sum, criterion) => sum + criterion.score, 0) / parsedCriteria.length;
  const [evaluation] = await db.update(trackEvaluationsTable).set({
    location,
    evaluationDate,
    approachScore: parsedCriteria[0].score.toFixed(2),
    rhythmScore: parsedCriteria[1].score.toFixed(2),
    landingScore: parsedCriteria[3].score.toFixed(2),
    approachAnswer: `${parsedCriteria[0].level}: ${parsedCriteria[0].criterion}`,
    rhythmAnswer: `${parsedCriteria[1].level}: ${parsedCriteria[1].criterion}`,
    landingAnswer: `${parsedCriteria[3].level}: ${parsedCriteria[3].criterion}`,
    finalScore: finalScore.toFixed(2),
    assessmentData: { ...assessmentData, schemaVersion: 2, criteria: parsedCriteria, validity: parsedCriteria[4] },
  }).where(and(
    eq(trackEvaluationsTable.id, id),
    eq(trackEvaluationsTable.userId, request.user!.id),
  )).returning();
  response.json({ evaluation });
});

router.delete("/track-evaluations/:id", requireAuth, async (request, response): Promise<void> => {
  const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const [deleted] = await db.delete(trackEvaluationsTable).where(and(
    eq(trackEvaluationsTable.id, id),
    eq(trackEvaluationsTable.userId, request.user!.id),
  )).returning({ id: trackEvaluationsTable.id });
  if (!deleted) {
    response.status(404).json({ message: "No s’ha trobat la valoració." });
    return;
  }
  response.status(204).send();
});

export default router;