"use client";

import { useState, useTransition } from "react";
import {
  UTM_MEDIUMS,
  utmUrl,
  shortUrl,
  isOverLengthLimit,
  LENGTH_LIMIT,
  type UtmLink,
} from "@/lib/utmLinks";
import { saveUtmLink, setUtmLinkStatus, type UtmLinkInput } from "./actions";

const EMPTY: UtmLinkInput = {
  label: "",
  slug: "",
  landing_path: "/themes/baotalchul",
  utm_source: "",
  utm_medium: "social",
  utm_campaign: "",
  utm_content: "",
  utm_term: "",
  note: "",
  sort: 0,
  status: "active",
};

function toInput(l: UtmLink): UtmLinkInput {
  return {
    id: l.id,
    label: l.label,
    slug: l.slug ?? "",
    landing_path: l.landing_path,
    utm_source: l.utm_source,
    utm_medium: l.utm_medium,
    utm_campaign: l.utm_campaign,
    utm_content: l.utm_content ?? "",
    utm_term: l.utm_term ?? "",
    note: l.note ?? "",
    sort: l.sort,
    status: l.status,
  };
}

const field = "w-full rounded border border-border bg-background px-3 py-2 text-sm";
const label = "block text-xs font-medium text-muted mb-1";

/** 미리보기는 저장 전 값으로 만들어야 해서 UtmLink 모양으로 맞춘다. */
function previewOf(input: UtmLinkInput) {
  return {
    landing_path: input.landing_path || "/",
    utm_source: input.utm_source || "?",
    utm_medium: input.utm_medium,
    utm_campaign: input.utm_campaign || "?",
    utm_content: input.utm_content || null,
    utm_term: input.utm_term || null,
  };
}

