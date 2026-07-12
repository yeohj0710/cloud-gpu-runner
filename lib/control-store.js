import { createBucket, downloadObject, uploadObject } from "./ncp-storage.js";

const bucket = () => process.env.NCP_ARTIFACT_BUCKET || "work-memory-control";
let bucketReady;

async function ensureBucket() {
  bucketReady ||= (async () => {
    try {
      await createBucket(bucket());
    } catch (error) {
      if (!/409|exist|already/i.test(String(error?.message))) throw error;
    }
    return true;
  })();
  return bucketReady;
}

export async function readJson(key, fallback) {
  try {
    return JSON.parse(
      (await downloadObject(bucket(), key)).body.toString("utf8"),
    );
  } catch (error) {
    if (/404|NoSuchKey|not found/i.test(String(error?.message)))
      return fallback;
    throw error;
  }
}

export async function writeJson(key, value) {
  await ensureBucket();
  await uploadObject(
    bucket(),
    key,
    Buffer.from(JSON.stringify(value, null, 2)),
    "application/json; charset=utf-8",
  );
  return value;
}

export function controlBucket() {
  return bucket();
}
