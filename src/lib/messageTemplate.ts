/**
 * 문자·슬랙 포맷에서 공용으로 쓰는 치환기.
 *
 * 두 가지를 지원한다.
 *
 * 1) 단일 변수 — `{{theme_name}}`
 * 2) 반복 블록 — 참여자처럼 **몇 명일지 모르는 것**을 위한 것.
 *
 *    {{#attendees}}
 *    · {{name}}({{nickname}}) · {{birth_year}}년생 · {{gender}}
 *    {{/attendees}}
 *
 *    블록 안의 변수는 그 줄에 해당하는 사람 값으로 채워지고, 사람마다 한 줄씩
 *    반복된다. 사람 값에 없는 이름은 바깥 변수에서 찾는다.
 *
 * 왜 이런 걸 만들었나 —
 * 슬랙 알림에 동행자 정보를 넣고 싶은데, "{{동행자1이름}} {{동행자2이름}} …"
 * 처럼 자리를 미리 파두면 인원이 바뀔 때마다 포맷을 고쳐야 한다. 운영자가
 * **어떤 항목을 어떤 순서로 보여줄지** 직접 정할 수 있으려면 반복이 필요하다.
 *
 * ⚠️ 모르는 변수는 `{{이름}}` 그대로 남긴다. 조용히 빈칸으로 지우면 오타 난
 *    변수를 알아챌 방법이 없다 — 미리보기에서 눈에 띄어야 고칠 수 있다.
 */

export type TemplateVars = Record<string, string>;
export type TemplateBlocks = Record<string, TemplateVars[]>;

/** `{{#name}} … {{/name}}` 한 덩어리. 여는 줄·닫는 줄의 줄바꿈은 먹는다. */
const BLOCK_RE = /\{\{#(\w+)\}\}\n?([\s\S]*?)\n?\{\{\/\1\}\}/g;
const VAR_RE = /\{\{(\w+)\}\}/g;

function substitute(text: string, ...sources: TemplateVars[]): string {
  return text.replace(VAR_RE, (match, key: string) => {
    for (const src of sources) {
      if (key in src) return src[key];
    }
    return match;
  });
}

export function renderTemplate(
  body: string,
  vars: TemplateVars,
  blocks: TemplateBlocks = {}
): string {
  // 블록을 먼저 펼친다. 그래야 블록 안의 변수가 바깥 치환에 휘말리지 않는다.
  const expanded = body.replace(BLOCK_RE, (_match, name: string, inner: string) => {
    const rows = blocks[name];
    // 데이터가 없으면 블록을 통째로 비운다. 빈 줄만 남으면 알림이 어색해진다.
    if (!rows || rows.length === 0) return "";
    return rows.map((row) => substitute(inner, row, vars)).join("\n");
  });

  return substitute(expanded, vars);
}

/** 본문에 실제로 쓰인 반복 블록 이름들. 미리보기에서 어떤 블록을 채울지 알려면 필요하다. */
export function usedBlocks(body: string): string[] {
  const names = new Set<string>();
  for (const m of body.matchAll(BLOCK_RE)) names.add(m[1]);
  return [...names];
}
