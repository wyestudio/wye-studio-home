"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { kstToday, won } from "@/lib/groupPricing";
import {
  SUPPLIER,
  VENUE_ADDRESS,
  buildQuoteDoc,
  type QuoteDoc,
  type QuoteDocInput,
  type QuoteDocMode,
} from "./quoteDocument";

/*
  신청 완료 화면의 「견적서 받기」 — 회사 결재에 첨부할 예상 견적서 PDF(2026-10-26 대표님).

  왜 브라우저에서 만드는가
    서버가 신청 번호로 PDF 를 만들어 주면, 번호만 알면 남의 담당자 이름 · 연락처가 든 서류를 받을 수
    있다. 방금 신청한 사람의 화면에 있는 값으로만 만들면 그런 통로가 생기지 않는다.
  어떻게 만드는가
    A4 크기 견적서를 화면 밖에 잠깐 그려서 그림으로 뜬 뒤(html-to-image) A4 PDF 한 장에 붙인다(jsPDF).
    두 라이브러리는 버튼을 누를 때만 내려받는다 — 페이지 첫 로딩을 무겁게 하지 않는다.
  ⚠️ 견적서 안의 크기 · 색은 인쇄물(A4) 기준이라 사이트 디자인 토큰을 쓰지 않고 mm 로 직접 적는다.
*/

const A4_W = 794; // 210mm @96dpi
const A4_H = 1123; // 297mm @96dpi

