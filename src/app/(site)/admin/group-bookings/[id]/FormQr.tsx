"use client";

import { useEffect, useRef, useState } from "react";
import { adminButtonClass } from "@/components/admin/ui";

/**
 * 폼 링크의 QR 코드 — 실제로 스캔되고, 가운데에 우주이스케이프 로고가 들어간다(2026-11-27 대표님 시안).
 *
 * 모양: 점은 둥근 네모, 세 귀퉁이의 큰 네모(위치 찾기 무늬)는 둥근 테두리, 가운데는 비우고 로고를 놓는다.
 * **12월에는 산타 모자를 쓴 로고**, 그 밖의 달에는 모자 없는 로고다(한국 시간 기준).
 *
 * 가운데를 비워도 읽히는 이유: 오류 복원 수준을 가장 높게(H — 30% 까지 가려져도 복원) 만들고,
 * 로고 자리는 전체의 약 8% 만 쓴다.
 *
 * ⚠️ 어드민에서만 쓴다. QR 라이브러리(qrcode)는 이 화면을 열 때만 받아온다(공개 화면 번들에 싣지 않는다).
 * ⚠️ QR 안에 든 주소가 곧 열쇠다 — 이미지를 저장해 아무 데나 올리지 않는다.
 */

/** 로고 그림. 산타 모자는 시즌 스킨이 로고에 씌우는 그림과 같은 파일 · 같은 자리(season.css)다. */
const LOGO_SRC = "/logo-black.png"; // 860 × 600
const HAT_SRC = "/season/christmas/xmas-santa-hat-logo.webp"; // 640 × 356
// 로고 폭 대비 모자의 폭 · 왼쪽 · 위(season.css 의 크리스마스 값: width 58.3% · left 32.1% · top -14.2%)
const HAT = { width: 0.583, left: 0.321, top: -0.142, ratio: 356 / 640 };

/** 한국 시간으로 지금 12월인가. */
function isDecemberKst(now: Date = new Date()): boolean {
  return new Date(now.getTime() + 9 * 3600_000).getUTCMonth() === 11;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`그림을 불러오지 못했습니다: ${src}`));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

const SIZE = 1024; // 저장하는 그림의 한 변(px). 인쇄해도 깨지지 않을 크기.
const QUIET = 3; // 바깥 여백(점 단위). 스캐너가 QR 의 끝을 알아보는 데 필요하다.

async function drawQr(canvas: HTMLCanvasElement, text: string, withHat: boolean) {
  const QRCode = (await import("qrcode")).default;
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const dark = (r: number, c: number) => qr.modules.get(r, c) === 1;

  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 쓸 수 없습니다.");
  const cell = SIZE / (n + QUIET * 2);
  const at = (i: number) => (i + QUIET) * cell;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = "#000000";

  // 가운데 로고 자리 — 한 변이 전체의 약 28%(넓이 약 8%). 이 안의 점은 그리지 않는다.
  const logoCells = Math.max(7, Math.round(n * 0.28) | 1);
  const lo = Math.floor((n - logoCells) / 2);
  const hi = lo + logoCells;
  const inLogo = (r: number, c: number) => r >= lo && r < hi && c >= lo && c < hi;
  // 세 귀퉁이의 위치 찾기 무늬(7×7)는 따로 둥글게 그린다.
  const inFinder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  const pad = cell * 0.08;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!dark(r, c) || inLogo(r, c) || inFinder(r, c)) continue;
      roundRect(ctx, at(c) + pad, at(r) + pad, cell - pad * 2, cell - pad * 2, cell * 0.32);
    }
  }
  for (const [fr, fc] of [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ] as const) {
    ctx.fillStyle = "#000000";
    roundRect(ctx, at(fc), at(fr), cell * 7, cell * 7, cell * 1.6);
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, at(fc + 1), at(fr + 1), cell * 5, cell * 5, cell * 1.0);
    ctx.fillStyle = "#000000";
    roundRect(ctx, at(fc + 2), at(fr + 2), cell * 3, cell * 3, cell * 0.7);
  }

  // 로고 — 비워 둔 자리 안에, 모자를 쓸 때는 모자 높이만큼 자리를 남기고 놓는다.
  const [logo, hat] = await Promise.all([loadImage(LOGO_SRC), withHat ? loadImage(HAT_SRC) : Promise.resolve(null)]);
  const box = { x: at(lo), y: at(lo), size: logoCells * cell };
  const inset = cell * 0.4;
  const availW = box.size - inset * 2;
  const logoRatio = logo.height / logo.width;
  // 모자는 로고 위로 로고 높이의 일부만큼 올라온다(top 이 음수).
  const hatOver = hat ? -HAT.top * logoRatio : 0; // 로고 폭 대비, 위로 솟는 높이
  const totalH = logoRatio + hatOver; // 로고 폭 대비 전체 높이
  const w = Math.min(availW, (box.size - inset * 2) / totalH);
  const x = box.x + (box.size - w) / 2;
  const y = box.y + (box.size - w * totalH) / 2 + w * hatOver;
  ctx.drawImage(logo, x, y, w, w * logoRatio);
  if (hat) {
    const hw = w * HAT.width;
    ctx.drawImage(hat, x + w * HAT.left, y + w * logoRatio * HAT.top, hw, hw * HAT.ratio);
  }
}

export function FormQr({ url, fileName, label }: { url: string; fileName: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const canvas = ref.current;
    if (!canvas) return;
    drawQr(canvas, url, isDecemberKst())
      .then(() => alive && setReady(true))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "QR 을 만들지 못했습니다."));
    return () => {
      alive = false;
    };
  }, [url]);

  const save = () => {
    ref.current?.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${fileName}.png`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  };

  return (
    <div>
      {/* 그림은 1024px 로 그리고 화면에는 작게 보여준다. 흰 바탕이라 다크 모드에서도 흰 카드 그대로 둔다. */}
      <canvas ref={ref} role="img" aria-label={`${label} QR 코드`} className="aspect-square w-full max-w-48 rounded-lg border border-border bg-white" />
      {error ? (
        <p role="alert" className="mt-2 text-body-sm text-danger">
          {error}
        </p>
      ) : (
        <button type="button" onClick={save} disabled={!ready} className={`${adminButtonClass("secondary")} mt-2`}>
          QR 저장
        </button>
      )}
    </div>
  );
}
