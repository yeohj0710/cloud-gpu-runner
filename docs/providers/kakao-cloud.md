# KakaoCloud

Status: organization and project identifiers are configured; IAM access key and S3 credentials are still missing.

## Credit Status

- Rocket Launcher Boost award: 20,000,000 KRW.
- Confirmed issued credit: 10,000,000 KRW.
- Confirmed expiration: 2027-05-31.
- Follow-up needed: confirm the condition and schedule for the remaining 10,000,000 KRW.

Do not count the 20,000,000 KRW award and the 10,000,000 KRW issuance as separate grants.

KakaoCloud is project-based. Most API calls and service credentials only become useful after a project exists and the current user or IAM key has a role in that project.

## Console Setup Checklist

1. Open KakaoCloud Console.
2. If the page says `No projects`, click `Go to organization management`.
3. Confirm the existing project under the `wellnessbox` organization.
4. Choose `kr-central-2` unless a specific service requires another region.
5. Assign the user as `Project Admin` for the new project.
6. Copy the project ID from the project dashboard.
7. Open the profile menu in the top right and go to `Credentials`.
8. Create an `IAM access key`. This is the current blocker.
9. Put the IAM access key ID, secret access key, region, and project ID in `.env.local`.

## Env Vars

```text
KAKAO_CLOUD_ACCESS_KEY_ID=
KAKAO_CLOUD_SECRET_ACCESS_KEY=
KAKAO_CLOUD_REGION=kr-central-2
KAKAO_CLOUD_ORGANIZATION_ID=
KAKAO_CLOUD_PROJECT_ID=
KAKAO_CLOUD_USER_ID=
KAKAO_CLOUD_AUTH_ENDPOINT=https://iam.kakaocloud.com/identity/v3/auth/tokens
```

## Local Checks

```powershell
npm run check:env:kakao
npm run kakao:token
npm run kakao:token:execute
```

`kakao:token` is a dry-run. `kakao:token:execute` requests an API authentication token and hides the token in output.

## Object Storage Notes

KakaoCloud Object Storage S3 usage has two phases:

1. Issue a KakaoCloud API token from the IAM access key.
2. Issue S3 credentials for the selected project, then use the S3 access key and secret key against the Object Storage endpoint.

Additional env vars:

```text
KAKAO_CLOUD_OBJECT_STORAGE_ENDPOINT=https://objectstorage.kr-central-2.kakaocloud.com
KAKAO_CLOUD_S3_ACCESS_KEY=
KAKAO_CLOUD_S3_SECRET_KEY=
```

Use only tiny create-upload-download-delete tests for the first run.

## First Paid Workload

Use `wellnessbox-rnd` only after the IAM and Object Storage checks pass:

1. Package one fixed 480-case replay job.
2. Record the local runtime and official frozen-eval metrics.
3. Run a single GPU-backed job with a 500,000 KRW cap.
4. Export reports to Object Storage.
5. Delete the VM, node pool, or Kubeflow resources immediately after the run.
