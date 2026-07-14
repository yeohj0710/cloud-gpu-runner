import assert from "node:assert/strict";
import { assertHighValueCloudGpu, gpuCapability, isHighValueCloudGpu } from "../lib/gpu-policy.js";

assert.equal(isHighValueCloudGpu("naver", "gp1l4-g3"), false);
assert.equal(isHighValueCloudGpu("naver", "gp1ls16-g3"), true);
assert.equal(isHighValueCloudGpu("kakao", "gn1i.12xlarge"), false);
assert.equal(isHighValueCloudGpu("kakao", "p2i.6xlarge"), true);
assert.deepEqual(gpuCapability("kakao", "p2i.12xlarge"), { provider: "kakao", name: "p2i.12xlarge", model: "A100", count: 2, vram_per_gpu_gb: 80 });
assert.throws(() => assertHighValueCloudGpu("kakao", "gn1i.xlarge"), /cloud_gpu_not_better_than_local:T4:16GB/);
console.log("capability-first GPU policy tests passed");
