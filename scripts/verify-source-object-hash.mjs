import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const [objectKey, sourcePath] = process.argv.slice(2);
if (!objectKey || !sourcePath) {
  throw new Error("Usage: node scripts/verify-source-object-hash.mjs <object-key> <source-path>");
}

const forgeUrl = process.env.BUILT_IN_FORGE_API_URL?.replace(/\/+$/, "");
const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;
if (!forgeUrl || !forgeKey) throw new Error("Storage configuration is unavailable.");

const presign = new URL("v1/storage/presign/get", `${forgeUrl}/`);
presign.searchParams.set("path", objectKey);
const presignResponse = await fetch(presign, { headers: { Authorization: `Bearer ${forgeKey}` } });
if (!presignResponse.ok) throw new Error(`Could not access stored source (${presignResponse.status}).`);

const { url } = await presignResponse.json();
const objectResponse = await fetch(url);
if (!objectResponse.ok) throw new Error(`Could not retrieve stored source (${objectResponse.status}).`);

const [source, stored] = await Promise.all([readFile(sourcePath), objectResponse.arrayBuffer().then(value => Buffer.from(value))]);
const digest = value => createHash("sha256").update(value).digest("hex");
const sourceHash = digest(source);
const storedHash = digest(stored);

console.log(JSON.stringify({ sourceBytes: source.byteLength, storedBytes: stored.byteLength, identical: sourceHash === storedHash, sourceSha256: sourceHash, storedSha256: storedHash }));
if (sourceHash !== storedHash) process.exitCode = 1;
