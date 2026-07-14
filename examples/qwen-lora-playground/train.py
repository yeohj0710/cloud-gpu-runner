import json
import math
import os
import time
from pathlib import Path

import torch
from datasets import load_dataset
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM, AutoTokenizer, DataCollatorForLanguageModeling, Trainer, TrainingArguments

BASE_MODEL = "Qwen/Qwen2.5-7B-Instruct"
DATASET = "beomi/KoAlpaca-v1.1a"
OUTPUT = Path(os.environ.get("CGR_OUTPUT_DIR", "outputs"))
ADAPTER = OUTPUT / "adapter"
OUTPUT.mkdir(parents=True, exist_ok=True)
torch.manual_seed(903)

if not torch.cuda.is_available():
    raise RuntimeError("48GB급 CUDA GPU가 필요합니다.")

gpu = torch.cuda.get_device_name(0)
vram_gb = round(torch.cuda.get_device_properties(0).total_memory / 1024**3, 1)
if vram_gb < 40:
    raise RuntimeError(f"VRAM {vram_gb}GB: 이 실험은 48GB급 GPU용입니다.")

started = time.time()
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, use_fast=True)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"
raw = load_dataset(DATASET, split="train").shuffle(seed=903).select(range(2048))

def tokenize(row):
    user = row["instruction"] + (("\n\n추가 입력:\n" + row["input"]) if row.get("input") else "")
    text = tokenizer.apply_chat_template([
        {"role": "system", "content": "당신은 정확하고 이해하기 쉬운 한국어로 답하는 AI 도우미입니다."},
        {"role": "user", "content": user},
        {"role": "assistant", "content": row["output"]},
    ], tokenize=False, add_generation_prompt=False)
    return tokenizer(text, truncation=True, max_length=512)

dataset = raw.map(tokenize, remove_columns=raw.column_names, num_proc=2)
model = AutoModelForCausalLM.from_pretrained(BASE_MODEL, torch_dtype=torch.bfloat16, attn_implementation="sdpa")
model.config.use_cache = False
model.gradient_checkpointing_enable()
model = get_peft_model(model, LoraConfig(
    task_type="CAUSAL_LM", r=32, lora_alpha=64, lora_dropout=0.05, bias="none",
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
))
model.print_trainable_parameters()

args = TrainingArguments(
    output_dir=str(OUTPUT / "checkpoints"), max_steps=120,
    per_device_train_batch_size=2, gradient_accumulation_steps=8,
    learning_rate=2e-4, warmup_steps=10, lr_scheduler_type="cosine",
    bf16=True, gradient_checkpointing=True, logging_steps=10,
    save_strategy="no", report_to="none", optim="adamw_torch_fused",
)
trainer = Trainer(model=model, args=args, train_dataset=dataset, data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False))
result = trainer.train()
model.save_pretrained(ADAPTER, safe_serialization=True)
tokenizer.save_pretrained(ADAPTER)

summary = {
    "preset_id": "qwen-lora-v1", "base_model": BASE_MODEL, "dataset": DATASET,
    "samples": 2048, "steps": 120, "sequence_length": 512,
    "method": "BF16 LoRA", "lora_rank": 32, "train_loss": round(result.training_loss, 4),
    "perplexity": round(math.exp(min(20, result.training_loss)), 2),
    "seconds": round(time.time() - started, 1), "gpu": gpu, "vram_gb": vram_gb,
    "peak_vram_gb": round(torch.cuda.max_memory_allocated() / 1024**3, 1),
}
(OUTPUT / "model-metadata.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
print("CGR_MODEL_SUMMARY " + json.dumps(summary, ensure_ascii=False), flush=True)
