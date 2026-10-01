"use client";

import { useState, useTransition } from "react";
import { savePopup, deletePopup, setPopupActive, type PopupInput } from "./actions";
import { POPUP_PAGE_LABELS, type PopupPage } from "@/types/popup";
import { PopupImageField } from "./PopupImageField";

/**
 * 접속 팝업 편집.
 *
 * ⚠️ '게시' 를 켜는 순간 고객 전원에게 바로 뜬다. 그래서 새 팝업의 기본값은
 *    꺼짐이고, 켤 때 한 번 더 확인한다.
 */

export type PopupRow = {
  id: string;
  title: string;
  image_url: string | null;
  image_alt: string | null;
  body: string | null;
  link_url: string | null;
  link_label: string | null;
  pages: PopupPage[];
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  sort: number;
};

const field = "w-full rounded border border-border bg-background px-3 py-2 text-sm";
const label = "block text-xs font-medium text-muted mb-1";
const section = "rounded-lg border border-border p-4 space-y-3";

const ALL_PAGES: PopupPage[] = ["home", "themes", "theme_detail"];

function isoToKstLocal(iso: string | null): string {
  if (!iso) return "";
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16);
}

function emptyInput(): PopupInput {
  return {
    title: "",
    image_url: "",
    image_alt: "",
    body: "",
    link_url: "",
    link_label: "",
    pages: [...ALL_PAGES],
    starts_at: "",
    ends_at: "",
    // ⚠️ 기본은 꺼짐. 만들자마자 전 고객에게 뜨면 되돌릴 수 없다.
    is_active: false,
    sort: 0,
  };
}

function toInput(p: PopupRow): PopupInput {
  return {
    id: p.id,
    title: p.title,
    image_url: p.image_url ?? "",
    image_alt: p.image_alt ?? "",
    body: p.body ?? "",
    link_url: p.link_url ?? "",
    link_label: p.link_label ?? "",
    pages: p.pages,
    starts_at: isoToKstLocal(p.starts_at),
    ends_at: isoToKstLocal(p.ends_at),
    is_active: p.is_active,
    sort: p.sort,
  };
}

