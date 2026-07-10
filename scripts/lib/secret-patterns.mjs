export const secretChecks = [
  {
    name: "private key block",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: "AWS-style access key",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  },
  {
    name: "authorization bearer token",
    pattern: /\bAuthorization\s*:\s*Bearer\s+[A-Za-z0-9._~+\/-]{16,}/i,
  },
  {
    name: "JSON private key or client secret",
    pattern: /["'](?:private_key|client_secret)["']\s*:\s*["'][^"'\r\n]{16,}["']/i,
  },
  {
    name: "npm auth token",
    pattern: /(?:^|\s)(?:_authToken|\/\/[^\s=]+\/:_authToken)\s*=\s*[^\s#<]{8,}/im,
  },
  {
    name: "NCP IAM key literal",
    pattern: /\bncp_iam_[A-Za-z0-9]{12,}\b/,
  },
  {
    name: "NCP access key assignment",
    pattern: /^[ \t]*NCP_ACCESS_KEY_ID[ \t]*=[ \t]*[^ \t\r\n#<]{8,}/m,
  },
  {
    name: "NCP secret key assignment",
    pattern: /^[ \t]*NCP_SECRET_KEY[ \t]*=[ \t]*[^ \t\r\n#<]{8,}/m,
  },
  {
    name: "NCP CLOVA key assignment",
    pattern:
      /^[ \t]*NCP_CLOVASTUDIO_(?:API_KEY|API_GATEWAY_KEY)[ \t]*=[ \t]*[^ \t\r\n#<]{8,}/m,
  },
  {
    name: "NCP Object Storage key assignment",
    pattern:
      /^[ \t]*NCP_OBJECT_STORAGE_(?:ACCESS_KEY_ID|SECRET_KEY)[ \t]*=[ \t]*[^ \t\r\n#<]{8,}/m,
  },
  {
    name: "Kakao cloud secret assignment",
    pattern:
      /^[ \t]*KAKAO_CLOUD_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY|S3_ACCESS_KEY|S3_SECRET_KEY)[ \t]*=[ \t]*[^ \t\r\n#<]{8,}/m,
  },
  {
    name: "dashboard run token assignment",
    pattern: /^[ \t]*DASHBOARD_RUN_TOKEN[ \t]*=[ \t]*[^ \t\r\n#<]{8,}/m,
  },
];

export function findSecretMatches(content) {
  return secretChecks.filter((check) => check.pattern.test(content)).map((check) => check.name);
}
