#!/usr/bin/env node
/**
 * "use server" 파일이 async 함수 외의 값을 export 하는지 검사한다.
 *
 * 왜 필요한가 (2026-09-10 실제 사고):
 *   themes/actions.ts 맨 아래에 `export const EMPTY_CONTENT = ...` 를 남겼더니
 *   테마 저장이 500 으로 터졌다.
 *     Error: A "use server" file can only export async functions, found object.
 *   그런데 `next build` 와 `tsc` 는 이걸 잡지 못하고 **런타임에만** 터진다.
 *   즉 배포해서 실제로 눌러보기 전에는 알 수 없다.
 *
 * 사용: node scripts/check-use-server-exports.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "src";
const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.tsx?$/.test(entry)) files.push(full);
  }
}
walk(ROOT);

const problems = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  // 파일 최상단 지시어만 인정한다 (문자열 안의 "use server" 는 무시).
  const firstMeaningful = src
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("//") && !l.startsWith("/*") && !l.startsWith("*"));
  if (firstMeaningful !== '"use server";' && firstMeaningful !== "'use server';") continue;

  src.split("\n").forEach((line, i) => {
    const t = line.trim();
    // 타입 export 는 컴파일 시 사라지므로 허용된다.
    if (/^export\s+(type|interface)\b/.test(t)) return;
    // async 함수만 허용.
    if (/^export\s+async\s+function\b/.test(t)) return;
    // 그 외 값 export 는 전부 문제.
    if (/^export\s+(const|let|var|class|function)\b/.test(t) || /^export\s+default\b/.test(t)) {
      problems.push({ file: relative(".", file), line: i + 1, code: t });
    }
  });
}

if (problems.length === 0) {
  console.log(`✅ "use server" 파일 export 검사 통과`);
  process.exit(0);
}

console.error(`\n🚨 "use server" 파일은 async 함수(와 타입)만 export 할 수 있습니다.\n`);
console.error(`   이 오류는 build/tsc 에서 잡히지 않고 런타임 500 으로만 나타납니다.\n`);
for (const p of problems) {
  console.error(`   ${p.file}:${p.line}`);
  console.error(`      ${p.code}`);
}
console.error(`\n   → 값이 필요하면 별도 파일(예: src/types/…)로 옮기고 거기서 import 하세요.\n`);
process.exit(1);
