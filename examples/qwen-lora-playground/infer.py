import json
import os
import time
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

BASE_MODEL = "Qwen/Qwen2.5-7B-Instruct"
model_root = Path(os.environ["CGR_MODEL_DIR"])
adapter_config = next(model_root.rglob("adapter_config.json"), None)
if not adapter_config:
    raise RuntimeError("저장된 LoRA 어댑터를 찾지 못했습니다.")
adapter = adapter_config.parent
prompt_path = Path(os.environ["CGR_DATA_FILE"])
prompt = prompt_path.read_text(encoding="utf-8").strip()
if not prompt:
    raise RuntimeError("질문이 비어 있습니다.")

started = time.time()
tokenizer = AutoTokenizer.from_pretrained(adapter)
base = AutoModelForCausalLM.from_pretrained(BASE_MODEL, torch_dtype=torch.bfloat16, attn_implementation="sdpa").to("cuda")
model = PeftModel.from_pretrained(base, adapter).eval()
messages = [
    {"role": "system", "content": "당신은 정확하고 이해하기 쉬운 한국어로 답하는 AI 도우미입니다."},
    {"role": "user", "content": prompt},
]
text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = tokenizer(text, return_tensors="pt").to("cuda")
with torch.inference_mode():
    output = model.generate(**inputs, max_new_tokens=256, do_sample=True, temperature=0.7, top_p=0.9)
answer = tokenizer.decode(output[0][inputs.input_ids.shape[1]:], skip_special_tokens=True).strip()
result = {
    "prompt": prompt, "answer": answer, "seconds": round(time.time() - started, 2),
    "input_tokens": int(inputs.input_ids.shape[1]), "output_tokens": int(output.shape[1] - inputs.input_ids.shape[1]),
    "gpu": torch.cuda.get_device_name(0), "base_model": BASE_MODEL,
}
output_dir = Path(os.environ.get("CGR_OUTPUT_DIR", "outputs"))
output_dir.mkdir(parents=True, exist_ok=True)
(output_dir / "inference.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print("CGR_INFERENCE " + json.dumps(result, ensure_ascii=False), flush=True)
