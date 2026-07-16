import assert from "node:assert/strict";
import { classifyKakaoInstance, kakaoInstanceFailure } from "../lib/kakao-instance.js";

assert.equal(classifyKakaoInstance(undefined), "pending");
assert.equal(classifyKakaoInstance({ status: "build", vm_state: "building" }), "pending");
assert.equal(classifyKakaoInstance({ status: "active", vm_state: "active", task_state: null }), "ready");
assert.equal(classifyKakaoInstance({ status: "error", vm_state: "error", task_state: null }), "failed");
assert.equal(classifyKakaoInstance({ status: "active", vm_state: "error", task_state: null }), "failed");
assert.equal(kakaoInstanceFailure({ status: "error" }), "kakao_gpu_unavailable");
assert.equal(kakaoInstanceFailure({ status: "error", fault: { message: "No valid host was found\nfor the request" } }), "kakao_gpu_unavailable: No valid host was found for the request");
assert.equal(kakaoInstanceFailure({ status: "error", status_reason: "Quota exceeded" }), "kakao_gpu_unavailable: Quota exceeded");

console.log("Kakao instance state tests OK");
