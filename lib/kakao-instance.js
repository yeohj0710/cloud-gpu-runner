export function classifyKakaoInstance(instance) {
  if (!instance) return "pending";
  const status = String(instance.status || "").toLowerCase();
  const vmState = String(instance.vm_state || "").toLowerCase();
  if ([status, vmState].some((value) => ["error", "failed", "deleted"].includes(value))) return "failed";
  if (status === "active" && vmState !== "error" && !instance.task_state) return "ready";
  return "pending";
}
