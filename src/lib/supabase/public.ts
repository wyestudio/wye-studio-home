import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * 공개 데이터 전용 Supabase 클라이언트 (anon 키, 쿠키 없음).
 *
 * 왜 따로 두나
 *   server.ts 의 createClient() 는 `cookies()` 를 읽는다. Next 는 요청 쿠키를
 *   건드리는 순간 그 페이지를 **무조건 동적 렌더**로 취급하고, 데이터 캐시도
 *   쓸 수 없게 한다(unstable_cache 안에서는 cookies() 를 부를 수 없다).
 *
 *   테마·회차·집계는 **누가 보든 같은 값**이라 쿠키가 필요 없다. 로그인
 *   시스템도 지금은 휴면 상태다. 그래서 공개 읽기는 이 클라이언트로 하고,
 *   그 결과를 캐시해 매 요청마다 DB 를 다시 치지 않게 한다.
 *
 * ⚠️ 사용자별로 달라지는 데이터에는 쓰지 말 것. 그건 server.ts 쪽이다.
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