export function PopupEditor({ popups }: { popups: PopupRow[] }) {
  const [editing, setEditing] = useState<PopupInput | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function patch(next: Partial<PopupInput>) {
    setEditing((cur) => (cur ? { ...cur, ...next } : cur));
  }

  function submit() {
    if (!editing) return;
    if (
      editing.is_active &&
      !confirm("게시를 켜면 고객 화면에 바로 뜹니다. 저장할까요?")
    )
      return;
    startTransition(async () => {
      const res = await savePopup(editing);
      if ("error" in res && res.error) {
        setMessage({ kind: "err", text: res.error });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setMessage({ kind: "ok", text: "저장되었습니다." });
        setEditing(null);
      }
    });
  }

  function remove(id: string, title: string) {
    if (!confirm(`'${title}' 팝업을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    startTransition(async () => {
      const res = await deletePopup(id);
      setMessage(
        "error" in res && res.error
          ? { kind: "err", text: res.error }
          : { kind: "ok", text: "삭제되었습니다." }
      );
    });
  }

  function toggle(id: string, next: boolean, title: string) {
    if (next && !confirm(`'${title}' 를 고객 화면에 바로 띄울까요?`)) return;
    startTransition(async () => {
      const res = await setPopupActive(id, next);
      setMessage(
        "error" in res && res.error
          ? { kind: "err", text: res.error }
          : { kind: "ok", text: next ? "게시했습니다." : "내렸습니다." }
      );
    });
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded border px-3 py-2 text-sm ${
            message.kind === "ok" ? "border-glow text-glow" : "border-red-500 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => setEditing(emptyInput())}
          className="rounded bg-glow px-3 py-2 text-sm text-white"
        >
          + 팝업 추가
        </button>
      </div>

      {editing && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <h2 className="font-semibold">{editing.id ? "팝업 수정" : "새 팝업"}</h2>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={section}>
              <h3 className="text-sm font-semibold">내용</h3>
              <div>
                <label className={label}>팝업 이름 (어드민 목록용 · 고객에게 안 보임)</label>
                <input
                  className={field}
                  value={editing.title}
                  placeholder="10월 얼리버드 안내"
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </div>

              <PopupImageField
                value={editing.image_url}
                onChange={(url) => patch({ image_url: url })}
              />

              <div>
                <label className={label}>이미지 대체 텍스트 (화면 낭독기·이미지 차단 시)</label>
                <input
                  className={field}
                  value={editing.image_alt}
                  placeholder="10월 얼리버드 이벤트 안내"
                  onChange={(e) => patch({ image_alt: e.target.value })}
                />
              </div>

              <div>
                <label className={label}>
                  안내 문구 (이미지가 없으면 이 문구만 뜹니다. **굵게** 가능)
                </label>
                <textarea
                  className={`${field} h-24`}
                  value={editing.body}
                  onChange={(e) => patch({ body: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className={section}>
                <h3 className="text-sm font-semibold">누르면 이동할 곳</h3>
                <div>
                  <label className={label}>링크 (사이트 내 경로 또는 https:// 주소)</label>
                  <input
                    className={field}
                    value={editing.link_url}
                    placeholder="/themes/baotalchul"
                    onChange={(e) => patch({ link_url: e.target.value })}
                  />
                </div>
                <div>
                  <label className={label}>버튼 문구 (비우면 이미지만 눌러서 이동)</label>
                  <input
                    className={field}
                    value={editing.link_label}
                    placeholder="회차 보러 가기"
                    onChange={(e) => patch({ link_label: e.target.value })}
                  />
                </div>
              </div>

              <div className={section}>
                <h3 className="text-sm font-semibold">게시</h3>

                <div>
                  <label className={label}>띄울 화면</label>
                  <div className="flex flex-wrap gap-3">
                    {ALL_PAGES.map((pg) => (
                      <label key={pg} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={editing.pages.includes(pg)}
                          onChange={(e) =>
                            patch({
                              pages: e.target.checked
                                ? [...editing.pages, pg]
                                : editing.pages.filter((x) => x !== pg),
                            })
                          }
                        />
                        {POPUP_PAGE_LABELS[pg]}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={label}>게시 시작 (KST · 비우면 바로)</label>
                    <input
                      type="datetime-local"
                      className={field}
                      value={editing.starts_at}
                      onChange={(e) => patch({ starts_at: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={label}>게시 종료 (KST · 비우면 계속)</label>
                    <input
                      type="datetime-local"
                      className={field}
                      value={editing.ends_at}
                      onChange={(e) => patch({ ends_at: e.target.value })}
                    />
                  </div>
                </div>

                <div className="w-28">
                  <label className={label}>정렬 (작을수록 먼저)</label>
                  <input
                    type="number"
                    className={field}
                    value={editing.sort}
                    onChange={(e) => patch({ sort: Number(e.target.value) })}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.is_active}
                    onChange={(e) => patch({ is_active: e.target.checked })}
                  />
                  게시 (켜면 고객 화면에 바로 뜹니다)
                </label>

                <p className="text-xs text-muted">
                  한 화면에 여러 팝업이 걸리면 <strong>정렬이 가장 앞선 하나만</strong> 뜹니다 —
                  겹쳐 뜨면 닫을 수 없습니다. 고객이 &lsquo;오늘 하루 보지 않기&rsquo; 를 누르면
                  그 브라우저에서 24시간 동안 안 뜹니다.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={pending}
              className="rounded bg-glow px-4 py-2 text-sm text-white disabled:opacity-50"
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

      <div className="space-y-2">
        {popups.length === 0 && (
          <p className="rounded-lg border border-border p-6 text-center text-sm text-muted">
            등록된 팝업이 없습니다.
          </p>
        )}
        {popups.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {p.title}{" "}
                <span
                  className={`ml-1 rounded px-1.5 py-0.5 text-[11px] ${
                    p.is_active ? "bg-glow text-white" : "bg-muted/20 text-muted"
                  }`}
                >
                  {p.is_active ? "게시 중" : "내림"}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted">
                {p.pages.map((pg) => POPUP_PAGE_LABELS[pg]).join(" · ")} ·{" "}
                {p.image_url ? "이미지" : "문구만"} ·{" "}
                {p.starts_at ? isoToKstLocal(p.starts_at) : "시작 제한 없음"} ~{" "}
                {p.ends_at ? isoToKstLocal(p.ends_at) : "종료 제한 없음"}
              </p>
            </div>
            <button
              onClick={() => toggle(p.id, !p.is_active, p.title)}
              disabled={pending}
              className="rounded border border-border px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {p.is_active ? "내리기" : "게시"}
            </button>
            <button
              onClick={() => setEditing(toInput(p))}
              className="rounded border border-border px-3 py-1.5 text-xs"
            >
              수정
            </button>
            <button
              onClick={() => remove(p.id, p.title)}
              disabled={pending}
              className="rounded border border-red-500/50 px-3 py-1.5 text-xs text-red-400 disabled:opacity-50"
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
