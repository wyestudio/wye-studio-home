import "server-only";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * "우리 기기" 표시.
 *
 * 운영 사이트에서 직접 테스트한 방문·신청이 분석에 섞인다(2026-09-17).
 * IP 로 거르면 LTE·다른 와이파이에서 새므로, 기기(브라우저)마다 /internal 에서
 * 한 번 표시를 켜 두고 그 쿠키로 거른다.
 *
 * - GA4: GTM 이 이 쿠키를 읽어 traffic_type=internal 을 붙이고, GA4 의
 *   '내부 트래픽' 데이터 필터가 뺀다. ⚠️ 그래서 httpOnly 로 두지 않는다.
 * - 우리 DB: 신청이 성공한 뒤 applications.is_internal 을 켜고, 어드민 분석
 *   (adminStats.ts)이 뺀다.
 *
 * ⚠️ 이름을 바꾸면 GTM 의 '1st-party cookie' 변수도 같이 바꿔야 한다.
 * ⚠️ 인스타·카카오톡 인앱 브라우저는 쿠키 저장소가 따로라 그 안에서도 한 번 켜야 한다.
 */
export const INTERNAL_COOKIE = "wye_internal";

/** 브라우저가 허용하는 최대치(400일). 끝나면 다시 켜면 된다. */
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/**
 * www·admin·test 서브도메인이 표시를 같이 쓰게 상위 도메인에 심는다.
 * 어드민이나 테스트 사이트에서 켜도 운영 사이트 방문이 같이 빠진다.
 */
function cookieDomain(host: string): string | undefined {
  const name = host.split(":")[0];
  return name === "wouldyouescape.com" || name.endsWith(".wouldyouescape.com")
    ? ".wouldyouescape.com"
    : undefined;
}

export async function isInternalDevice(): Promise<boolean> {
  try {
    return (await cookies()).get(INTERNAL_COOKIE)?.value === "1";
  } catch {
    return false;
  }
}

export async function setInternalDevice(on: boolean): Promise<void> {
  const store = await cookies();
  const domain = cookieDomain((await headers()).get("host") || "");
  if (on) {
    store.set(INTERNAL_COOKIE, "1", {
      domain,
      path: "/",
      maxAge: MAX_AGE_SECONDS,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  } else {
    // 심을 때와 같은 domain 으로 지워야 지워진다.
    store.set(INTERNAL_COOKIE, "", { domain, path: "/", maxAge: 0 });
  }
}

/**
 * 신청 건에 '우리 기기' 표시를 단다.
 *
 * ⚠️ 쿠키는 호출하는 쪽에서 신청 직후에 읽어 넘긴다 — after() 안에서는 쿠키를 못 읽는다.
 * ⚠️ 실패해도 조용히 넘어간다. 분석용 값 때문에 신청이 깨지면 안 된다.
 */
export async function markInternalApplication(applicationId: string, internal: boolean): Promise<void> {
  if (!internal) return;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("applications").update({ is_internal: true }).eq("id", applicationId);
    if (error) console.error("[internal] 테스트 기기 표시 실패 (신청 자체는 성공)", error);
  } catch (err) {
    console.error("[internal] 테스트 기기 표시 실패 (신청 자체는 성공)", err);
  }
}
