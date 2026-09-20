import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { athleteMediaTable, athletesTable, db, homeAnalysesTable } from "@workspace/db";
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
  const mediaIds = Array.isArray(body.mediaIds)
    ? body.mediaIds.filter((value): value is string => typeof value === "string")
    : [];

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

  if (mediaIds.length) {
    const ownedMedia = await db.select({ id: athleteMediaTable.id }).from(athleteMediaTable).where(and(
      eq(athleteMediaTable.userId, request.user!.id),
      eq(athleteMediaTable.athleteId, athleteId),
    ));
    const ownedIds = new Set(ownedMedia.map((media) => media.id));
    if (mediaIds.some((id) => !ownedIds.has(id))) {
      response.status(400).json({ message: "Un dels fitxers no pertany a l’atleta seleccionat." });
      return;
    }
  }

  const analysis = await db.transaction(async (tx) => {
    const [created] = await tx.insert(homeAnalysesTable).values({
      userId: request.user!.id,
      athleteId,
      location,
      analysisDate,
      analysisData,
    }).returning();
    if (mediaIds.length) {
      for (const mediaId of mediaIds) {
        await tx.update(athleteMediaTable).set({ homeAnalysisId: created.id }).where(and(
          eq(athleteMediaTable.id, mediaId),
          eq(athleteMediaTable.userId, request.user!.id),
          eq(athleteMediaTable.athleteId, athleteId),
        ));
      }
    }
    return created;
  });

  response.status(201).json({ analysis });
});

export default router;