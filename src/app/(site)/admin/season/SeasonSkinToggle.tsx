"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SITE_SKINS, SITE_SKIN_LABELS, type SiteSkin } from "@/lib/season";
import { setSiteSkin } from "./actions";

const kstDateTime = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

/**
 * 시즌 스킨 켜기/끄기. 스킨은 한 번에 하나만 켜진다.
 * 켜는 것도 끄는 것도 고객 화면 전체가 바뀌는 일이라 확인창을 한 번 거친다.
 */
export function SeasonSkinToggle({
  current,
  updatedAt,
}: {
  current: SiteSkin | null;
  updatedAt: string | null;
}) {
  const router = useRouter();
  // 확인창에 올린 다음 상태. undefined 면 확인창이 닫혀 있다.
  const [next, setNext] = useState<SiteSkin | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (next === undefined) return;
    setError(null);
    startTransition(async () => {
      const res = await setSiteSkin(next);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setNext(undefined);
      setNotice(res.message ?? null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {SITE_SKINS.map((skin) => {
          const on = current === skin;
          return (
            <div
              key={skin}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-fill-subtle px-4 py-3.5"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-body font-semibold">
                  {SITE_SKIN_LABELS[skin]}
                  <span
                    className={`rounded-md border px-2 py-0.5 text-micro ${
                      on ? "border-confirm/50 text-confirm" : "border-line text-muted"
                    }`}
                  >
                    {on ? "적용 중" : "꺼짐"}
                  </span>
                </p>
                {on && updatedAt && (
                  <p className="mt-1 text-label text-muted">{kstDateTime(updatedAt)}에 켰습니다.</p>
                )}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setNext(on ? null : skin);
                }}
                className={`rounded-md border px-3 py-1.5 text-label font-semibold transition-colors disabled:opacity-50 ${
                  on
                    ? "border-line text-foreground hover:bg-fill"
                    : "border-glow/50 text-glow hover:bg-glow/10"
                }`}
              >
                {on ? "끄기" : "켜기"}
              </button>
            </div>
          );
        })}
      </div>

      {notice && <p className="mt-3 text-body-sm text-confirm">{notice}</p>}

      <ConfirmDialog
        open={next !== undefined}
        title={next ? `${SITE_SKIN_LABELS[next]} 스킨을 켤까요?` : "시즌 스킨을 끌까요?"}
        message={
          next
            ? `고객 화면 전체(홈 · 테마 · 공지 등)에 ${SITE_SKIN_LABELS[next]} 장식과 색이 씌워집니다. 30초 안에 적용되고, 신청·결제 기능은 그대로입니다.`
            : "고객 화면이 원래 디자인으로 돌아갑니다. 30초 안에 적용됩니다."
        }
        cancelLabel="아니요"
        confirmLabel={next ? "네, 켜기" : "네, 끄기"}
        onCancel={() => setNext(undefined)}
        onConfirm={confirm}
        error={error}
        confirmDisabled={pending}
      />
    </>
  );
}
