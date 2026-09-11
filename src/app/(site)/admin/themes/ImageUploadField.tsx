"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { uploadThemeImage } from "./uploadActions";

/**
 * 이미지 업로드 + 미리보기.
 *
 * 미리보기를 위에 크게 두고 조작 버튼을 그 아래에 둔다 — 고객 화면에서
 * 어떻게 보일지가 먼저 보여야 고를 수 있다.
 *
 * 값은 여전히 URL 문자열이다. 업로드는 그 문자열을 채우는 한 가지 방법일 뿐이고,
 * 외부 URL 을 직접 붙여넣는 것도 계속 된다.
 */
export function ImageUploadField({
  value,
  onChange,
  label = "포스터",
  hint,
  shape = "poster",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  /** poster = 세로 4:5 / circle = 목록에 뜨는 원형 행성 로고 */
  shape?: "poster" | "circle";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadThemeImage(fd);
      if (!result.ok) return setError(result.error);
      onChange(result.url);
    } catch (err) {
      // 서버 액션 자체가 터지면(본문 크기 초과 등) 위의 에러 반환까지 못 온다.
      // 잡아주지 않으면 화면에 아무 일도 안 일어난 것처럼 보인다.
      setError(
        err instanceof Error && /body|size|413/i.test(err.message)
          ? "파일이 너무 큽니다. 5MB 이하로 줄여주세요."
          : "업로드에 실패했어요. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setBusy(false);
    }
  }

  const circle = shape === "circle";

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted">{label}</label>

      <div
        className={`relative overflow-hidden border border-border bg-background ${
          circle ? "mx-auto aspect-square w-32 rounded-full" : "aspect-[4/5] w-full rounded-lg"
        }`}
      >
        {value ? (
          <Image
            src={value}
            alt="미리보기"
            fill
            className={circle ? "object-contain" : "object-cover"}
            sizes="256px"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-muted">
            등록된 이미지 없음
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = ""; // 같은 파일을 다시 골라도 이벤트가 나게 한다
        }}
      />

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex-1 rounded border border-border px-3 py-1.5 text-xs disabled:opacity-50"
        >
          {busy ? "올리는 중…" : value ? "변경" : "이미지 올리기"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded border border-red-500/40 px-3 py-1.5 text-xs text-red-400"
          >
            삭제
          </button>
        )}
      </div>

      <input
        className="mt-2 w-full rounded border border-border bg-background px-2 py-1.5 text-[11px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="또는 이미지 주소를 직접 붙여넣기"
      />
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
