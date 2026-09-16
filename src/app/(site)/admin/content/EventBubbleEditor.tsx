"use client";

import { useState, useTransition } from "react";
import { saveEventBubble } from "./actions";

/**
 * 우하단 인스타 버튼 위 말풍선 설정.
 *
 * 공지·FAQ 와 같은 성격(배포 없이 바로 바뀌는 문구)이라 같은 화면에 뒀다.
 * 켜는 순간 사이트 전체의 우하단에 뜨므로, 미리보기를 같은 모양으로 보여준다.
 */
export function EventBubbleEditor({
  initial,
}: {
  initial: { enabled: boolean; text: string };
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [text, setText] = useState(initial.text);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await saveEventBubble({ enabled, text });
      setMessage(
        "error" in res && res.error
          ? { kind: "err", text: res.error }
          : { kind: "ok", text: "저장되었습니다. 사이트에 바로 반영됩니다." }
      );
    });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        모든 화면 우하단, 인스타 버튼 위에 뜨는 말풍선입니다. 누르면 인스타 계정으로 갑니다.
        방문자가 X 로 닫으면 <strong>그 방문 동안</strong>은 다시 안 뜨고, 사이트에 다시 들어오면 또 보입니다.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        말풍선 보이기
      </label>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          문구 (줄바꿈하면 두 줄로 보입니다 · 60자 이내)
        </label>
        <textarea
          className="min-h-20 w-full rounded border border-border bg-background px-3 py-2 text-sm leading-relaxed"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"오픈기념 할인쿠폰 이벤트\n팔로우하고 5,000원 쿠폰 받기"}
        />
        <p className="mt-1 text-[11px] text-muted">{text.length}/60자</p>
      </div>

      {/* 미리보기 — 실제 화면과 같은 흰 말풍선 모양 */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted">미리보기</p>
        <div className="flex justify-end rounded-lg border border-border bg-black/40 p-4">
          {text.trim() ? (
            <div className="relative flex max-w-[17rem] items-start gap-2 rounded-2xl bg-white py-3 pl-4 pr-2 shadow-xl shadow-black/30">
              <span className="shrink-0 text-lg leading-tight" aria-hidden>
                🎁
              </span>
              <span className="whitespace-pre-line break-keep text-sm font-bold leading-snug text-[#191919]">
                {text}
              </span>
              <span className="text-black/35">✕</span>
              <span className="absolute -bottom-[5px] right-6 h-3 w-3 rotate-45 rounded-[2px] bg-white" />
            </div>
          ) : (
            <p className="text-xs text-muted">문구를 입력하면 여기에 보입니다.</p>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`rounded border px-3 py-2 text-sm ${
            message.kind === "ok" ? "border-glow text-glow" : "border-red-500 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        onClick={submit}
        disabled={pending}
        className="rounded bg-glow px-4 py-2 text-sm text-glow-foreground disabled:opacity-50"
      >
        {pending ? "저장 중…" : "저장"}
      </button>
    </div>
  );
}
