import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { athleteMediaTable, athletesTable, db } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { createUploadTarget, getStoredFile, pipeStoredFile } from "../lib/objectStorage";

const router = Router();
const routeId = (value: string | string[]) => Array.isArray(value) ? value[0] : value;

router.post("/athlete-media/uploads", requireAuth, async (request, response) => {
  const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
  const athleteId = typeof body.athleteId === "string" ? body.athleteId : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  const mediaKind = body.mediaKind === "video" || body.mediaKind === "frame" ? body.mediaKind : "";
  const size = typeof body.size === "number" ? body.size : 0;
  if (!athleteId || !fileName || !contentType || !mediaKind || size <= 0 || size > 250 * 1024 * 1024) {
    response.status(400).json({ message: "Les dades del fitxer no són vàlides o el fitxer supera els 250 MB." });
    return;
  }
  if ((mediaKind === "video" && !contentType.startsWith("video/")) || (mediaKind === "frame" && !contentType.startsWith("image/"))) {
    response.status(400).json({ message: "El tipus de fitxer no coincideix amb el contingut." });
    return;
  }
  const [athlete] = await db.select({ id: athletesTable.id }).from(athletesTable)
    .where(and(eq(athletesTable.id, athleteId), eq(athletesTable.userId, request.user!.id)));
  if (!athlete) {
    response.status(404).json({ message: "Atleta no trobat." });
    return;
  }
  const target = await createUploadTarget();
  const [media] = await db.insert(athleteMediaTable).values({
    userId: request.user!.id,
    athleteId,
    objectPath: target.objectPath,
    fileName,
    contentType,
    mediaKind,
  }).returning();
  response.status(201).json({ media, uploadURL: target.uploadURL });
});

router.get("/athlete-media/:id", requireAuth, async (request, response) => {
  const [media] = await db.select().from(athleteMediaTable).where(and(
    eq(athleteMediaTable.id, routeId(request.params.id)),
    eq(athleteMediaTable.userId, request.user!.id),
  ));
  if (!media) {
    response.status(404).json({ message: "Fitxer no trobat." });
    return;
  }
  try {
    await pipeStoredFile(await getStoredFile(media.objectPath), request, response);
  } catch (error) {
    request.log.error({ err: error }, "Unable to serve athlete media");
    response.status(404).json({ message: "Fitxer no trobat." });
  }
});

export default router;