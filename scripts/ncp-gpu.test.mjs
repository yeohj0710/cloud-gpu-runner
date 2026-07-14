import assert from "node:assert/strict";
import { buildLaunchConfigs, NCP_GPU_HOURLY, NCP_BLOCK_STORAGE_GIB_HOUR, NCP_PUBLIC_IP_HOURLY } from "../lib/ncp-gpu.js";
import { ncpPath } from "../lib/ncp-cloud.js";
import { gpuCost } from "../lib/gpu-resources.js";

assert.equal(NCP_GPU_HOURLY["gp1l4-g3"], 1447);
assert.equal(NCP_BLOCK_STORAGE_GIB_HOUR, 0.14);
assert.equal(NCP_PUBLIC_IP_HOURLY, 5.6);
assert.deepEqual(buildLaunchConfigs(
  [{ subnetNo: "s1", vpcNo: "v1", subnetName: "public", subnetType: { code: "PUBLIC" } }, { subnetNo: "s2", vpcNo: "v2", subnetName: "private", subnetType: { code: "PRIVATE" } }],
  [{ accessControlGroupNo: "a1", accessControlGroupName: "default", vpcNo: "v1" }, { accessControlGroupNo: "a2", accessControlGroupName: "wrong", vpcNo: "v3" }],
), [{ vpc_no: "v1", subnet_no: "s1", acg_no: "a1", zone_code: undefined, label: "public · default" }]);
const path = ncpPath("/vserver/v2/getServerSpecList", { regionCode: "KR", serverImageNo: "123" });
assert.ok(path.includes("regionCode=KR"));
assert.ok(path.includes("serverImageNo=123"));
assert.ok(path.endsWith("responseFormatType=json"));
const now = Date.parse("2026-07-13T01:00:00Z");
const cost = gpuCost({ provider: "naver", billing_started_at: "2026-07-13T00:00:00Z", hourly_rate: 1447, volume_gb: 80, disk_gib_hour_rate: 0.14 }, now);
assert.equal(cost.seconds, 3600);
assert.equal(cost.gpu, 1447);
assert.ok(Math.abs(cost.disk - 11.2) < 0.000001);
assert.equal(cost.publicIp, 5.6);
console.log("NCP GPU contract tests OK");
