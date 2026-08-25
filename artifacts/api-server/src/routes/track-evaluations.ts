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
  const answers = ["approach", "rhythm", "landing"].map((key) => body[`${key}Answer`]);
  if (answers.some((answer) => typeof answer !== "string" || !answer)) {
    response.status(400).json({ message: "Respon les tres preguntes abans de guardar la valoració." });
    return;
  }
  const scores = ["approach", "rhythm", "landing"].map((key) => Number(body[`${key}Score`]));
  if (scores.some((score) => !Number.isFinite(score) || score < 0 || score > 10)) {
    response.status(400).json({ message: "Les puntuacions de la valoració no són vàlides." });
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
    approachScore: scores[0].toFixed(2),
    rhythmScore: scores[1].toFixed(2),
    landingScore: scores[2].toFixed(2),
    approachAnswer: answers[0] as string,
    rhythmAnswer: answers[1] as string,
    landingAnswer: answers[2] as string,
  }).returning();
  response.status(201).json({ evaluation });
});

export default router;