export function QuotePdfButtons({ input }: { input: QuoteDocInput }) {
  const [mode, setMode] = useState<QuoteDocMode | null>(null);
  const [error, setError] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);
  const issued = kstToday();
  const doc = mode ? buildQuoteDoc(input, issued, mode) : null;

  useEffect(() => {
    if (!mode) return;
    const node = sheetRef.current;
    let cancelled = false;
    (async () => {
      try {
        if (!node || !doc) throw new Error("견적서를 만들 수 없어요.");
        await document.fonts.ready;
        const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
        const dataUrl = await toJpeg(node, {
          quality: 0.92,
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          width: A4_W,
          height: A4_H,
        });
        if (cancelled) return;
        const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
        pdf.addImage(dataUrl, "JPEG", 0, 0, 210, 297);
        pdf.save(`우주이스케이프_예상견적서_${mode === "basic" ? "기본" : "상세"}_${doc.number}.pdf`);
      } catch {
        if (!cancelled) setError("견적서를 만들지 못했어요. 잠시 후 다시 눌러주세요.");
      } finally {
        if (!cancelled) setMode(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // doc 은 mode 에서 나온다 — mode 가 바뀔 때만 한 번 만든다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const busy = mode !== null;
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            { m: "basic", label: "기본", sub: "합계만" },
            { m: "detail", label: "상세", sub: "품목별 금액" },
          ] as const
        ).map((b) => (
          <button
            key={b.m}
            type="button"
            disabled={busy}
            onClick={() => {
              setError("");
              setMode(b.m);
            }}
            className="flex min-h-[56px] flex-col items-center justify-center rounded-lg border border-line bg-fill px-3 py-2 transition hover:border-line-strong disabled:opacity-60"
          >
            <span className="text-body font-semibold">{mode === b.m ? "만드는 중…" : `견적서 받기 (${b.label})`}</span>
            <span className="text-body-sm text-muted">{b.sub}</span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-body-sm font-semibold text-danger">
          {error}
        </p>
      )}
      {/* 화면 밖에 잠깐 그리는 A4 견적서. 사람에게는 보이지 않는다. */}
      {doc &&
        createPortal(
          <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
            <QuoteSheet ref={sheetRef} doc={doc} />
          </div>,
          document.body
        )}
    </>
  );
}

const C = { ink: "#1d1a24", muted: "#6b6577", line: "#dcd6e2", soft: "#f6f2f8", accent: "#b43bb9", accentSoft: "#fbeefc" };
const th: React.CSSProperties = {
  width: "22mm",
  textAlign: "left",
  fontWeight: 600,
  color: C.muted,
  background: C.soft,
  whiteSpace: "nowrap",
  border: `1px solid ${C.line}`,
  padding: "1mm 2.4mm",
  verticalAlign: "top",
};
const td: React.CSSProperties = { border: `1px solid ${C.line}`, padding: "1mm 2.4mm", verticalAlign: "top" };
const kv: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "9pt" };
const h3: React.CSSProperties = { fontSize: "10pt", fontWeight: 700, margin: "4.5mm 0 1.5mm" };
const num: React.CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const cell: React.CSSProperties = { padding: "1.4mm 2.4mm", borderBottom: `1px solid ${C.line}`, verticalAlign: "top" };
const head: React.CSSProperties = {
  background: C.soft,
  fontWeight: 700,
  padding: "1.6mm 2.4mm",
  textAlign: "left",
  borderTop: `1.5px solid ${C.ink}`,
  borderBottom: `1px solid ${C.line}`,
};

function QuoteSheet({ doc, ref }: { doc: QuoteDoc; ref: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      style={{
        width: A4_W,
        height: A4_H,
        padding: "12mm 15mm 0",
        boxSizing: "border-box",
        background: "#fff",
        color: C.ink,
        fontSize: "9.5pt",
        lineHeight: 1.5,
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          paddingBottom: "4mm",
          borderBottom: `2px solid ${C.ink}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Image src="/logo-black.png" alt="" width={43} height={30} unoptimized />
          <b style={{ fontSize: "11pt" }}>우주이스케이프</b>
        </div>
        <div style={{ fontSize: "22pt", fontWeight: 800 }}>예상 견적서</div>
      </header>
      <div style={{ display: "flex", gap: 18, justifyContent: "flex-end", marginTop: "3mm", color: C.muted, fontSize: "9pt" }}>
        <span>
          견적번호<b style={{ color: C.ink, fontWeight: 600, marginLeft: 4 }}>{doc.number}</b>
        </span>
        <span>
          견적일<b style={{ color: C.ink, fontWeight: 600, marginLeft: 4 }}>{doc.issuedAt}</b>
        </span>
      </div>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6mm", marginTop: "4.5mm" }}>
        <div>
          <div style={{ fontSize: "15pt", fontWeight: 800 }}>
            {doc.recipient}
            <span style={{ fontSize: "10.5pt", fontWeight: 600, marginLeft: 4 }}>귀하</span>
          </div>
          <table style={{ ...kv, marginTop: "3mm" }}>
            <tbody>
              <tr>
                <th style={th}>담당자</th>
                <td style={td}>{doc.organizerName} 님</td>
              </tr>
              <tr>
                <th style={th}>연락처</th>
                <td style={td}>{doc.contact}</td>
              </tr>
            </tbody>
          </table>
          <p style={{ margin: "3mm 0 0" }}>아래와 같이 견적합니다.</p>
        </div>
        <div>
          <div style={{ fontSize: "9pt", fontWeight: 700, marginBottom: "1.5mm" }}>공급자</div>
          <table style={kv}>
            <tbody>
              {[
                ["등록번호", SUPPLIER.regNo],
                ["상호", SUPPLIER.name],
                ["대표자", SUPPLIER.owner],
                ["이메일", SUPPLIER.email],
                ["문의", SUPPLIER.kakao],
              ].map(([k, v]) => (
                <tr key={k}>
                  <th style={th}>{k}</th>
                  <td style={td}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div
        style={{
          marginTop: "4.5mm",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: C.accentSoft,
          border: `1.5px solid ${C.accent}`,
          padding: "2.4mm 5mm",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: "10.5pt" }}>
          합계금액
          <small style={{ display: "block", fontWeight: 400, color: C.muted, fontSize: "8.5pt" }}>부가가치세 포함</small>
        </div>
        <div style={{ textAlign: "right" }}>
          <b style={{ display: "block", fontSize: "18pt", fontWeight: 800, color: C.accent }}>₩{doc.total.toLocaleString("ko-KR")}</b>
          <span style={{ fontSize: "9pt", color: C.muted }}>{doc.totalWords}</span>
        </div>
      </div>

      <div style={h3}>행사 개요</div>
      <table style={kv}>
        <tbody>
          {[
            ["행사명", "단체 팀빌딩 프로그램 (팀 대항 방탈출형, 단독 진행)"],
            ["일시", `${doc.eventDate} ${doc.eventTime}`],
            ["인원", `${doc.headcount}명`],
            ["장소", VENUE_ADDRESS],
          ].map(([k, v]) => (
            <tr key={k}>
              <th style={th}>{k}</th>
              <td style={td}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={h3}>견적 내역</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
        <thead>
          <tr>
            <th style={{ ...head, width: "9mm", textAlign: "center" }}>No</th>
            <th style={head}>품명</th>
            <th style={{ ...head, ...num }}>수량</th>
            <th style={{ ...head, ...num }}>단가(원)</th>
            <th style={{ ...head, ...num }}>금액(원)</th>
          </tr>
        </thead>
        <tbody>
          {doc.rows.map((r, i) => (
            <tr key={r.name}>
              <td style={{ ...cell, textAlign: "center", color: C.muted }}>{i + 1}</td>
              <td style={cell}>
                {r.name}
                {r.desc && <small style={{ display: "block", color: C.muted, fontSize: "8.5pt" }}>{r.desc}</small>}
              </td>
              <td style={{ ...cell, ...num }}>{r.qty}</td>
              <td style={{ ...cell, ...num }}>{signed(r.unit)}</td>
              <td style={{ ...cell, ...num }}>{signed(r.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {[
            ["공급가액", doc.supply],
            ["부가세(10%)", doc.vat],
          ].map(([k, v]) => (
            <tr key={k}>
              <td />
              <td colSpan={3} style={{ ...num, padding: "1mm 2.4mm", color: C.muted }}>
                {k}
              </td>
              <td style={{ ...num, padding: "1mm 2.4mm" }}>{Number(v).toLocaleString("ko-KR")}</td>
            </tr>
          ))}
          <tr>
            <td style={{ borderTop: `1.5px solid ${C.ink}` }} />
            <td colSpan={3} style={{ ...num, borderTop: `1.5px solid ${C.ink}`, fontWeight: 800, fontSize: "10.5pt", padding: "2mm 2.4mm 1mm" }}>
              합계
            </td>
            <td style={{ ...num, borderTop: `1.5px solid ${C.ink}`, fontWeight: 800, fontSize: "10.5pt", padding: "2mm 2.4mm 1mm" }}>
              {doc.total.toLocaleString("ko-KR")}
            </td>
          </tr>
        </tfoot>
      </table>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: "6mm", marginTop: "4.5mm" }}>
        <div>
          <div style={{ ...h3, marginTop: 0 }}>결제 조건</div>
          <table style={kv}>
            <tbody>
              <tr>
                <th style={th}>예약금</th>
                <td style={td}>
                  {won(doc.deposit)} (합계의 30%)
                  <br />
                  입금 확인 순서대로 예약이 확정됩니다.
                </td>
              </tr>
              <tr>
                <th style={th}>잔금</th>
                <td style={td}>
                  {won(doc.balance)}
                  <br />
                  행사 7일 전 인원 확정 후 결제합니다.
                </td>
              </tr>
              <tr>
                <th style={th}>결제 수단</th>
                <td style={td}>법인카드, 계좌이체</td>
              </tr>
              <tr>
                <th style={th}>증빙</th>
                <td style={td}>세금계산서 발행</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <div style={{ ...h3, marginTop: 0 }}>취소 및 환불</div>
          <table style={kv}>
            <tbody>
              <tr>
                <th style={th}>행사 14일 전까지</th>
                <td style={td}>예약금 전액 환불</td>
              </tr>
              <tr>
                <th style={th}>행사 13~8일 전</th>
                <td style={td}>예약금 50% 환불</td>
              </tr>
              <tr>
                <th style={th}>행사 7일 전부터</th>
                <td style={{ ...td, color: "#b8322a", fontWeight: 600 }}>예약금 환불 불가</td>
              </tr>
            </tbody>
          </table>
          <p style={{ margin: "2mm 0 0", fontSize: "8.5pt", color: C.muted }}>
            잔금 결제 후에는 인원 감소나 취소에 따른 차액을 환불하지 않습니다.
          </p>
        </div>
      </div>

      <ul style={{ margin: "4mm 0 0", padding: 0, listStyle: "none", fontSize: "8.5pt", color: C.muted }}>
        <li>※ 본 견적서는 예약 확정 전의 예상 금액이며, 일정 확인 후 최종 금액을 안내드립니다.</li>
        <li>※ 입금 계좌는 일정 확정 후 따로 안내드립니다.</li>
        <li>※ 참가 연령은 만 16세 이상이며, 식사는 제공되지 않습니다.</li>
      </ul>
    </div>
  );
}

function signed(n: number): string {
  return n < 0 ? `-${(-n).toLocaleString("ko-KR")}` : n.toLocaleString("ko-KR");
}
