import assert from "node:assert/strict";
import { classifyKakaoInstance } from "../lib/kakao-instance.js";

assert.equal(classifyKakaoInstance(undefined), "pending");
assert.equal(classifyKakaoInstance({ status: "build", vm_state: "building" }), "pending");
assert.equal(classifyKakaoInstance({ status: "active", vm_state: "active", task_state: null }), "ready");
assert.equal(classifyKakaoInstance({ status: "error", vm_state: "error", task_state: null }), "failed");
assert.equal(classifyKakaoInstance({ status: "active", vm_state: "error", task_state: null }), "failed");

console.log("Kakao instance state tests OK");
