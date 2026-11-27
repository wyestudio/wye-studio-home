#!/usr/bin/env node
/**
 * 관리자 전용 도구 파일을 Supabase 비공개 버킷(admin-tools)에 올린다.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     node scripts/admin-tools/upload-admin-tool.mjs <파일.html> <올릴 이름>
 *
 *   예) node scripts/admin-tools/upload-admin-tool.mjs /tmp/nametag-maker.html nametag-maker.html
 *
 * 올릴 이름: nametag-maker.html(명찰 제작기) · play-report.html(플레이 리포트 틀)
 *
 * ⚠️ 서비스 키는 **환경변수로만** 넘긴다. 명령줄 인자나 파일에 적지 않는다(셸 기록에 남는다).
 *    테스트에 올릴 때는 테스트 프로젝트의 값을, 운영에 올릴 때는 운영 프로젝트의 값을 쓴다 — 어느 쪽인지 주소를 찍어 보여준다.
 * ⚠️ 같은 이름이 있으면 덮어쓴다(새 판으로 바꿀 때 쓴다). 관리자 브라우저는 파일이 바뀐 것을 알고 다시 받는다.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ALLOWED = ["nametag-maker.html", "play-report.html"];
const [file, name] = process.argv.slice(2);
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!file || !ALLOWED.includes(name)) {
  console.error(`사용법: node scripts/admin-tools/upload-admin-tool.mjs <파일.html> <${ALLOWED.join(" | ")}>`);
  process.exit(1);
}
if (!url || !key) {
  console.error("SUPABASE_URL(또는 NEXT_PUBLIC_SUPABASE_URL)과 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.");
  process.exit(1);
}
const body = readFileSync(file);
const mb = (body.byteLength / 1048576).toFixed(1);
if (body.byteLength > 52428800) {
  console.error(`파일이 ${mb}MB 입니다. 버킷 한도(50MB)를 넘습니다.`);
  process.exit(1);
}
console.log(`올리는 곳: ${new URL(url).host} / admin-tools/${name} (${mb}MB)`);
const supabase = createClient(url, key, { auth: { persistSession: false } });
const { error } = await supabase.storage.from("admin-tools").upload(name, body, { contentType: "text/html", upsert: true, cacheControl: "3600" });
if (error) {
  console.error("올리지 못했습니다:", error.message);
  process.exit(1);
}
console.log("올렸습니다.");