export function UtmLinkEditor({ links }: { links: UtmLink[] }) {
  const [editing, setEditing] = useState<UtmLinkInput | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isCodeManaged =
    editing?.id != null && links.find((l) => l.id === editing.id)?.managed_by === "code";

  function submit() {
    if (!editing) return;
    startTransition(async () => {
      const res = await saveUtmLink(editing);
      if ("error" in res) {
        setMessage({ kind: "err", text: res.error });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setMessage({ kind: "ok", text: res.message ?? "저장되었습니다." });
        setEditing(null);
      }
    });
  }

  function toggle(l: UtmLink) {
    const next = l.status === "active" ? "disabled" : "active";
    startTransition(async () => {
      const res = await setUtmLinkStatus(l.id, next);
      setMessage(
        "error" in res && res.error
          ? { kind: "err", text: res.error }
          : { kind: "ok", text: next === "active" ? "사용으로 되돌렸습니다." : "중단했습니다." }
      );
    });
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      setMessage({ kind: "err", text: "복사할 수 없습니다. 주소를 드래그해 직접 복사해주세요." });
    }
  }

  const preview = editing ? previewOf(editing) : null;
  const previewUrl = preview ? utmUrl(preview) : "";
  const tooLong = preview ? isOverLengthLimit(preview) : false;

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded border px-3 py-2 text-sm ${
            message.kind === "ok"
              ? "border-green-700 bg-green-950/40 text-green-300"
              : "border-red-700 bg-red-950/40 text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      {!editing && (
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          새 링크 만들기
        </button>
      )}

      {editing && (
        <div className="rounded-lg border border-border bg-background/50 p-5">
          <h2 className="mb-4 text-lg font-semibold">
            {editing.id ? "링크 수정" : "새 링크"}
          </h2>

          {isCodeManaged && (
            <div className="mb-4 rounded border border-amber-700 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
              이 링크는 <code className="font-mono text-xs">next.config.ts</code> 에 박혀 있어
              <strong> 주소·파라미터를 고쳐도 실제 동작은 바뀌지 않습니다.</strong> 메모와 사용
              여부만 저장됩니다. 동작을 바꾸려면 코드를 고쳐야 합니다.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={label}>어디에 거는 링크인가 *</label>
              <input
                className={field}
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                placeholder="예: 잼핏 상세페이지 예약하기 버튼"
              />
            </div>

            <div>
              <label className={label}>랜딩 경로 *</label>
              <input
                className={field}
                value={editing.landing_path}
                onChange={(e) => setEditing({ ...editing, landing_path: e.target.value })}
                placeholder="/themes/baotalchul"
                disabled={isCodeManaged}
              />
            </div>

            <div>
              <label className={label}>짧은 주소 (선택)</label>
              <input
                className={field}
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                placeholder="naver-cafe (앞의 / 없이)"
                disabled={isCodeManaged}
              />
              <p className="mt-1 text-xs text-muted">
                넣으면 <code className="font-mono">wouldyouescape.com/{editing.slug || "…"}</code>{" "}
                로 접속했을 때 아래 주소로 넘어갑니다. UTM 을 노출하기 싫은 자리에 씁니다.
              </p>
            </div>

            <div>
              <label className={label}>utm_source — 어느 채널인가 *</label>
              <input
                className={field}
                value={editing.utm_source}
                onChange={(e) => setEditing({ ...editing, utm_source: e.target.value })}
                placeholder="instagram, kakao_channel, zamfit …"
                disabled={isCodeManaged}
              />
              <p className="mt-1 text-xs text-muted">소문자·숫자·밑줄만</p>
            </div>

            <div>
              <label className={label}>utm_medium — 어떤 유형인가 *</label>
              <select
                className={field}
                value={editing.utm_medium}
                onChange={(e) => setEditing({ ...editing, utm_medium: e.target.value })}
                disabled={isCodeManaged}
              >
                {UTM_MEDIUMS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.value} — {m.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted">
                이 다섯 개 밖의 값을 쓰면 GA4 가 채널로 분류하지 못합니다
              </p>
            </div>

            <div>
              <label className={label}>utm_campaign — 어떤 캠페인인가 *</label>
              <input
                className={field}
                value={editing.utm_campaign}
                onChange={(e) => setEditing({ ...editing, utm_campaign: e.target.value })}
                placeholder="always_on, profile, feed, coupon_event_0926 …"
                disabled={isCodeManaged}
              />
            </div>

            <div>
              <label className={label}>utm_content — 어느 지점을 눌렀나 (선택)</label>
              <input
                className={field}
                value={editing.utm_content}
                onChange={(e) => setEditing({ ...editing, utm_content: e.target.value })}
                placeholder="bio_link, apply, detail_page …"
                disabled={isCodeManaged}
              />
              <p className="mt-1 text-xs text-muted">
                길이 제한에 걸리면 가장 먼저 생략하는 축입니다
              </p>
            </div>

            <div>
              <label className={label}>메모 (선택)</label>
              <input
                className={field}
                value={editing.note}
                onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                placeholder="예: 2026-09-17 잼핏 요청으로 단일 링크 교체"
              />
            </div>

            <div>
              <label className={label}>정렬 순서</label>
              <input
                type="number"
                className={field}
                value={editing.sort}
                onChange={(e) => setEditing({ ...editing, sort: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* 완성된 주소를 저장 전에 그대로 보여준다. 눈으로 확인하고 저장하게. */}
          <div className="mt-4 rounded border border-border bg-background p-3">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-muted">완성된 주소</span>
              <span
                className={`text-xs ${tooLong ? "font-semibold text-red-400" : "text-muted"}`}
              >
                {previewUrl.length}자
                {tooLong && ` — ${LENGTH_LIMIT}자 제한 초과`}
              </span>
            </div>
            <p className="break-all font-mono text-xs text-foreground">{previewUrl}</p>
            {editing.slug && (
              <p className="mt-2 break-all font-mono text-xs text-muted">
                짧은 주소: {shortUrl(editing.slug)}
              </p>
            )}
            {tooLong && (
              <p className="mt-2 text-xs text-red-400">
                카카오톡 채널 홈과 네이버 플레이스는 100자를 넘으면 등록 자체가 안 됩니다.
                utm_content 를 빼거나 랜딩 경로를 짧은 쪽(/)으로 옮겨주세요.
              </p>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={submit}
              disabled={pending}
              className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {pending ? "저장 중…" : "저장"}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="rounded border border-border px-4 py-2 text-sm"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* ── 목록 ── */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-border bg-background/50 text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2">어디에 거는 링크</th>
              <th className="px-3 py-2">source / medium</th>
              <th className="px-3 py-2">campaign</th>
              <th className="px-3 py-2">content</th>
              <th className="px-3 py-2">주소</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => {
              const url = utmUrl(l);
              const short = shortUrl(l.slug);
              const off = l.status !== "active";
              return (
                <tr
                  key={l.id}
                  className={`border-b border-border/40 align-top ${off ? "opacity-50" : ""}`}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.label}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {l.managed_by === "code" && (
                        <span className="rounded bg-amber-950/50 px-1.5 py-0.5 text-[11px] text-amber-300">
                          코드 고정
                        </span>
                      )}
                      {off && (
                        <span className="rounded bg-muted/20 px-1.5 py-0.5 text-[11px] text-muted">
                          중단
                        </span>
                      )}
                    </div>
                    {l.note && <div className="mt-1 text-xs text-muted">{l.note}</div>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {l.utm_source} / {l.utm_medium}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{l.utm_campaign}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted">
                    {l.utm_content || "-"}
                  </td>
                  <td className="px-3 py-2">
                    {short && (
                      <div className="mb-1 flex items-center gap-2">
                        <code className="font-mono text-xs text-foreground">{short}</code>
                        <button
                          onClick={() => copy(short, `${l.id}-short`)}
                          className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[11px]"
                        >
                          {copied === `${l.id}-short` ? "복사됨" : "복사"}
                        </button>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <code className="break-all font-mono text-[11px] text-muted">{url}</code>
                      <button
                        onClick={() => copy(url, l.id)}
                        className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[11px]"
                      >
                        {copied === l.id ? "복사됨" : "복사"}
                      </button>
                    </div>
                    {isOverLengthLimit(l) && (
                      <div className="mt-1 text-[11px] text-red-400">
                        {url.length}자 — 100자 제한 초과
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => setEditing(toInput(l))}
                        className="rounded border border-border px-2 py-1 text-xs"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => toggle(l)}
                        disabled={pending}
                        className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                      >
                        {off ? "다시 사용" : "중단"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
