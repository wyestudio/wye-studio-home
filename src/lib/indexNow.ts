import "server-only";

/*
  IndexNow — 고친 주소를 검색엔진에 바로 알린다(무료). Bing · 네이버 · Yandex 등 참여 엔진끼리
  한 곳에 보내면 나눠 받는다. 구글은 참여하지 않는다(구글은 사이트맵 · Search Console 로).

  열쇠는 비밀이 아니다 — 우리 사이트가 이 주소의 주인이라는 표시로 public/<열쇠>.txt 에 같은 값을
  올려 두고, 엔진이 그 파일을 읽어 확인한다. 열쇠를 바꾸면 파일 이름 · 내용도 같이 바꾼다.

  ⚠️ 운영(운영 DB 를 보는 Vercel production)에서만 보낸다. 테스트 어드민에서 저장한 것을 알리면
     엔진이 운영 페이지를 다시 읽을 뿐이지만, 바뀐 게 없는 주소를 자꾸 보내면 무시당한다.
  ⚠️ 실패해도 저장은 그대로 간다 — 로그만 남긴다. 부르는 쪽은 after() 로 감싸 응답을 막지 않는다.
*/

const HOST = "www.wouldyouescape.com";
const KEY = "bfb0862b01819b0a64dde0404e5b0b6d";
const PROD_SUPABASE_REF = "jilghhbbtjyybzbgwdhq";

export async function pingIndexNow(paths: string[]): Promise<void> {
  if (process.env.VERCEL_ENV !== "production") return;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(PROD_SUPABASE_REF)) return;
  const urlList = [...new Set(paths)].map((p) => `https://${HOST}${p}`);
  if (urlList.length === 0) return;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
      signal: AbortSignal.timeout(5000),
    });
    // 200 · 202 가 정상. 202 는 "받았고 열쇠 확인은 나중에" 다
    if (!res.ok) console.error("[indexnow]", res.status, await res.text().catch(() => ""));
  } catch (err) {
    console.error("[indexnow]", err);
  }
}
