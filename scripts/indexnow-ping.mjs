#!/usr/bin/env node
/**
 * 바뀐 공개 페이지 주소를 IndexNow(Bing · 네이버 등)에 알린다.
 *
 * 쓰는 경우
 *   어드민 저장은 자동으로 알린다(src/lib/indexNow.ts). 이 스크립트는 그 밖의 길 —
 *   코드 배포로 문구가 바뀌었거나, 스크립트 · SQL 로 운영 DB 를 직접 고쳤을 때 쓴다.
 *   운영에 반영된 **뒤에** 실행한다. 먼저 보내면 엔진이 옛 내용을 다시 읽어 간다.
 *
 * 사용
 *   node scripts/indexnow-ping.mjs /group
 *   node scripts/indexnow-ping.mjs / /themes/baotalchul "/themes/baotalchul?mode=normal"
 *
 * ⚠️ 바뀐 주소만 넣는다. 안 바뀐 주소를 자꾸 보내면 엔진이 우리 알림을 덜 믿는다.
 * 열쇠는 src/lib/indexNow.ts 의 KEY 하나를 읽어 쓴다(비밀이 아니다 — public/<열쇠>.txt 로 공개돼 있다).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KEY = fs.readFileSync(path.join(root, "src/lib/indexNow.ts"), "utf8").match(/const KEY = "([0-9a-f]+)"/)?.[1];
const HOST = "www.wouldyouescape.com";

const paths = process.argv.slice(2);
if (!KEY) throw new Error("src/lib/indexNow.ts 에서 KEY 를 못 읽었습니다");
if (paths.length === 0 || paths.some((p) => !p.startsWith("/"))) {
  console.error('사용: node scripts/indexnow-ping.mjs /group "/themes/baotalchul?mode=normal"   (/ 로 시작하는 주소)');
  process.exit(1);
}

// 열쇠 파일이 운영에 떠 있어야 엔진이 받아 준다
const keyRes = await fetch(`https://${HOST}/${KEY}.txt`);
if (!keyRes.ok || (await keyRes.text()).trim() !== KEY) {
  console.error(`열쇠 파일이 운영에 없습니다: https://${HOST}/${KEY}.txt — 그 파일이 든 배포가 끝난 뒤 다시 실행하세요`);
  process.exit(1);
}

const urlList = [...new Set(paths)].map((p) => `https://${HOST}${p}`);
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
});
// 200 · 202 가 정상(202 = 받았고 열쇠 확인은 나중에)
console.log(res.status, res.ok ? "보냄" : await res.text(), "\n" + urlList.join("\n"));
process.exit(res.ok ? 0 : 1);
