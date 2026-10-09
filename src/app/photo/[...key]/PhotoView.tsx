"use client";

import { useEffect, useState } from "react";

/**
 * 보드판 사진 받아가는 화면.
 *
 * ⚠️ QR 을 스캔하면 **저절로 저장되지 않는다.** 스캔은 주소를 여는 것뿐이고, 사용자가 직접
 *    누르지 않으면 어떤 페이지도 파일을 기기에 넣을 수 없다(브라우저가 막는다).
 *    그래서 누를 자리를 크게 만든다.
 *
 * 저장과 공유를 나눈 이유:
 *   저장하기 — 파일을 내려받는다. 안드로이드는 갤러리/다운로드로 바로 간다.
 *              아이폰은 "파일" 앱으로 가므로, 사진첩에 넣고 싶으면 공유하기를 써야 한다.
 *   공유하기 — 기기의 공유 시트를 연다. 아이폰은 여기에 "이미지 저장"이 있어 사진첩으로 들어가고,
 *              카톡으로 바로 보낼 수도 있다. 지원하지 않는 브라우저에서는 버튼을 숨긴다.
 */
export default function PhotoView({ src }: { src: string }) {
  const [canShare, setCanShare] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "share">(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    // navigator.canShare 는 파일 공유를 지원하는지까지 확인해야 한다 —
    // share 만 있고 파일은 못 보내는 브라우저가 있다.
    try {
      const probe = new File([new Blob()], "x.png", { type: "image/png" });
      setCanShare(Boolean(typeof navigator.share === "function" && navigator.canShare?.({ files: [probe] })));
    } catch {
      setCanShare(false);
    }
  }, []);

  async function fetchFile() {
    const res = await fetch(src);
    if (!res.ok) throw new Error("사진을 불러오지 못했어요.");
    const blob = await res.blob();
    return new File([blob], "바오탈출-보드판.png", { type: blob.type || "image/png" });
  }

  async function save() {
    setBusy("save");
    setNote(null);
    try {
      const file = await fetchFile();
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setNote("저장이 안 되면 사진을 길게 눌러 저장해주세요.");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy("share");
    setNote(null);
    try {
      const file = await fetchFile();
      await navigator.share({ files: [file], title: "바-ㅇ탈출 보드판" });
    } catch (e) {
      // 사용자가 공유 시트를 그냥 닫은 것은 오류가 아니다.
      if ((e as Error)?.name !== "AbortError") setNote("공유가 안 되면 사진을 길게 눌러 저장해주세요.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="shot" src={src} alt="우리 팀 보드판" />

      <div className="actions">
        <button className="btn primary" onClick={save} disabled={busy !== null}>
          {busy === "save" ? "저장하는 중…" : "저장하기"}
        </button>
        {canShare && (
          <button className="btn" onClick={share} disabled={busy !== null}>
            {busy === "share" ? "여는 중…" : "공유하기"}
          </button>
        )}
      </div>

      <p className="hint">{note ?? "사진을 길게 눌러도 저장할 수 있어요."}</p>
    </>
  );
}
