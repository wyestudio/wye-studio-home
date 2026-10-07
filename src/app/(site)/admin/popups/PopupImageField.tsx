"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { uploadThemeImage } from "../themes/uploadActions";

/**
 * 팝업 이미지 업로드 + 미리보기.
 *
 * 테마 포스터용 ImageUploadField 와 거의 같지만 **비율이 다르다** — 포스터는
 * 4:5 로 고정이고, 팝업 이미지는 운영자가 만든 그대로(가로세로 자유)를
 * 보여줘야 한다. 4:5 틀에 끼우면 어드민 미리보기와 실제 화면이 달라진다.
 *
 * 업로드 자체는 테마와 같은 액션을 쓰고 폴더만 popups/ 로 나눈다 —
 * 버킷 안에서 포스터와 섞이면 나중에 지울 것을 고를 수 없다.
 */
export function PopupImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
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
      fd.append("folder", "popups");
      const result = await uploadThemeImage(fd);
      if (!result.ok) return setError(result.error);
      onChange(result.url);
    } catch (err) {
      // 서버 액션 자체가 터지면(본문 크기 초과 등) 위의 에러 반환까지 못 온다.
      setError(
        err instanceof Error && /body|size|413/i.test(err.message)
          ? "파일이 너무 큽니다. 5MB 이하로 줄여주세요."
          : "업로드에 실패했어요. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-micro font-semibold text-muted">팝업 이미지</label>

      <div className="relative flex min-h-[10rem] w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-background p-2">
        {value ? (
          /* 비율을 모르는 이미지라 width/height 를 고정하지 않는다. */
          <Image
            src={value}
            alt="미리보기"
            width={420}
            height={520}
            className="h-auto max-h-[22rem] w-auto max-w-full object-contain"
          />
        ) : (
          <span className="text-micro text-muted">등록된 이미지 없음</span>
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
          className="flex-1 rounded-md border border-border px-3 py-1.5 text-micro disabled:opacity-50"
        >
          {busy ? "올리는 중…" : value ? "변경" : "이미지 올리기"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-md border border-red-500/40 px-3 py-1.5 text-micro text-red-400"
          >
            삭제
          </button>
        )}
      </div>

      <input
        className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-micro"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="또는 이미지 주소를 직접 붙여넣기"
      />
      <p className="mt-1 text-micro text-muted">
        JPG · PNG · WEBP · GIF, 5MB 이하. 세로로 긴 이미지(예: 가로 800 세로 1000)가 모바일에서
        잘 보입니다.
      </p>
      {error && <p className="mt-1 text-micro text-red-400">{error}</p>}
    </div>
  );
}
