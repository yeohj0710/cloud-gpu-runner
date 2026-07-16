export function classifyKakaoInstance(instance) {
  if (!instance) return "pending";
  const status = String(instance.status || "").toLowerCase();
  const vmState = String(instance.vm_state || "").toLowerCase();
  if ([status, vmState].some((value) => ["error", "failed", "deleted"].includes(value))) return "failed";
  if (status === "active" && vmState !== "error" && !instance.task_state) return "ready";
  return "pending";
}

export function kakaoInstanceFailure(instance) {
  const detail = instance?.fault?.message
    || instance?.fault?.details
    || instance?.status_reason
    || instance?.message;
  if (!detail) return "kakao_gpu_unavailable";
  const safeDetail = String(detail).replace(/\s+/g, " ").trim().slice(0, 160);
  return safeDetail ? `kakao_gpu_unavailable: ${safeDetail}` : "kakao_gpu_unavailable";
}
