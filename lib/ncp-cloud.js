import { createHmac } from "node:crypto";

const DEFAULT_ENDPOINT = "https://ncloud.apigw.ntruss.com";

export async function ncp(path, endpoint = process.env.NCP_API_ENDPOINT || DEFAULT_ENDPOINT, { method = "GET", body, form } = {}) {
  const timestamp = String(Date.now());
  const access = process.env.NCP_ACCESS_KEY_ID;
  const secret = process.env.NCP_SECRET_KEY;
  if (!access || !secret) throw new Error("ncp_credentials_missing");
  const upper = method.toUpperCase();
  const payload = form ? new URLSearchParams(form).toString() : body ? JSON.stringify(body) : undefined;
  const signature = createHmac("sha256", secret)
    .update(`${upper} ${path}\n${timestamp}\n${access}`)
    .digest("base64");
  const response = await fetch(`${String(endpoint).replace(/\/$/, "")}${path}`, {
    method: upper,
    headers: {
      "content-type": form ? "application/x-www-form-urlencoded" : "application/json",
      "x-ncp-apigw-timestamp": timestamp,
      "x-ncp-iam-access-key": access,
      "x-ncp-apigw-signature-v2": signature,
    },
    body: payload,
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`NCP HTTP ${response.status} ${text.slice(0, 500)}`);
  const data = text ? JSON.parse(text) : {};
  const root = Object.values(data)[0];
  if (root?.returnCode && root.returnCode !== "0") throw new Error(`NCP ${root.returnCode} ${root.returnMessage || "request_failed"}`);
  return data;
}

export function ncpPath(path, params = {}) {
  const query = new URLSearchParams({ ...params, responseFormatType: "json" });
  return `${path}?${query}`;
}

export function ncpList(data, responseName, listName) {
  return data?.[responseName]?.[listName] || [];
}
