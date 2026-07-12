import assert from "node:assert/strict";
import test from "node:test";
import { safeInstanceDescription } from "../lib/cloud-metadata.js";

test("instance description removes provider-rejected characters and line breaks", () => {
  const value = safeInstanceDescription(
    "Cloud Credit Lab · Work Memory 🎙️\nwhisper-transcription; max 60 minutes",
  );
  assert.equal(
    value,
    "Cloud Credit Lab Work Memory whisper-transcription; max 60 minutes",
  );
  assert.doesNotMatch(value, /[\r\n·🎙️]/u);
});
