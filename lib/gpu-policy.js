export const LOCAL_GPU_BASELINE = { model: "RTX 5070 Ti", vram_gb: 16 };
export const MIN_CLOUD_GPU_VRAM_GB = 48;

export function gpuCapability(provider, flavor) {
  const name = String(typeof flavor === "string" ? flavor : flavor?.name || flavor?.serverSpecCode || "").toLowerCase();
  if (provider === "naver") {
    const count = Number(name.match(/^gp(\d+)/)?.[1] || 1);
    if (name.includes("ls")) return { provider, name, model: "L40S", count, vram_per_gpu_gb: 48 };
    if (name.includes("l4") || /^gp\d+l\d/.test(name)) return { provider, name, model: "L4", count, vram_per_gpu_gb: 24 };
  }
  if (provider === "kakao") {
    if (name.startsWith("p2i.")) {
      const count = name.includes("24xlarge") ? 4 : name.includes("12xlarge") ? 2 : 1;
      return { provider, name, model: "A100", count, vram_per_gpu_gb: 80 };
    }
    if (name.startsWith("gn1i.")) {
      const count = name.includes("12xlarge") ? 4 : 1;
      return { provider, name, model: "T4", count, vram_per_gpu_gb: 16 };
    }
  }
  return { provider, name, model: "unknown", count: 0, vram_per_gpu_gb: 0 };
}

export function isHighValueCloudGpu(provider, flavor) {
  return gpuCapability(provider, flavor).vram_per_gpu_gb >= MIN_CLOUD_GPU_VRAM_GB;
}

export function assertHighValueCloudGpu(provider, flavor) {
  const capability = gpuCapability(provider, flavor);
  if (capability.vram_per_gpu_gb < MIN_CLOUD_GPU_VRAM_GB) {
    throw new Error(`cloud_gpu_not_better_than_local:${capability.model}:${capability.vram_per_gpu_gb}GB`);
  }
  return capability;
}
