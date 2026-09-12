import "server-only";
import { SolapiMessageService } from "solapi";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatKrw } from "@/lib/format";
import { formatCouponCode } from "@/lib/coupon";

/**
 * 쿠폰 발송.
 *
 * 문구는 sms_templates 의 coupon_preopen 을 쓴다. 운영자가 어드민에서 고칠 수
 * 있어야 하므로 코드에 본문을 두지 않는다.
 *
 * 한 통에 **본인 쿠폰과 지인 쿠폰을 함께** 담는다. 예전에는 두 통으로 나눠
 * 보냈는데, 받는 쪽에서 두 문자가 무슨 관계인지 알기 어려웠다.
 */

export type CouponPart = {
  code: string;
  discount: string;
  /** 'YYYY.MM.DD' */
  expiresAt: string;
  link: string;
};

export type CouponSmsVars = {
  name: string;
  self: CouponPart;
  friend: CouponPart;
};

function getService() {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  if (!apiKey || !apiSecret) return null;
  return new SolapiMessageService(apiKey, apiSecret);
}

function render(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
}

export async function getCouponTemplate(key: string): Promise<{ body: string } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("sms_templates").select("body").eq("key", key).single();
  return data?.body ? { body: data.body } : null;
}

/** 치환 결과를 만든다. 미리보기와 실제 발송이 같은 함수를 쓴다. */
export function buildCouponSms(body: string, vars: CouponSmsVars): string {
  return render(body, {
    name: vars.name,
    self_code: formatCouponCode(vars.self.code),
    self_discount: vars.self.discount,
    self_expires_at: vars.self.expiresAt,
    self_link: vars.self.link,
    friend_code: formatCouponCode(vars.friend.code),
    friend_discount: vars.friend.discount,
    friend_expires_at: vars.friend.expiresAt,
    friend_link: vars.friend.link,
    // 옛 이름도 받아준다 — 어드민에서 예전 문구를 그대로 쓰고 있으면
    // {{code}} 가 날것으로 나가 버린다. 본인 쿠폰 쪽으로 붙인다.
    code: formatCouponCode(vars.self.code),
    discount: vars.self.discount,
    expires_at: vars.self.expiresAt,
    link: vars.self.link,
  });
}

export type SendOutcome = { phone: string; ok: boolean; detail: string };

/**
 * 한 사람에게 보낸다.
 *
 * ⚠️ 테스트 환경에서는 실제 발송하지 않는다. 테스트 DB 에도 실제 고객 번호가
 *    들어 있어, 화면에서 눌러보는 것만으로 문자가 나갈 수 있다.
 */
/**
 * @deprecated 한 명씩 보낸다. 여러 명에게 보내는 곳에서는 쓰지 말 것 —
 * 솔라피 왕복이 인원수만큼 생겨 함수 제한 시간을 넘는다.
 * 대신 sendSmsBulk(@/lib/smsBulk) 로 한 번에 보낸다.
 * (현재 호출부 없음. 1:1 발송이 다시 필요해질 때를 위해 남겨 둔다)
 */
export async function sendCouponSms(to: string, text: string): Promise<SendOutcome> {
  const digits = to.replace(/\D/g, "");

  if (process.env.NEXT_PUBLIC_IS_TEST_ENV === "true") {
    console.log(`[couponSms] 테스트 환경 — 미발송. 수신 ${digits}\n${text}`);
    return { phone: digits, ok: true, detail: "테스트 환경 — 미발송" };
  }

  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;
  const service = getService();
  if (!service || !senderNumber) {
    return { phone: digits, ok: false, detail: "SOLAPI_* 미설정" };
  }

  try {
    await service.send({ from: senderNumber, to: digits, text });
    return { phone: digits, ok: true, detail: "발송 완료" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { phone: digits, ok: false, detail: message };
  }
}

/** 쿠폰 금액 표기. 정액이면 금액, 정률이면 퍼센트. */
export function discountLabel(type: string, value: number): string {
  return type === "fixed" ? formatKrw(value) : `${value}%`;
}
