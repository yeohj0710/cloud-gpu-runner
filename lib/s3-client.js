import { createHash, createHmac } from "node:crypto";

const hash = value => createHash("sha256").update(value).digest("hex");
const hmac = (key, value, encoding) => createHmac("sha256", key).update(value).digest(encoding);

function encodePath(path) {
  return `/${path.split("/").filter(Boolean).map(encodeURIComponent).join("/")}`;
}

function parseXml(text, tag) {
  return [...text.matchAll(new RegExp(`<${tag}>(.*?)</${tag}>`, "gs"))].map(match => match[1]);
}

export async function s3Request({ endpoint, region, accessKey, secretKey, method = "GET", path = "", query = "", body = Buffer.alloc(0), contentType = "application/octet-stream", contentMd5 = false }) {
  const url = new URL(endpoint);
  const canonicalUri = encodePath(path);
  const canonicalQuery = query.split("&").filter(Boolean).sort().join("&");
  const date = new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = date.toISOString().slice(0, 10).replaceAll("-", "");
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const payloadHash = hash(payload);
  const headers = { host: url.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  if (method === "PUT" && payload.length > 0) headers["content-type"] = contentType;
  if (contentMd5) headers["content-md5"] = createHash("md5").update(payload).digest("base64");
  const headerNames = Object.keys(headers).sort();
  const canonicalHeaders = headerNames.map(name => `${name}:${headers[name]}\n`).join("");
  const signedHeaders = headerNames.join(";");
  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, hash(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), "s3"), "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");
  const requestHeaders = { ...headers, authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` };
  const response = await fetch(`${endpoint}${canonicalUri}${canonicalQuery ? `?${canonicalQuery}` : ""}`, { method, headers: requestHeaders, body: method === "GET" || method === "DELETE" ? undefined : payload, cache: "no-store" });
  const responseBody = Buffer.from(await response.arrayBuffer());
  if (!response.ok) throw new Error(`S3 HTTP ${response.status}: ${responseBody.toString("utf8").slice(0, 300)}`);
  return { status: response.status, headers: response.headers, body: responseBody };
}

export function presignS3({ endpoint, region, accessKey, secretKey, method = "GET", path, expires = 3600 }) {
  const url = new URL(endpoint), canonicalUri = encodePath(path), date = new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, ""), dateStamp = date.toISOString().slice(0, 10).replaceAll("-", ""), scope = `${dateStamp}/${region}/s3/aws4_request`;
  const params = new URLSearchParams({ "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": `${accessKey}/${scope}`, "X-Amz-Date": amzDate, "X-Amz-Expires": String(Math.min(604800, Math.max(60, expires))), "X-Amz-SignedHeaders": "host" });
  const canonicalQuery = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const canonicalRequest = [method, canonicalUri, canonicalQuery, `host:${url.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, hash(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), "s3"), "aws4_request"), signature = hmac(signingKey, stringToSign, "hex");
  return `${endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export function parseBuckets(xml) {
  const blocks = [...xml.matchAll(/<Bucket>(.*?)<\/Bucket>/gs)].map(match => match[1]);
  return blocks.map(block => ({ name: parseXml(block, "Name")[0], created_at: parseXml(block, "CreationDate")[0] }));
}

export function parseObjects(xml) {
  const blocks = [...xml.matchAll(/<Contents>(.*?)<\/Contents>/gs)].map(match => match[1]);
  return blocks.map(block => ({ key: parseXml(block, "Key")[0], size: Number(parseXml(block, "Size")[0] || 0), last_modified: parseXml(block, "LastModified")[0], etag: (parseXml(block, "ETag")[0] || "").replaceAll('"', "") }));
}
