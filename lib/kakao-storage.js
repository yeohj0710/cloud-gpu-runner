import { parseBuckets, parseObjects, s3Request } from "./s3-client.js";

function config() {
  const region = process.env.KAKAO_REGION || "kr-central-2";
  return { endpoint: `https://objectstorage.${region}.kakaocloud.com`, region, accessKey: process.env.KAKAO_S3_ACCESS_KEY, secretKey: process.env.KAKAO_S3_SECRET_KEY };
}

export async function listBuckets() { return parseBuckets((await s3Request(config())).body.toString("utf8")); }
export async function createBucket(bucket) { await s3Request({ ...config(), method: "PUT", path: bucket }); }
export async function deleteBucket(bucket) { await s3Request({ ...config(), method: "DELETE", path: bucket }); }
export async function listObjects(bucket) { return parseObjects((await s3Request({ ...config(), path: bucket, query: "list-type=2" })).body.toString("utf8")); }
export async function uploadObject(bucket, key, data, contentType) { await s3Request({ ...config(), method: "PUT", path: `${bucket}/${key}`, body: data, contentType }); }
export async function downloadObject(bucket, key) { return s3Request({ ...config(), path: `${bucket}/${key}` }); }
export async function deleteObject(bucket, key) { await s3Request({ ...config(), method: "DELETE", path: `${bucket}/${key}` }); }
