import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PhotoView from "./PhotoView";

export const metadata: Metadata = {
  title: "우리 팀 보드판 | 우주이스케이프",
  description: "방탈출을 마치고 꾸민 보드판 사진이에요.",
  // 참가자에게만 주는 주소다. 검색에 걸릴 이유가 없다.
  robots: { index: false, follow: false },
};

const BUCKET = "board-photos";

/**
 * 보드판 사진 받아가는 자리. 현장 태블릿의 QR 이 여기로 온다.
 *
 * ⚠️ 주소에서 받는 것은 **버킷 안의 경로뿐**이고, 공개 URL 은 여기서 만든다.
 *    `?src=` 로 통째 주소를 받으면 남의 주소를 끼워 넣어 우리 도메인으로 보여줄 수 있다.
 *    경로 모양도 업로드할 때 만든 형태(YYYYMMDD/타임스탬프-UUID.확장자)만 받는다.
 */
const KEY_RE = /^\d{8}\/\d+-[0-9a-f-]{36}\.(png|jpg|webp)$/;

export default async function PhotoPage({ params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const path = (key || []).join("/");
  if (!KEY_RE.test(path)) notFound();

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) notFound();
  const src = `${base}/storage/v1/object/public/${BUCKET}/${path}`;

  return (
    <>
      {/*
        ⚠️ href · precedence 를 지우지 말 것. 이 페이지에는 클라이언트 컴포넌트
           (PhotoView)가 있어서 다시 그려지는데, 그때 React 19 가
           "Cannot render a <style> outside the main document" 로 막는다
           (2026-10-09 실측). 두 속성을 주면 React 가 <head> 로 올리고 중복도 지운다.
           review-guide 처럼 **클라이언트 컴포넌트가 없는** 페이지는 그냥 둬도 된다.
      */}
      <style href="board-photo-page" precedence="default">
        {PAGE_STYLES}
      </style>
      <main className="wrap">
        <header className="head">
          <div className="eyebrow">바-ㅇ탈출</div>
          <h1>우리 팀 보드판</h1>
          <p>오늘 꾸민 보드판이에요. 저장해서 간직하세요!</p>
        </header>
        <PhotoView src={src} />
        <footer className="foot">우주이스케이프</footer>
      </main>
    </>
  );
}

const PAGE_STYLES = String.raw`
  /* 현장 앱(wye-studio-webapp)의 index.css 와 같은 결로 맞춘다 —
     방탈출을 막 끝낸 참가자가 태블릿에서 넘어오는 화면이라 둘이 달라 보이면 안 된다.
     글꼴·색·네모 그림자 버튼이 그쪽에서 가져온 것들이다. */
  /* ⚠️ 이 글꼴 파일들은 **이 페이지에 나오는 글자만** 남겨 잘라 둔 것이다(671KB → 8KB).
     문구를 고치면 새 글자가 시스템 글꼴로 떨어진다 — public/fonts/README.md 참고. */
  @font-face{
    font-family:'Galmuri11'; src:url('/fonts/Galmuri11.woff2') format('woff2');
    font-weight:400; font-display:swap;
  }
  @font-face{
    font-family:'Galmuri11'; src:url('/fonts/Galmuri11-Bold.woff2') format('woff2');
    font-weight:700; font-display:swap;
  }
  :root{
    --bg:#0a0318; --card:#2d134d; --card-border:#8c4ca4;
    --text:#f3eeff; --text-dim:#d9b9df; --ink:#29113f;
    --accent:#fff36a; --accent-2:#ff4fa3; --pink-soft:#ffd0e8;
    --pixel-shadow:#0c041d;
    --font-pixel:'Galmuri11','Galmuri',monospace;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    font-family:var(--font-pixel);
    color:var(--text); line-height:1.6; word-break:keep-all;
    /* .escape-overlay 와 같은 바탕: 격자 + 아래쪽 분홍 번짐 */
    background:
      radial-gradient(circle at 50% 118%, rgba(194,36,148,.34), transparent 58%),
      linear-gradient(rgba(255,79,163,.055) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,79,163,.055) 1px, transparent 1px),
      var(--bg);
    background-size:auto, 10px 10px, 10px 10px, auto;
    background-attachment:fixed;
    -webkit-font-smoothing:antialiased;
  }
  .wrap{max-width:560px;margin:0 auto;padding:26px 16px 44px;display:flex;flex-direction:column;gap:16px}

  .head{text-align:center;display:flex;flex-direction:column;gap:6px}
  .eyebrow{color:var(--accent-2);font-size:13px;font-weight:700;letter-spacing:.08em}
  .head h1{
    font-size:26px;font-weight:700;color:var(--accent);
    text-shadow:3px 3px 0 var(--pixel-shadow);
  }
  .head p{color:var(--text-dim);font-size:13px}

  /* 사진이 주인공. 길게 눌러 저장하는 길도 열어둔다. */
  .shot{
    width:100%;display:block;
    background:var(--bg);
    border:2px solid var(--card-border);
    border-radius:3px;
    box-shadow:5px 5px 0 var(--pixel-shadow);
  }

  .actions{display:flex;gap:10px;margin-top:4px}
  .btn{
    flex:1;min-height:52px;padding:13px 12px;cursor:pointer;
    font-family:inherit;font-size:16px;font-weight:700;letter-spacing:-.01em;
    color:var(--ink);background:var(--accent-2);
    border:2px solid var(--pink-soft);border-radius:3px;
    box-shadow:4px 4px 0 var(--pixel-shadow);
  }
  .btn.primary{background:var(--accent);border-color:var(--accent);color:var(--ink)}
  .btn:hover:not(:disabled){background-image:linear-gradient(rgba(255,255,255,.13) 0 0)}
  /* 눌린 느낌 — 3px 내려앉고 그림자가 줄어든다(웹앱과 같은 방식). */
  .btn:active:not(:disabled){
    transform:translate(3px,3px);
    box-shadow:1px 1px 0 var(--pixel-shadow);
    background-image:linear-gradient(rgba(0,0,0,.22) 0 0);
  }
  .btn:disabled{opacity:.55;cursor:default}

  .hint{color:var(--text-dim);font-size:12px;text-align:center}
  .foot{color:var(--text-dim);font-size:11px;text-align:center;opacity:.6;margin-top:4px}
`;
