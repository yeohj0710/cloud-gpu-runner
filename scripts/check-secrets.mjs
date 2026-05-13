import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

const checks = [
  {
    name: "NCP IAM key literal",
    pattern: /\bncp_iam_[A-Za-z0-9]{12,}\b/
  },
  {
    name: "NCP access key assignment",
    pattern: /^[ \t]*NCP_ACCESS_KEY_ID[ \t]*=[ \t]*[^ \t\r\n#]+/m
  },
  {
    name: "NCP secret key assignment",
    pattern: /^[ \t]*NCP_SECRET_KEY[ \t]*=[ \t]*[^ \t\r\n#]+/m
  },
  {
    name: "NCP CLOVA key assignment",
    pattern: /^[ \t]*NCP_CLOVASTUDIO_(?:API_KEY|API_GATEWAY_KEY)[ \t]*=[ \t]*[^ \t\r\n#]+/m
  },
  {
    name: "NCP Object Storage key assignment",
    pattern: /^[ \t]*NCP_OBJECT_STORAGE_(?:ACCESS_KEY_ID|SECRET_KEY)[ \t]*=[ \t]*[^ \t\r\n#]+/m
  },
  {
    name: "Kakao cloud secret assignment",
    pattern: /^[ \t]*KAKAO_CLOUD_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)[ \t]*=[ \t]*[^ \t\r\n#]+/m
  }
];

function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
}

function listFiles() {
  const files = new Set();

  for (const command of [
    ["ls-files"],
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    ["ls-files", "--others", "--exclude-standard"]
  ]) {
    const output = git(command);
    for (const line of output.split(/\r?\n/)) {
      if (line) {
        files.add(line);
      }
    }
  }

  return [...files];
}

function isLikelyTextFile(filePath) {
  const sample = readFileSync(filePath, { encoding: null, flag: "r" }).subarray(0, 8000);
  return !sample.includes(0);
}

const findings = [];

for (const file of listFiles()) {
  const filePath = resolve(root, file);

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    continue;
  }

  if (!isLikelyTextFile(filePath)) {
    continue;
  }

  const content = readFileSync(filePath, "utf8");

  for (const check of checks) {
    if (check.pattern.test(content)) {
      findings.push({ file, check: check.name });
    }
  }
}

if (findings.length > 0) {
  console.error("Potential secret values found. Remove them before committing or deploying.");

  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.check}`);
  }

  process.exit(1);
}

console.log("Secret scan: OK");
