from __future__ import annotations

import base64
import hashlib
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

BASE_MODEL = "stabilityai/stable-diffusion-xl-base-1.0"
TRAINER_URL = "https://raw.githubusercontent.com/huggingface/diffusers/v0.35.1/examples/dreambooth/train_dreambooth_lora_sdxl.py"
TRAINER_SHA256 = "61e0597f925667cb052db5e1cd7be14527333bf906eba9cd8404722ee5b6dba6"
DEMO_DOG_REVISION = "7aac740a23542bde4c568131b815a9ed08a7e192"
DEMO_DOG_IMAGES = {
    "alvan-nee-9M0tSjb-cpA-unsplash.jpeg": "e3fa9ca85ccfba82a40d130ba3ca0b0aa63bc966676f643b5cb1947c8b4071cd",
    "alvan-nee-Id1DBHv4fbg-unsplash.jpeg": "a65d3a853b7c65dd4d394cb6b209f77666351d2bae7c6670c5677d8eb5981644",
    "alvan-nee-bQaAJCbNq3g-unsplash.jpeg": "4cda55c53c11843ed368eb8eb68fd79521ac7b839bdd70f8f89589cf7006ed97",
    "alvan-nee-brFsZ7qszSY-unsplash.jpeg": "9d8013d9efa2edb356e0f88c66de044f71247a99cab52b1628e753c2a08bb602",
    "alvan-nee-eoqnr8ikwFE-unsplash.jpeg": "5c9805758a8f8950a35df820f3bfc32b3c6ca2a0e0e214a7978ea147a233bd54",
}
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
PEAK_VRAM_GB = 0.0


