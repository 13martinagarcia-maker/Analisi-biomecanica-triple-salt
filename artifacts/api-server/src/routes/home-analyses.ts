import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { athletesTable, db, homeAnalysesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/home-analyses", requireAuth, async (request, response) => {
  const analyses = await db.select().from(homeAnalysesTable)
    .where(eq(homeAnalysesTable.userId, request.user!.id))
    .orderBy(desc(homeAnalysesTable.analysisDate), desc(homeAnalysesTable.createdAt));
  response.json({ analyses });
});

router.post("/home-analyses", requireAuth, async (request, response) => {
  const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
  const athleteId = typeof body.athleteId === "string" && body.athleteId ? body.athleteId : null;
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const analysisDate = typeof body.analysisDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.analysisDate)
    ? body.analysisDate
    : "";
  const analysisData = body.analysisData && typeof body.analysisData === "object" ? body.analysisData : null;

  if (!athleteId || !location || !analysisDate || !analysisData) {
    response.status(400).json({ message: "Selecciona l’atleta i indica el dia i el lloc de l’anàlisi." });
    return;
  }

  const [athlete] = await db.select({ id: athletesTable.id }).from(athletesTable)
    .where(and(eq(athletesTable.id, athleteId), eq(athletesTable.userId, request.user!.id)));
  if (!athlete) {
    response.status(404).json({ message: "No s’ha trobat l’atleta seleccionat." });
    return;
  }

  const [analysis] = await db.insert(homeAnalysesTable).values({
    userId: request.user!.id,
    athleteId,
    location,
    analysisDate,
    analysisData,
  }).returning();

  response.status(201).json({ analysis });
});

export default router;