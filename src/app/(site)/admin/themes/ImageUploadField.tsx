"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { uploadThemeImage } from "./uploadActions";

/**
 * 이미지 업로드 + 미리보기.
 *
 * 값은 여전히 URL 문자열이다. 업로드는 그 문자열을 채우는 한 가지 방법일 뿐이고,
 * 외부 URL 을 직접 붙여넣는 것도 계속 된다.
 */
export function ImageUploadField({
  value,
  onChange,
  label = "포스터",
  hint,
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadThemeImage(fd);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onChange(result.url);
  }

  return (
    <div>
      <label className="mb-1 block text-xs text-muted">{label}</label>

      <div className="flex items-start gap-3">
        <div className="relative h-32 w-[6.4rem] shrink-0 overflow-hidden rounded border border-border bg-background">
          {value ? (
            <Image src={value} alt="미리보기" fill className="object-cover" sizes="103px" />
          ) : (
            <span className="flex h-full items-center justify-center text-[11px] text-muted">
              없음
            </span>
          )}
        </div>

        <div className="flex-1 space-y-2">
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
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {busy ? "올리는 중…" : value ? "이미지 변경" : "이미지 올리기"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="ml-2 rounded border border-border px-3 py-1.5 text-sm text-muted"
            >
              제거
            </button>
          )}

          <input
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="또는 이미지 주소를 직접 붙여넣기"
          />
          {hint && <p className="text-[11px] text-muted">{hint}</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
