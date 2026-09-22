#!/usr/bin/env node
/**
 * 슬랙 알림 채널에서 **고른 메시지만** 지운다.
 *
 * 쓰는 경우
 *   - 운영에서 테스트 신청을 넣어본 뒤 그 알림을 치울 때 → `--code <접수번호>`
 *   - 같은 건이 반복 발송돼 쌓인 미입금 알림을 치울 때   → 옵션 없이 (기본값)
 *
 * ⚠️ 왜 봇 토큰으로는 안 되는가 — 이걸 모르면 다음 사람이 똑같이 헤맨다.
 *   이 알림들은 Incoming Webhook 으로 보냈다. chat.delete 는 봇 토큰으로는
 *   "그 봇이 직접 보낸" 메시지만 지울 수 있는데, 웹훅 메시지는 소유자가 봇이
 *   아니라 웹훅이라 **봇 토큰으로 못 지운다.** 워크스페이스 Owner/Admin 계정의
 *   user token(xoxp-) 만 지울 수 있다.
 *   https://docs.slack.dev/reference/methods/chat.delete
 *
 * ⚠️ 삭제는 되돌릴 수 없다. 그래서 기본값이 dry-run 이고, 셀렉터 없이는
 *    '미입금 알림' 만 잡는다. **절대 "전부 지우기" 기본값을 만들지 말 것.**
 *
 * 토큰 (파일에 저장하지 않는다 — 계정 권한으로 읽고 쓰는 토큰이다):
 *   echo -n "토큰: "; read -rs SLACK_USER_TOKEN; echo; export SLACK_USER_TOKEN
 *
 * 순서는 항상 셋이다:
 *   node scripts/slack-cleanup-alerts.mjs --code 123456            # 1. dry-run
 *   node scripts/slack-cleanup-alerts.mjs --code 123456 --apply --limit 1
 *   node scripts/slack-cleanup-alerts.mjs --code 123456 --apply    # 3. 전체
 *
 * 옵션
 *   --code <번호[,번호...]>  그 접수번호가 든 메시지만. 새신청·미입금 알림 양쪽에
 *                            접수번호가 들어가므로, 테스트 1건의 알림을 전부·그것만
 *                            고를 수 있다. 남의 신청은 구조적으로 안 걸린다.
 *   --after  <ISO시각>       그 시각 이후 메시지만 (예: 2026-09-22T14:00)
 *   --before <ISO시각>       그 시각 이전 메시지만
 *   --channel <채널ID>       대상 채널 (기본: #apply-notification)
 *   --limit <N>              N 건만. 가장 **오래된** 것부터 — 시험 삭제용
 *   --apply                  실제 삭제 (없으면 dry-run)
 */

const TOKEN = process.env.SLACK_USER_TOKEN;

/** #apply-notification. 신청·미입금 알림이 오는 채널. */
const DEFAULT_CHANNEL = "C0BP5FLDH41";

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};

const APPLY = argv.includes("--apply");
const CHANNEL = flag("--channel") || process.env.SLACK_SOURCE_CHANNEL || DEFAULT_CHANNEL;

