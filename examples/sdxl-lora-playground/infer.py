from __future__ import annotations

import json
import os
import time
from pathlib import Path

import torch
from diffusers import DiffusionPipeline
from PIL import Image, ImageDraw

BASE_MODEL = "stabilityai/stable-diffusion-xl-base-1.0"


def find_artifact(root: Path) -> Path:
    candidates = [root / "outputs", root]
    candidates.extend(path.parent for path in root.rglob("model-metadata.json")) if root.exists() else None
    return next((path for path in candidates if (path / "pytorch_lora_weights.safetensors").exists() or list(path.glob("checkpoint-*"))), root)


def generate(pipe: DiffusionPipeline, prompt: str, seed: int) -> Image.Image:
    generator = torch.Generator(device="cuda").manual_seed(seed)
    return pipe(prompt=prompt, num_inference_steps=30, guidance_scale=7.0, height=768, width=768, generator=generator).images[0]


def main() -> int:
    started = time.monotonic()
    config = json.loads(Path(os.environ["CGR_DATA_FILE"]).read_text(encoding="utf-8"))
    prompt = str(config.get("prompt", "")).strip()[:500]
    seed = int(config.get("seed", 903))
    checkpoint_step = int(config.get("checkpoint_step", 0) or 0)
    if not prompt:
        raise ValueError("prompt_required")
    artifact = find_artifact(Path(os.environ["CGR_MODEL_DIR"]))
    lora_path = artifact / f"checkpoint-{checkpoint_step}" if checkpoint_step else artifact
    if not lora_path.exists():
        raise FileNotFoundError("checkpoint_not_found")
    output = Path(os.environ.get("CGR_OUTPUT_DIR", "outputs"))
    output.mkdir(parents=True, exist_ok=True)
    pipe = DiffusionPipeline.from_pretrained(BASE_MODEL, torch_dtype=torch.bfloat16, use_safetensors=True).to("cuda")
    base = generate(pipe, prompt, seed)
    pipe.load_lora_weights(str(lora_path))
    trained = generate(pipe, prompt, seed)
    canvas = Image.new("RGB", (1536, 824), "white")
    canvas.paste(base, (0, 56)); canvas.paste(trained, (768, 56))
    draw = ImageDraw.Draw(canvas)
    draw.text((18, 18), "BASE SDXL", fill="#191f28")
    draw.text((786, 18), f"LORA {checkpoint_step or 'FINAL'}", fill="#191f28")
    canvas.save(output / "preview-grid.jpg", "JPEG", quality=92, optimize=True)
    result = {"prompt": prompt, "seed": seed, "checkpoint_step": checkpoint_step, "seconds": round(time.monotonic() - started, 2), "gpu": torch.cuda.get_device_name(0)}
    (output / "inference.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print("CGR_IMAGE_INFERENCE " + json.dumps(result, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