def read_bundle(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    images = value.get("images") or []
    if not 5 <= len(images) <= 12:
        raise ValueError("image_count_must_be_5_to_12")
    value["steps_added"] = max(200, min(800, int(value.get("steps_added", 400))))
    value["checkpointing_steps"] = 100
    value["seed"] = int(value.get("seed", 903))
    value["trigger_word"] = str(value.get("trigger_word", "cgrx")).strip()[:40] or "cgrx"
    value["instance_prompt"] = str(value.get("instance_prompt", f"a photo of {value['trigger_word']} object")).strip()[:300]
    value["validation_prompt"] = str(value.get("validation_prompt", f"a studio product photo of {value['trigger_word']} object on a clean white background, soft lighting")).strip()[:500]
    if value["trigger_word"] not in value["instance_prompt"] or value["trigger_word"] not in value["validation_prompt"]:
        raise ValueError("prompts_must_include_trigger_word")
    return value


def decode_images(bundle: dict, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    Image.MAX_IMAGE_PIXELS = 50_000_000
    for index, item in enumerate(bundle["images"]):
        content_type = str(item.get("type", "")).lower()
        if content_type not in ALLOWED_TYPES:
            raise ValueError("unsupported_image_type")
        raw = base64.b64decode(str(item.get("data", "")), validate=True)
        if not raw or len(raw) > 15 * 1024 * 1024:
            raise ValueError("invalid_image_size")
        source = target / f"source-{index:02d}.bin"
        source.write_bytes(raw)
        try:
            with Image.open(source) as opened:
                image = ImageOps.exif_transpose(opened).convert("RGB")
                if min(image.size) < 256:
                    raise ValueError("image_too_small")
                image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
                image.save(target / f"image-{index:02d}.jpg", "JPEG", quality=95, optimize=True)
        finally:
            source.unlink(missing_ok=True)


def demo_bundle() -> dict:
    return {
        "images": [{"name": name} for name in DEMO_DOG_IMAGES],
        "dataset_name": "Hugging Face Diffusers dog example",
        "demo_id": "dog",
        "steps_added": 100,
        "checkpointing_steps": 100,
        "seed": 903,
        "trigger_word": "sks",
        "instance_prompt": "a photo of sks dog",
        "validation_prompt": "a studio photo of sks dog wearing blue sunglasses, clean background",
    }


def download_demo_images(target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    Image.MAX_IMAGE_PIXELS = 50_000_000
    for index, (name, expected_hash) in enumerate(DEMO_DOG_IMAGES.items()):
        url = f"https://huggingface.co/datasets/diffusers/dog-example/resolve/{DEMO_DOG_REVISION}/{name}"
        with urllib.request.urlopen(url, timeout=90) as response:
            raw = response.read(15 * 1024 * 1024 + 1)
        if not raw or len(raw) > 15 * 1024 * 1024 or hashlib.sha256(raw).hexdigest() != expected_hash:
            raise RuntimeError("demo_image_integrity_check_failed")
        source = target / f"demo-{index:02d}.bin"
        source.write_bytes(raw)
        try:
            with Image.open(source) as opened:
                image = ImageOps.exif_transpose(opened).convert("RGB")
                image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
                image.save(target / f"image-{index:02d}.jpg", "JPEG", quality=95, optimize=True)
        finally:
            source.unlink(missing_ok=True)


def find_output_root(root: Path) -> Path | None:
    candidates = [root / "outputs", root]
    candidates.extend(path.parent for path in root.rglob("model-metadata.json")) if root.exists() else None
    return next((path for path in candidates if path.exists() and (list(path.glob("checkpoint-*")) or (path / "pytorch_lora_weights.safetensors").exists())), None)


def checkpoint_steps(output: Path) -> list[int]:
    steps = []
    for path in output.glob("checkpoint-*"):
        try:
            step = int(path.name.split("-")[-1])
        except ValueError:
            continue
        if (path / "pytorch_lora_weights.safetensors").exists() and (path / "optimizer.bin").exists() and (path / "scheduler.bin").exists():
            steps.append(step)
    return sorted(set(steps))


def atomic_json(path: Path, value: dict) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def metadata(bundle: dict, output: Path, started: float, state: str) -> dict:
    global PEAK_VRAM_GB
    steps = checkpoint_steps(output)
    gpu, vram, peak = "GPU unavailable", 0.0, 0.0
    try:
        line = subprocess.check_output(["nvidia-smi", "--query-gpu=name,memory.total,memory.used", "--format=csv,noheader,nounits"], text=True, timeout=10).splitlines()[0]
        gpu, total_mib, used_mib = [item.strip() for item in line.split(",", 2)]
        vram = float(total_mib) / 1024
        PEAK_VRAM_GB = max(PEAK_VRAM_GB, float(used_mib) / 1024)
        peak = PEAK_VRAM_GB
    except Exception:
        pass
    return {
        "base_model": BASE_MODEL,
        "dataset": bundle.get("dataset_name", "user image bundle"),
        "demo_id": bundle.get("demo_id"),
        "samples": len(bundle["images"]),
        "image_count": len(bundle["images"]),
        "steps": steps[-1] if steps else int(bundle.get("parent_step", 0)),
        "steps_added": bundle["steps_added"],
        "resolution": 1024,
        "method": "BF16 DreamBooth LoRA",
        "lora_rank": 16,
        "seconds": round(time.monotonic() - started, 2),
        "gpu": gpu,
        "vram_gb": round(vram, 2),
        "peak_vram_gb": round(peak, 2),
        "seed": bundle["seed"],
        "trigger_word": bundle["trigger_word"],
        "instance_prompt": bundle["instance_prompt"],
        "validation_prompt": bundle["validation_prompt"],
        "checkpoint_steps": steps,
        "latest_checkpoint_step": steps[-1] if steps else int(bundle.get("parent_step", 0)),
        "training_state": state,
        "snapshot_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def write_state(bundle: dict, output: Path, started: float, state: str) -> dict:
    value = metadata(bundle, output, started, state)
    atomic_json(output / "model-metadata.json", value)
    atomic_json(output / "checkpoint-manifest.json", {"version": 1, "checkpoint_steps": value["checkpoint_steps"], "latest_checkpoint_step": value["latest_checkpoint_step"], "training_state": state, "updated_at": value["snapshot_at"]})
    return value


def fetch_trainer(target: Path) -> None:
    content = urllib.request.urlopen(TRAINER_URL, timeout=60).read()
    if hashlib.sha256(content).hexdigest() != TRAINER_SHA256:
        raise RuntimeError("diffusers_trainer_checksum_mismatch")
    target.write_bytes(content)


def main() -> int:
    started = time.monotonic()
    data_file = Path(os.environ.get("CGR_DATA_FILE", ""))
    output = Path(os.environ.get("CGR_OUTPUT_DIR", "outputs"))
    model_dir = Path(os.environ.get("CGR_MODEL_DIR", ""))
    output.mkdir(parents=True, exist_ok=True)
    demo_id = os.environ.get("CGR_DEMO", "").strip().lower()
    if demo_id:
        if demo_id != "dog":
            raise ValueError("unknown_demo")
        bundle = demo_bundle()
    else:
        if not data_file.is_file():
            raise FileNotFoundError("training_bundle_missing")
        bundle = read_bundle(data_file)
    previous = find_output_root(model_dir) if model_dir.exists() else None
    if previous:
        shutil.copytree(previous, output, dirs_exist_ok=True)
        (output / "preview-grid.jpg").unlink(missing_ok=True)
    existing_steps = checkpoint_steps(output)
    parent_step = existing_steps[-1] if existing_steps else 0
    bundle["parent_step"] = parent_step
    instance_dir = Path("/workspace/instance-images")
    if demo_id == "dog":
        download_demo_images(instance_dir)
    else:
        decode_images(bundle, instance_dir)
    write_state(bundle, output, started, "training")

    stop = threading.Event()

    def monitor() -> None:
        while not stop.wait(15):
            write_state(bundle, output, started, "training")

    watcher = threading.Thread(target=monitor, daemon=True)
    watcher.start()
    trainer = Path("/tmp/train_dreambooth_lora_sdxl.py")
    fetch_trainer(trainer)
    target_step = parent_step + bundle["steps_added"]
    command = [
        "accelerate", "launch", "--mixed_precision=bf16", str(trainer),
        "--pretrained_model_name_or_path", BASE_MODEL,
        "--instance_data_dir", str(instance_dir),
        "--output_dir", str(output),
        "--instance_prompt", bundle["instance_prompt"],
        "--resolution", "1024",
        "--train_batch_size", "1",
        "--gradient_accumulation_steps", "2",
        "--learning_rate", "1e-4",
        "--lr_scheduler", "constant",
        "--lr_warmup_steps", "0",
        "--max_train_steps", str(target_step),
        "--checkpointing_steps", str(bundle["checkpointing_steps"]),
        "--mixed_precision", "bf16",
        "--gradient_checkpointing",
        "--allow_tf32",
        "--rank", "16",
        "--seed", str(bundle["seed"]),
        "--report_to", "tensorboard",
    ]
    if parent_step:
        command.extend(["--resume_from_checkpoint", "latest"])
    try:
        subprocess.run(command, check=True)
    except BaseException:
        write_state(bundle, output, started, "interrupted")
        raise
    finally:
        stop.set()
        watcher.join(timeout=2)

    final = write_state(bundle, output, started, "completed")
    subprocess.run([sys.executable, str(Path(__file__).with_name("render_comparison.py")), "--output", str(output), "--prompt", bundle["validation_prompt"], "--seed", str(bundle["seed"])], check=True)
    print("CGR_MODEL_SUMMARY " + json.dumps(final, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
