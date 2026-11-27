#!/usr/bin/env node
/**
 * 플레이 리포트 틀(대표님이 만든 단일 HTML · 그 자체가 편집기)을 관리자에 넣을 수 있게 다듬는다. 디자인은 건드리지 않는다.
 *
 *   node scripts/admin-tools/patch-play-report.mjs <원본.html> <결과.html>
 *
 * 하는 일
 *   1. 파일에 **저장돼 있던 내용을 비운다** — 원본에는 실제 단체의 사진(얼굴) · 팀명 · 문구가 들어 있을 수 있다.
 *      비우면 틀은 60KB 남짓이 된다.
 *   2. 영상 고르는 창에 남아 있던 예전 파일 이름을 지운다.
 *   3. 관리자 화면에서 값을 받고 돌려주는 부분(report-bridge.js)을 스크립트 끝에 넣는다.
 *
 * 결과 파일은 커밋하지 않는다 — upload-admin-tool.mjs 로 Supabase 비공개 버킷(admin-tools)에 play-report.html 로 올린다.
 * 넣을 자리를 못 찾거나 결과에 사진이 남아 있으면 고치지 않고 멈춘다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error("사용법: node scripts/admin-tools/patch-play-report.mjs <원본.html> <결과.html>");
  process.exit(1);
}
let html = readFileSync(src, "utf8");
if (html.includes("wye-bridge:start")) {
  console.error("이미 다듬은 파일입니다. 원본 파일을 넣어주세요.");
  process.exit(1);
}
for (const need of ["let state=load();", "function render(){", "const DEFAULT = {", "MAX_TEAMS", "MAX_GAMES", "const clone=", 'id="saved-state"']) {
  if (!html.includes(need)) {
    console.error(`리포트 틀 구조가 달라졌습니다 — '${need}' 를 찾지 못했습니다. report-bridge.js 를 새 구조에 맞춰야 합니다.`);
    process.exit(1);
  }
}

// 1. 저장돼 있던 내용 비우기
const saved = /(<script id="saved-state" type="application\/json">)[\s\S]*?(<\/script>)/g;
if ((html.match(saved) ?? []).length !== 1) {
  console.error("저장된 내용 자리(saved-state)를 1곳 찾지 못했습니다. 파일을 고치지 않았습니다.");
  process.exit(1);
}
html = html.replace(saved, "$1null$2");

// 2. 영상 고르는 창의 예전 파일 이름
html = html.replace(/(<span id="videoFileName" class="video-file">)[^<]*(<\/span>)/, "$1$2");

// 3. 값 주고받는 부분 — 마지막 스크립트의 끝에
const end = html.lastIndexOf("</script>");
const bridge = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "report-bridge.js"), "utf8");
html = `${html.slice(0, end)}${bridge}${html.slice(end)}`;

if (/data:(image|video)\/(jpe?g|png|webp|gif|mp4)/i.test(html)) {
  console.error("결과에 사진 · 영상 데이터가 남아 있습니다. 파일을 쓰지 않았습니다.");
  process.exit(1);
}
writeFileSync(out, html);
console.log(`다듬었습니다: ${out} (${(Buffer.byteLength(html) / 1024).toFixed(0)}KB)`);
