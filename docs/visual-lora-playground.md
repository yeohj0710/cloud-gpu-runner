# Visual LoRA Playground

## 선택한 실험

기존 `qwen-lora-v1`은 파이프라인 검증용 텍스트 트랙으로 유지한다. 기본 트랙은 `sdxl-lora-v1`이다. 기본 화면은 Hugging Face Diffusers 공식 강아지 예제 5장을 고정 리비전과 SHA-256으로 불러와 버튼 한 번으로 SDXL DreamBooth LoRA를 학습한다. 제품·캐릭터 이미지 5~12장을 직접 올리는 방식은 접힌 고급 메뉴로 유지한다.

학습 효과는 같은 프롬프트, 같은 seed로 만든 아래 이미지를 한 장의 비교 그리드로 보여준다.

1. 기본 SDXL
2. 최근 체크포인트 최대 3개
3. 최종 LoRA

SDXL을 먼저 선택한 이유는 공개 접근 가능한 기본 모델과 성숙한 공식 Diffusers 학습 스크립트를 사용해 FLUX보다 초기 다운로드·접근 승인 실패가 적기 때문이다. 공식 DreamBooth 문서가 `--checkpointing_steps`와 `--resume_from_checkpoint`를 지원하므로 누적 학습 요구도 별도 포맷 없이 충족한다.

- Diffusers DreamBooth: https://huggingface.co/docs/diffusers/training/dreambooth
- 고정 트레이너: https://github.com/huggingface/diffusers/blob/v0.35.1/examples/dreambooth/train_dreambooth_lora_sdxl.py

## 실행 경계

```text
브라우저
  ├─ 짧은 인증·작업 생성 요청 ──> Vercel Functions
  └─ 이미지 JSON 직접 PUT ─────> NAVER Object Storage

Vercel Functions
  └─ cloud-init 전달 ───────────> 일회성 L40S/A100 서버

GPU 서버
  ├─ SDXL 다운로드·학습·추론
  ├─ 100-step 체크포인트
  ├─ 120초마다 결과 tar/메타데이터 스냅샷 PUT
  └─ 짧은 상태 callback 후 자동 반납
```

Vercel은 학습 프로세스를 실행하거나 대기하지 않는다. 사용자가 탭을 닫으면 브라우저 polling도 중단되며, GPU 서버가 120초마다 보내는 짧은 callback만 발생한다. 따라서 GPU가 돌아가는 동안 Vercel CPU가 계속 점유되는 구조가 아니다. 별도 상시 CPU 서버는 비용과 운영 지점을 추가하므로 현재 단계에서는 도입하지 않는다.

## 체크포인트와 재개

- 첫 학습은 200/400/800 additional steps 중 하나를 선택한다.
- 100 step마다 Diffusers/Accelerate 상태와 LoRA weight를 `checkpoint-N`에 저장한다.
- GPU worker는 120초마다 `outputs/`를 같은 job artifact key로 갱신한다.
- `model-metadata.json`과 `checkpoint-manifest.json`에는 저장 완료가 확인된 checkpoint step만 기록한다.
- 이어 학습은 부모 artifact를 `/workspace/model-artifact`에 풀고, 기존 체크포인트를 새 output에 복사한 다음 `--resume_from_checkpoint latest`로 시작한다.
- 새 버전은 `parent_model_id`를 보존해 계보를 추적한다.

실패·시간 초과는 worker의 terminal upload 후 복구 버전으로 등록된다. 명시적 강제 취소는 서버를 먼저 삭제하므로 마지막 주기 snapshot까지만 보존하는 best-effort 방식이다. 최대 손실 구간은 보통 120초이며, snapshot 업로드 도중 공급자 서버가 사라지면 그 이전 snapshot이 기준이다.

## 데이터와 비용 안전

- 브라우저는 JPG/PNG/WebP 5~12장, 장당 15MB, 전체 80MB 이하만 허용한다.
- 이미지 본문은 Vercel request body를 통과하지 않고 presigned Object Storage URL로 직접 올라간다.
- 소스 ZIP에는 사용자 이미지나 자격 증명이 없다.
- 이미지 트랙은 48GB 이상 NVIDIA GPU만 허용한다. Qwen의 T4 fallback을 재사용하지 않는다.
- 유료 실행은 기존 비밀번호, 단일 활성 GPU 작업, 사전 비용 추정, 자동 종료·자원 반납 가드를 그대로 거친다.
- 이 구현 검증에서는 실제 GPU를 실행하지 않는다.
