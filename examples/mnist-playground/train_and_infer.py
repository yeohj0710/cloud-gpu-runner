import json
import os
import random
import time
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms


SEED = 903
random.seed(SEED)
torch.manual_seed(SEED)
torch.cuda.manual_seed_all(SEED)
torch.backends.cudnn.deterministic = True
torch.backends.cudnn.benchmark = False

if not torch.cuda.is_available():
    raise RuntimeError("CUDA GPU를 찾지 못했습니다.")

device = torch.device("cuda")
output_dir = Path(os.environ.get("CGR_OUTPUT_DIR", "outputs"))
output_dir.mkdir(parents=True, exist_ok=True)
data_dir = Path("/tmp/mnist-data")
transform = transforms.Compose([transforms.ToTensor(), transforms.Normalize((0.1307,), (0.3081,))])
train_set = datasets.MNIST(data_dir, train=True, download=True, transform=transform)
test_set = datasets.MNIST(data_dir, train=False, download=True, transform=transform)
train_loader = DataLoader(train_set, batch_size=512, shuffle=True, num_workers=2, pin_memory=True)
test_loader = DataLoader(test_set, batch_size=1024, shuffle=False, num_workers=2, pin_memory=True)

model = nn.Sequential(
    nn.Flatten(),
    nn.Linear(28 * 28, 256),
    nn.ReLU(),
    nn.Dropout(0.15),
    nn.Linear(256, 10),
).to(device)
optimizer = torch.optim.AdamW(model.parameters(), lr=0.002)
criterion = nn.CrossEntropyLoss()
metrics = []
started = time.time()

print(f"CGR_DEVICE {torch.cuda.get_device_name(0)}", flush=True)
for epoch in range(1, 4):
    model.train()
    running_loss = 0.0
    for images, labels in train_loader:
        images, labels = images.to(device, non_blocking=True), labels.to(device, non_blocking=True)
        optimizer.zero_grad(set_to_none=True)
        loss = criterion(model(images), labels)
        loss.backward()
        optimizer.step()
        running_loss += loss.item() * images.size(0)

    model.eval()
    correct = 0
    with torch.inference_mode():
        for images, labels in test_loader:
            predictions = model(images.to(device, non_blocking=True)).argmax(dim=1).cpu()
            correct += int((predictions == labels).sum())
    metric = {
        "epoch": epoch,
        "loss": round(running_loss / len(train_set), 4),
        "accuracy": round(correct / len(test_set) * 100, 2),
    }
    metrics.append(metric)
    print("CGR_METRIC " + json.dumps(metric, ensure_ascii=False), flush=True)

model.eval()
images, labels = next(iter(test_loader))
with torch.inference_mode():
    probabilities = model(images[:10].to(device)).softmax(dim=1).cpu()
predictions = []
for index in range(10):
    item = {
        "sample": index + 1,
        "answer": int(labels[index]),
        "prediction": int(probabilities[index].argmax()),
        "confidence": round(float(probabilities[index].max()) * 100, 1),
    }
    predictions.append(item)
    print("CGR_PREDICTION " + json.dumps(item, ensure_ascii=False), flush=True)

summary = {
    "device": torch.cuda.get_device_name(0),
    "training_samples": len(train_set),
    "test_samples": len(test_set),
    "seconds": round(time.time() - started, 1),
    "final_accuracy": metrics[-1]["accuracy"],
}
torch.save({"model_state": model.state_dict(), "summary": summary}, output_dir / "model.pt")
(output_dir / "metrics.json").write_text(json.dumps({"summary": summary, "epochs": metrics}, ensure_ascii=False, indent=2), encoding="utf-8")
(output_dir / "predictions.json").write_text(json.dumps(predictions, ensure_ascii=False, indent=2), encoding="utf-8")
print("CGR_SUMMARY " + json.dumps(summary, ensure_ascii=False), flush=True)
