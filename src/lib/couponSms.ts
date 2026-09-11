import "server-only";
import { SolapiMessageService } from "solapi";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatKrw } from "@/lib/format";
import { formatCouponCode } from "@/lib/coupon";

/**
 * 쿠폰 발송.
 *
 * 문구는 sms_templates 의 coupon_self / coupon_friend 를 쓴다. 운영자가
 * 어드민에서 고칠 수 있어야 하므로 코드에 본문을 두지 않는다.
 */

export type CouponSmsVars = {
  name: string;
  code: string;
  discount: string;
  expiresAt: string;
  link: string;
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
    code: formatCouponCode(vars.code),
    discount: vars.discount,
    expires_at: vars.expiresAt,
    link: vars.link,
  });
}

export type SendOutcome = { phone: string; ok: boolean; detail: string };

/**
 * 한 사람에게 보낸다.
 *
 * ⚠️ 테스트 환경에서는 실제 발송하지 않는다. 테스트 DB 에도 실제 고객 번호가
 *    들어 있어, 화면에서 눌러보는 것만으로 문자가 나갈 수 있다.
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
