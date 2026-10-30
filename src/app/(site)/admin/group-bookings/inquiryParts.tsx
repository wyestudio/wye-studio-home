import { HHMM, BASE_MINUTES, OPTION, kstToday, won } from "@/lib/groupPricing";
import { groupKindLabel, repeatPlayerLabel, teamStyleLabel } from "@/lib/groupBooking";

/**
 * 단체 예약 문의 목록 · 상세가 같이 쓰는 조각.
 * ⚠️ 연락처가 복호화돼 보인다 — 어드민 화면에서만 쓴다.
 */
export type Inquiry = {
  id: string;
  created_at: string;
  headcount: number;
  contact_method: string;
  contact: string;
  preferred_date: string | null;
  preferred_time: string;
  group_kind: string | null;
  note: string | null;
  // v2(/group 단계형 견적, 2026-10-25) 부터 받는 칸. 그 전 접수분은 전부 null 이다.
  organizer_name: string | null;
  group_name: string | null;
  group_kind_note: string | null;
  options: {
    icebreaking?: boolean;
    character?: boolean;
    after_party_hours?: number;
    cleanup?: boolean;
  } | null;
  unit_price: number | null;
  estimate_total: number | null;
  team_style: string | null;
  repeat_player: string | null;
  occasion: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  landing_path: string | null;
  status: string;
  admin_memo: string | null;
};

/**
 * 예약 확정 칸의 처음 값 — 희망 일시와 견적 시간(프로그램 + 애프터파티).
 * 희망 시간이 v1 코드값(t1530 · flexible 등)이면 시각은 비워 둔다.
 */
export function suggestedBooking(r: Inquiry): { date: string; time: string; minutes: number } {
  const o = r.options ?? {};
  return {
    date: r.preferred_date ?? kstToday(),
    time: HHMM.test(r.preferred_time) ? r.preferred_time : "",
    minutes: BASE_MINUTES - (o.icebreaking === false ? OPTION.icebreaking.minutes : 0) + (o.after_party_hours ?? 0) * 60,
  };
}

/** 유입 경로. 빈 칸이 곧 '직접 방문' 이다 — 그 말을 직접 적어 둔다. */
export function SourceCell({ r }: { r: Inquiry }) {
  if (!r.utm_source && !r.referrer) return <>직접 방문</>;
  return (
    <>
      {r.utm_source && (
        <div>
          {r.utm_source}
          {r.utm_medium ? ` / ${r.utm_medium}` : ""}
        </div>
      )}
      {r.utm_campaign && <div>{r.utm_campaign}</div>}
      {r.referrer && <div className="break-all">{r.referrer}</div>}
      {r.landing_path && <div className="break-all">{r.landing_path}</div>}
    </>
  );
}

/** 휴대폰에서 바로 걸 수 있게 — 전화 · 문자로 받은 번호만 링크로 만든다(카카오톡 ID 는 글자 그대로). */
export function ContactLink({ r }: { r: Inquiry }) {
  const digits = r.contact.replace(/[^\d]/g, "");
  if ((r.contact_method === "phone" || r.contact_method === "sms") && digits.length >= 9) {
    return (
      <a href={`${r.contact_method === "sms" ? "sms" : "tel"}:${digits}`} className="font-semibold text-glow underline">
        {r.contact}
      </a>
    );
  }
  return <span className="break-all">{r.contact}</span>;
}

/** 견적 단계에서 고른 것. 금액은 접수 시점에 서버가 계산한 값이다(요금표가 바뀌어도 그대로). */
export function OptionsCell({ r }: { r: Inquiry }) {
  if (!r.options) return <span className="text-muted">-</span>;
  const o = r.options;
  const picks = [
    o.icebreaking === false ? "레크리에이션 뺌" : null,
    o.character ? "캐릭터 꾸미기" : null,
    o.after_party_hours ? `애프터파티 ${o.after_party_hours}시간` : null,
    o.cleanup ? "뒷정리" : null,
  ].filter(Boolean);
  return (
    <>
      <div>{picks.length ? picks.join(" · ") : "기본 구성"}</div>
      <div className="mt-1 text-body-sm font-semibold">
        {r.estimate_total != null ? won(r.estimate_total) : "상담 후 안내"}
      </div>
      {r.unit_price != null && <div className="text-muted">1인 {won(r.unit_price)}</div>}
    </>
  );
}

export function ExtrasCell({ r }: { r: Inquiry }) {
  const rows: [string, string | null][] = [
    ["모임", r.group_kind ? `${groupKindLabel(r.group_kind)}${r.group_kind_note ? ` (${r.group_kind_note})` : ""}` : null],
    ["팀", r.team_style ? teamStyleLabel(r.team_style) : null],
    ["재참여", r.repeat_player ? repeatPlayerLabel(r.repeat_player) : null],
    ["기념일", r.occasion],
  ];
  const shown = rows.filter(([, v]) => v);
  if (!shown.length && !r.note) return <span className="text-muted">-</span>;
  return (
    <>
      {shown.map(([k, v]) => (
        <div key={k}>
          <span className="text-muted">{k}</span> {v}
        </div>
      ))}
      {r.note && <div className="mt-1 whitespace-pre-line text-body-sm">{r.note}</div>}
    </>
  );
}
