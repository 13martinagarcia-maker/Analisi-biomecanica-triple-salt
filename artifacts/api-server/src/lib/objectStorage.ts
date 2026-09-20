import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { Storage, type File } from "@google-cloud/storage";

const SIDECAR = "http://127.0.0.1:1106";

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function parsePath(path: string) {
  const parts = path.replace(/^\/+/, "").split("/");
  if (parts.length < 2) throw new Error("Ruta d’emmagatzematge no vàlida.");
  return { bucket: parts[0], object: parts.slice(1).join("/") };
}

function privateDir() {
  const value = process.env.PRIVATE_OBJECT_DIR;
  if (!value) throw new Error("PRIVATE_OBJECT_DIR no està configurat.");
  return value.replace(/\/+$/, "");
}

export async function createUploadTarget() {
  const fullPath = `${privateDir()}/athletes/${randomUUID()}`;
  const { bucket, object } = parsePath(fullPath);
  const response = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucket,
      object_name: object,
      method: "PUT",
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("No s’ha pogut preparar la pujada.");
  const data = await response.json() as { signed_url: string };
  return { uploadURL: data.signed_url, objectPath: `/objects/${object.split("/").slice(-2).join("/")}` };
}

export async function getStoredFile(objectPath: string): Promise<File> {
  if (!objectPath.startsWith("/objects/")) throw new Error("Ruta no vàlida.");
  const relative = objectPath.slice("/objects/".length);
  const { bucket, object } = parsePath(`${privateDir()}/${relative}`);
  const file = storage.bucket(bucket).file(object);
  const [exists] = await file.exists();
  if (!exists) throw new Error("Fitxer no trobat.");
  return file;
}

export async function pipeStoredFile(file: File, response: import("express").Response) {
  const [metadata] = await file.getMetadata();
  response.setHeader("Content-Type", metadata.contentType || "application/octet-stream");
  response.setHeader("Cache-Control", "private, max-age=3600");
  if (metadata.size) response.setHeader("Content-Length", String(metadata.size));
  Readable.from(file.createReadStream()).pipe(response);
}