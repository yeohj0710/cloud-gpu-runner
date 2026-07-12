import {
  parseBuckets,
  parseObjects,
  presignS3,
  s3Request,
} from "./s3-client.js";

function config() {
  return {
    endpoint:
      process.env.NCP_OBJECT_STORAGE_ENDPOINT ||
      "https://kr.object.ncloudstorage.com",
    region: process.env.NCP_OBJECT_STORAGE_REGION || "kr-standard",
    accessKey: process.env.NCP_OBJECT_STORAGE_ACCESS_KEY_ID,
    secretKey: process.env.NCP_OBJECT_STORAGE_SECRET_KEY,
  };
}

export async function listBuckets() {
  return parseBuckets((await s3Request(config())).body.toString("utf8"));
}
export async function createBucket(bucket) {
  await s3Request({ ...config(), method: "PUT", path: bucket });
}
export async function deleteBucket(bucket) {
  await s3Request({ ...config(), method: "DELETE", path: bucket });
}
export async function listObjects(bucket) {
  return parseObjects(
    (
      await s3Request({ ...config(), path: bucket, query: "list-type=2" })
    ).body.toString("utf8"),
  );
}
export async function uploadObject(bucket, key, data, contentType) {
  await s3Request({
    ...config(),
    method: "PUT",
    path: `${bucket}/${key}`,
    body: data,
    contentType,
  });
}
export async function downloadObject(bucket, key) {
  return s3Request({ ...config(), path: `${bucket}/${key}` });
}
export async function deleteObject(bucket, key) {
  await s3Request({ ...config(), method: "DELETE", path: `${bucket}/${key}` });
}
export function presignObject(bucket, key, method = "GET", expires = 3600) {
  return presignS3({ ...config(), method, path: `${bucket}/${key}`, expires });
}
export async function enableBrowserUploads(bucket) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><CORSConfiguration><CORSRule><AllowedOrigin>https://cloud-credit-lab-console.vercel.app</AllowedOrigin><AllowedOrigin>https://work-memory-ten.vercel.app</AllowedOrigin><AllowedMethod>PUT</AllowedMethod><AllowedMethod>GET</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>`;
  await s3Request({
    ...config(),
    method: "PUT",
    path: bucket,
    query: "cors=",
    body: Buffer.from(xml),
    contentType: "application/xml",
    contentMd5: true,
  });
}
