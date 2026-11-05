import { getListedThemes } from "@/lib/themes";
import { createPublicClient } from "@/lib/supabase/public";
import { BASE_MINUTES, OPTION, PRICE_BANDS, PRICED_HEADCOUNT_MAX, durationLabel, unitPriceRange } from "@/lib/groupPricing";
import { SHARE_DESCRIPTION } from "@/lib/shareCard";

/**
 * /llms.txt — ChatGPT · Claude 같은 AI 가 사이트를 한 번에 읽도록 만든 안내문(2026-11-05 대표님).
 * 형식은 https://llmstxt.org 제안을 따른다(마크다운).
 *
 * 손으로 고칠 곳이 없게 만든다 — 테마 · FAQ 는 DB 에서, 단체 요금 · 옵션은 groupPricing.ts 에서
 * 읽는다. 어드민에서 테마 · FAQ 를 고치거나 요금표를 바꾸면 다음 갱신 때 저절로 따라간다.
 * ⚠️ 정적 파일로 내보내고, 누가 읽을 때 1분이 지났으면 그때 한 번 새로 만든다 — 요청마다 서버가
 *    돌지 않는다(wye-server-cost). 1분은 getListedThemes 의 캐시 주기가 정한다(sitemap.xml 과 같음).
 * ⚠️ 잠긴 테마 · 숨긴 FAQ 는 싣지 않는다 — sitemap.ts 와 같은 기준.
 */
export const revalidate = 86400;

const BASE_URL = "https://www.wouldyouescape.com";

function won(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

export async function GET() {
  const supabase = createPublicClient();
  const [themes, faqRes] = await Promise.all([
    getListedThemes().catch(() => []),
    supabase.from("faqs").select("question, answer, is_visible, sort_order").eq("is_visible", true).order("sort_order"),
  ]);
  const faqs = faqRes.error ? [] : (faqRes.data ?? []);

  const lines: string[] = [
    "# 우주이스케이프 (Would You Escape, WYE)",
    "",
    `> ${SHARE_DESCRIPTION}`,
    "",
    "여러 팀이 한 공간에서 동시에 겨루는 팀 대항 방탈출을 회차 단위로 운영한다. 회원가입 없이 신청하고, 전화번호와 접수번호로 신청 내역을 조회한다.",
    "",
    "## 테마",
  ];

  for (const t of themes.filter((x) => !x.is_locked)) {
    const name = t.variant_label ? `${t.name} (${t.variant_label})` : t.name;
    const prices = t.tiers.map((x) => x.unit_price_krw).filter((n) => n > 0);
    const facts = [
      t.genres.length ? t.genres.map((g) => `#${g}`).join(" ") : "",
      Number(t.difficulty) ? `난이도 ${Number(t.difficulty)}/5` : "", // DB 는 "4.0" 같은 글자로 준다
      t.duration_minutes ? durationLabel(t.duration_minutes) : "",
      prices.length ? `1인 ${won(Math.min(...prices))}부터` : "",
    ].filter(Boolean);
    const summary = [t.tagline, t.mode_summary].filter(Boolean).join(" ");
    lines.push(`- [${name}](${BASE_URL}/themes/${t.slug}): ${[summary, facts.join(" · ")].filter(Boolean).join(" — ")}`);
  }

  const range = unitPriceRange();
  const first = PRICE_BANDS[0].min;
  lines.push(
    "",
    "## 단체 대관",
    `- [단체 예약](${BASE_URL}/group): ${first}~${PRICED_HEADCOUNT_MAX}명 모임 단독 대관, 기본 ${durationLabel(BASE_MINUTES)}.` +
      (range ? ` 1인 ${won(range.min)}~${won(range.max)}(인원 · 요일별, 부가세 포함).` : "") +
      ` ${PRICED_HEADCOUNT_MAX + 1}명 이상은 상담으로 안내한다.`,
    `- 옵션(단체 1회 기준): 레크리에이션 기본 포함(빼면 -${won(OPTION.icebreaking.discount)}), 캐릭터 꾸미기 +${won(OPTION.character.price)}, 애프터파티 1시간 +${won(OPTION.afterParty.hourly)}(최대 ${OPTION.afterParty.maxHours}시간), 뒷정리 +${won(OPTION.cleanup.price)}`,
    "- 화면에서 인원 · 날짜 · 옵션을 고르면 견적이 바로 나오고, 회사 결재용 견적서 PDF 를 받을 수 있다.",
    "",
    "## 안내",
    `- [공지사항 · 자주 묻는 질문](${BASE_URL}/notice)`,
    `- [신청 내역 조회](${BASE_URL}/lookup): 전화번호 + 접수번호로 조회 · 취소`,
    `- [이용약관 · 환불 규정](${BASE_URL}/terms)`,
    `- [개인정보처리방침](${BASE_URL}/privacy)`,
  );

  if (faqs.length) {
    lines.push("", "## 자주 묻는 질문");
    // 답에 적은 [문구](/group) 링크는 사이트 안 주소다 — 밖에서 읽는 AI 가 따라가게 전체 주소로 바꾼다
    for (const f of faqs) {
      lines.push("", `### ${f.question.trim()}`, "", f.answer.trim().replace(/\]\(\//g, `](${BASE_URL}/`));
    }
  }

  lines.push(
    "",
    "## 문의",
    "- 이메일: wouldyouescape@gmail.com",
    "- 카카오톡 채널: 우주이스케이프",
    "- 사업자등록번호: 820-04-03772",
    "",
  );

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
