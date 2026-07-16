from __future__ import annotations

import argparse
from pathlib import Path

import torch
from diffusers import DiffusionPipeline
from PIL import Image, ImageDraw

BASE_MODEL = "stabilityai/stable-diffusion-xl-base-1.0"


def generate(pipe: DiffusionPipeline, prompt: str, seed: int) -> Image.Image:
    generator = torch.Generator(device="cuda").manual_seed(seed)
    return pipe(prompt=prompt, num_inference_steps=30, guidance_scale=7.0, height=768, width=768, generator=generator).images[0]


def grid(items: list[tuple[str, Image.Image]], target: Path) -> None:
    width, height = items[0][1].size
    canvas = Image.new("RGB", (width * len(items), height + 56), "white")
    draw = ImageDraw.Draw(canvas)
    for index, (label, image) in enumerate(items):
        canvas.paste(image, (index * width, 56))
        draw.text((index * width + 18, 18), label, fill="#191f28")
    canvas.save(target, "JPEG", quality=92, optimize=True)


def checkpoint_directories(output: Path) -> list[Path]:
    checkpoints = []
    for path in output.glob("checkpoint-*"):
        if not path.is_dir():
            continue
        try:
            step = int(path.name.removeprefix("checkpoint-"))
        except ValueError:
            continue
        checkpoints.append((step, path))
    return [path for _, path in sorted(checkpoints)]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--seed", type=int, default=903)
    args = parser.parse_args()
    output = Path(args.output)
    pipe = DiffusionPipeline.from_pretrained(BASE_MODEL, torch_dtype=torch.bfloat16, use_safetensors=True).to("cuda")
    items = [("BASE SDXL", generate(pipe, args.prompt, args.seed))]
    checkpoints = checkpoint_directories(output)[-4:]
    for checkpoint in checkpoints:
        try:
            pipe.load_lora_weights(str(checkpoint))
            items.append((checkpoint.name.upper(), generate(pipe, args.prompt, args.seed)))
            pipe.unload_lora_weights()
        except Exception as error:
            print(f"Skipping {checkpoint.name} preview: {error}", flush=True)
    if not checkpoints:
        pipe.load_lora_weights(str(output))
        items.append(("FINAL LORA", generate(pipe, args.prompt, args.seed)))
    grid(items, output / "preview-grid.jpg")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
