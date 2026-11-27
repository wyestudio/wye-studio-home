#!/usr/bin/env node
/**
 * 명찰 제작기(대표님이 만든 단일 HTML)에 **명단 받는 부분만** 넣는다. 디자인 · 템플릿 · 폰트는 건드리지 않는다.
 *
 *   node scripts/admin-tools/patch-nametag-maker.mjs <원본.html> <결과.html>
 *
 * 원본은 45MB 라 저장소에 넣지 않는다(공개 저장소다). 결과 파일도 커밋하지 않는다 —
 * upload-admin-tool.mjs 로 Supabase 비공개 버킷(admin-tools)에 올린다.
 *
 * 제작기를 새 판으로 바꿀 때: 새 원본에 이 스크립트를 다시 돌리고 다시 올리면 된다.
 * 넣을 자리(스크립트 맨 끝의 `window.__badgeMaker = { … }; }());`)를 못 찾으면 고치지 않고 멈춘다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error("사용법: node scripts/admin-tools/patch-nametag-maker.mjs <원본.html> <결과.html>");
  process.exit(1);
}
const html = readFileSync(src, "utf8");
if (html.includes("wye-bridge:start")) {
  console.error("이미 명단 받는 부분이 들어 있는 파일입니다. 원본 파일을 넣어주세요.");
  process.exit(1);
}
// 제작기가 쓰는 이름들이 그대로 있는지 본다 — 없으면 구조가 바뀐 것이라 넣지 않는다.
for (const need of ["function addRow(", "function applyRoster(", "function renderAll(", "function fitAll(", "EXPERIENCE_RULES", 'name="experience"', 'name="edition"', "el.peopleList"]) {
  if (!html.includes(need)) {
    console.error(`제작기 구조가 달라졌습니다 — '${need}' 를 찾지 못했습니다. nametag-bridge.js 를 새 구조에 맞춰야 합니다.`);
    process.exit(1);
  }
}
const anchor = /(window\.__badgeMaker = \{[\s\S]*?\};\r?\n)(\s*\}\(\)\);\s*<\/script>)/g;
const hits = html.match(anchor);
if (!hits || hits.length !== 1) {
  console.error(`넣을 자리를 ${hits ? hits.length : 0}곳 찾았습니다(1곳이어야 합니다). 파일을 고치지 않았습니다.`);
  process.exit(1);
}
const bridge = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "nametag-bridge.js"), "utf8");
const patched = html.replace(anchor, (_, head, tail) => `${head}${bridge}${tail}`);
writeFileSync(out, patched);
console.log(`넣었습니다: ${out} (${(Buffer.byteLength(patched) / 1048576).toFixed(1)}MB, 원본보다 ${Buffer.byteLength(patched) - Buffer.byteLength(html)}바이트 늘었습니다)`);
