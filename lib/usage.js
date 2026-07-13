import { randomUUID } from "node:crypto";
import { readJson, writeJson } from "./control-store.js";

const KEY = "control/usage.json";
export const CREDITS = { kakao: 10000000, naver: 5300000 };
export const KAKAO_GPU_HOURLY = {
  "gn1i.xlarge": 648,
  "gn1i.2xlarge": 856,
  "gn1i.4xlarge": 1272,
  "gn1i.8xlarge": 2104,
  "gn1i.12xlarge": 4256,
  "gn1i.16xlarge": 3768,
  "gf1i.6xlarge": 3960,
  "gf1i.12xlarge": 7920,
  "gf1i.24xlarge": 15840,
  "p2i.6xlarge": 5334,
  "p2i.12xlarge": 10668,
  "p2i.24xlarge": 21590,
};
export const KAKAO_PUBLIC_IP_HOURLY = 5.5;
export const NAVER_GPU_HOURLY = {
  "gp1l4-g3": 1447, "gp1l8-g3": 1550, "gp2l8-g3": 2893,
  "gp2l16-g3": 3100, "gp4l16-g3": 4721, "gp4l32-g3": 5501,
  "gp1ls16-g3": 4309, "gp1ls32-g3": 5504, "gp2ls32-g3": 8617,
  "gp2ls64-g3": 11007, "gp4ls64-g3": 16401, "gp4ls120-g3": 20782,
};
export const NAVER_BLOCK_STORAGE_GIB_HOUR = 0.14;
export const NAVER_PUBLIC_IP_HOURLY = 5.6;
export const STORAGE = {
  naver: { gib_hour: 28 / 720, put: 0.0045, get: 0.0004 },
  kakao: { gib_hour: 0.0375, put: 0.0042, get: 0.0004 },
};
export function estimateStorage(provider, bytes, days = 30, requests = { put: 1, get: 0 }) {
  const price = STORAGE[provider];
  if (!price) throw new Error("unknown_provider");
  const storage = (Math.max(0, Number(bytes) || 0) / 1073741824) * price.gib_hour * (Math.max(0, Number(days) || 0) * 24);
  const request = (Number(requests.put) || 0) * price.put + (Number(requests.get) || 0) * price.get;
  return { provider, bytes: Number(bytes) || 0, days: Number(days) || 0, storage, request, total: storage + request, currency: "KRW", vat_included: false };
}
export function estimateGpu(flavor, minutes, volumeGb = 80) {
  const hourly = KAKAO_GPU_HOURLY[flavor];
  if (!hourly) throw new Error("unknown_gpu_flavor");
  const hours = Math.max(0, Number(minutes) || 0) / 60;
  const gpu = hourly * hours;
  const disk = Math.max(0, Number(volumeGb) || 0) * 0.16 * hours;
  const publicIp = KAKAO_PUBLIC_IP_HOURLY * hours;
  const objectRequests = STORAGE.naver.get * 2 + STORAGE.naver.put * 2;
  return { provider: "kakao", flavor, minutes: Number(minutes) || 0, volume_gb: Number(volumeGb) || 0, gpu, disk, public_ip: publicIp, object_requests: objectRequests, total: gpu + disk + publicIp + objectRequests, currency: "KRW", vat_included: false };
}
export function estimateProviderGpu(provider, flavor, minutes, volumeGb = 80) {
  if (provider === "kakao") return estimateGpu(flavor, minutes, volumeGb);
  if (provider !== "naver") throw new Error("unknown_gpu_provider");
  const hourly = NAVER_GPU_HOURLY[flavor];
  if (!hourly) throw new Error("unknown_gpu_flavor");
  const hours = Math.max(0, Number(minutes) || 0) / 60;
  const gpu = hourly * hours;
  const disk = Math.max(0, Number(volumeGb) || 0) * NAVER_BLOCK_STORAGE_GIB_HOUR * hours;
  const objectRequests = STORAGE.naver.get * 2 + STORAGE.naver.put * 2;
  const publicIp = NAVER_PUBLIC_IP_HOURLY * hours;
  return { provider, flavor, minutes: Number(minutes) || 0, volume_gb: Number(volumeGb) || 0, gpu, disk, public_ip: publicIp, object_requests: objectRequests, total: gpu + disk + publicIp + objectRequests, currency: "KRW", vat_included: false };
}
async function state() {
  return readJson(KEY, { version: 1, events: [], objects: {} });
}
export async function addUsage(event) {
  const data = await state(),
    item = {
      id: randomUUID(),
      created_at: new Date().toISOString(),
      ...event,
      amount: Number(event.amount) || 0,
    };
  data.events = [...(data.events || []), item].slice(-5000);
  await writeJson(KEY, data);
  return item;
}
export async function startStorage(provider, bucket, key, size) {
  const data = await state(),
    id = `${provider}:${bucket}:${key}`,
    price = STORAGE[provider];
  data.objects[id] = {
    provider,
    bucket,
    key,
    size: Number(size) || 0,
    started_at: new Date().toISOString(),
    put_cost: price.put,
  };
  data.events = [
    ...(data.events || []),
    {
      id: randomUUID(),
      created_at: new Date().toISOString(),
      provider,
      category: "storage_request",
      action: "upload",
      label: key,
      amount: price.put,
      meta: { bucket, size: Number(size) || 0 },
    },
  ].slice(-5000);
  await writeJson(KEY, data);
}
export async function stopStorage(provider, bucket, key) {
  const data = await state(),
    id = `${provider}:${bucket}:${key}`,
    obj = data.objects?.[id];
  if (obj) {
    const hours = Math.max(
        0,
        (Date.now() - new Date(obj.started_at).getTime()) / 3600000,
      ),
      amount = (obj.size / 1073741824) * STORAGE[provider].gib_hour * hours;
    data.events = [
      ...(data.events || []),
      {
        id: randomUUID(),
        created_at: new Date().toISOString(),
        provider,
        category: "storage",
        action: "delete",
        label: key,
        amount,
        meta: { bucket, size: obj.size, hours },
      },
    ].slice(-5000);
    delete data.objects[id];
    await writeJson(KEY, data);
  }
}
export async function usageSummary() {
  const data = await state(),
    now = Date.now(),
    events = data.events || [],
    totals = { naver: 0, kakao: 0 },
    categories = {};
  for (const e of events) {
    totals[e.provider] = (totals[e.provider] || 0) + Number(e.amount || 0);
    categories[e.category] =
      (categories[e.category] || 0) + Number(e.amount || 0);
  }
  for (const obj of Object.values(data.objects || {})) {
    const hours = Math.max(
        0,
        (now - new Date(obj.started_at).getTime()) / 3600000,
      ),
      amount = (obj.size / 1073741824) * STORAGE[obj.provider].gib_hour * hours;
    totals[obj.provider] += amount;
    categories.storage = (categories.storage || 0) + amount;
  }
  return {
    credits: CREDITS,
    totals,
    remaining: {
      naver: CREDITS.naver - totals.naver,
      kakao: CREDITS.kakao - totals.kakao,
    },
    categories,
    objects: Object.values(data.objects || {}),
    events: events.slice().reverse(),
  };
}