const CODES = (flag("--code") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** ISO 문자열 → epoch 초. Slack 의 ts 와 비교하려고 초 단위로 맞춘다. */
function toEpoch(v, label) {
  if (v === undefined) return undefined;
  const t = Date.parse(v);
  if (Number.isNaN(t)) {
    console.error(`${label} 값을 시각으로 읽을 수 없습니다: ${v}`);
    process.exit(1);
  }
  return t / 1000;
}
const AFTER = toEpoch(flag("--after"), "--after");
const BEFORE = toEpoch(flag("--before"), "--before");

const limitRaw = flag("--limit");
const LIMIT = limitRaw === undefined ? Infinity : Number(limitRaw);
if (Number.isNaN(LIMIT) || LIMIT <= 0) {
  console.error("--limit 뒤에는 1 이상의 숫자가 와야 합니다.");
  process.exit(1);
}

if (!TOKEN) {
  console.error(
    "SLACK_USER_TOKEN 이 필요합니다 (xoxp-). 워크스페이스 Owner/Admin 계정의 user token.\n" +
      "  api.slack.com/apps → WYE Cleanup → OAuth & Permissions → User OAuth Token"
  );
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function slack(method, params) {
  const url = `https://slack.com/api/${method}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const json = await res.json();
  if (!json.ok && json.error === "ratelimited") {
    const wait = Number(res.headers.get("retry-after") || 30);
    console.warn(`  레이트리밋 — ${wait}초 대기`);
    await sleep(wait * 1000);
    return slack(method, params);
  }
  return json;
}

/**
 * 미입금 알림인가. 셀렉터를 안 줬을 때의 기본 대상이다.
 *
 * 새신청 알림 본문에도 `입금기한:` 줄이 있어서 두 겹으로 막는다 —
 * '미입금' 이 있어야 하고 '새신청' 이 없어야 한다.
 */
function isUnpaidAlert(m) {
  const text = m.text || "";
  return text.includes("입금기한") && text.includes("미입금") && !text.includes("새신청");
}

/** 본문에 이 접수번호가 들어 있나. 백틱이 붙든 안 붙든 잡는다. */
function hasCode(m, codes) {
  const text = m.text || "";
  return codes.some((c) => text.includes(c));
}

async function main() {
  const mode = CODES.length ? `접수번호 ${CODES.join(", ")}` : "미입금 알림(기본)";
  console.log(`채널 ${CHANNEL} 에서 [${mode}] 를 찾는 중…`);

  const all = [];
  let cursor;
  do {
    const r = await slack("conversations.history", {
      channel: CHANNEL,
      limit: 200,
      ...(cursor ? { cursor } : {}),
    });
    if (!r.ok) {
      console.error("conversations.history 실패:", r.error);
      process.exit(1);
    }
    all.push(...r.messages);
    cursor = r.response_metadata?.next_cursor;
    await sleep(1200);
  } while (cursor);

  let matched = all.filter((m) => (CODES.length ? hasCode(m, CODES) : isUnpaidAlert(m)));

  if (AFTER !== undefined) matched = matched.filter((m) => Number(m.ts) >= AFTER);
  if (BEFORE !== undefined) matched = matched.filter((m) => Number(m.ts) <= BEFORE);

  console.log(`전체 ${all.length}건 중 대상 ${matched.length}건`);
  if (matched.length === 0) return;

  // conversations.history 는 최신순이다. --limit 는 **가장 오래된** 것부터 집는다
  // — 시험 삭제로 최근 기록을 날리지 않기 위해서다.
  const targets = LIMIT === Infinity ? matched : matched.slice(-LIMIT);
  if (LIMIT !== Infinity) {
    console.log(`--limit ${LIMIT} → 가장 오래된 ${targets.length}건만 처리합니다.`);
  }

  if (!APPLY) {
    console.log("\n--- dry-run (실제로는 아무것도 지우지 않음) ---");
    console.log(`지울 메시지: ${targets.length}건\n`);
    for (const m of targets.slice(0, 20)) {
      const when = new Date(Number(m.ts) * 1000).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
      console.log(`  [${when}] ${(m.text || "").split("\n")[0]}`);
    }
    if (targets.length > 20) console.log(`  … 외 ${targets.length - 20}건`);
    console.log("\n위 목록에 지우면 안 될 메시지가 없는지 눈으로 확인하세요.");
    console.log("확인했으면 `--apply --limit 1` 로 1건만 먼저 시험한 뒤 `--apply` 로 전체 실행.");
    return;
  }

  console.log(`\n${targets.length}건 삭제 중…`);
  let deleted = 0;
  let failed = 0;
  for (const m of targets) {
    const r = await slack("chat.delete", { channel: CHANNEL, ts: m.ts });
    if (r.ok) deleted += 1;
    else {
      failed += 1;
      console.warn(`  삭제 실패 ts=${m.ts}: ${r.error}`);
    }
    await sleep(1200);
  }
  console.log(`\n완료 — 삭제 ${deleted}건, 실패 ${failed}건`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
