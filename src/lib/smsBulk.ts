import "server-only";
import { SolapiMessageService } from "solapi";

/**
 * 여러 명에게 한 번에 문자를 보낸다.
 *
 * 왜 필요한가: 발송 지점 세 곳(문자3 장소안내 · 쿠폰 · 문자7 회차취소)이
 * 모두 "한 명 보내고 응답 기다리고 다음 한 명" 이었다. 40명이면 솔라피 왕복이
 * 40번이라 Vercel 함수 제한 시간을 넘길 수 있었다.
 *
 * 솔라피 SDK 의 send() 는 원래 배열을 받는다 —
 *   "한번의 요청으로 최대 10,000건까지 발송할 수 있습니다" (solapi 6.0.1 타입 주석)
 * 그걸 안 쓰고 있었을 뿐이다. 왕복 40번이 1번이 된다.
 *
 * ⚠️ 부분 실패를 반드시 되짚을 수 있어야 한다. 호출부는 "누구에게 실제로 나갔는지"
 *    를 알아야 발송 표시(reminder_sms_sent_at)를 정확히 남길 수 있다. 그래서
 *    수신번호가 아니라 호출부가 준 key 로 결과를 돌려준다.
 */

export type BulkMessage = {
  /** 결과를 되짚을 호출부 고유 키(신청 id, phone_hash 등). 수신번호와 달라도 된다. */
  key: string;
  to: string;
  text: string;
};

export type BulkSendResult = {
  /** 실제로 접수된 메시지의 key */
  sentKeys: string[];
  failures: { key: string; reason: string }[];
};

/** 솔라피 1회 요청 상한은 10,000건이지만, 응답을 다루기 쉽게 넉넉히 잘라 보낸다. */
const CHUNK_SIZE = 500;

const digitsOf = (v: string) => v.replace(/\D/g, "");

function getService(): SolapiMessageService | null {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  if (!apiKey || !apiSecret) return null;
  return new SolapiMessageService(apiKey, apiSecret);
}

export async function sendSmsBulk(
  messages: BulkMessage[],
  logLabel: string
): Promise<BulkSendResult> {
  if (messages.length === 0) return { sentKeys: [], failures: [] };

  // ⚠️ 테스트 환경에서는 절대 실제 발송하지 않는다. (smsV2.sendTemplate 과 같은 가드)
  //    테스트 DB 에도 실제 고객 번호가 들어 있어, 운영자가 테스트 화면에서 버튼을
  //    눌러보는 것만으로 고객에게 문자가 나갈 수 있다.
  //    발송했다고 돌려주는 것은 기존 동작과 맞춘 것이다 — 그래야 테스트에서도
  //    "발송 표시"까지 포함한 흐름을 그대로 확인할 수 있다.
  if (process.env.NEXT_PUBLIC_IS_TEST_ENV === "true") {
    for (const m of messages) {
      console.log(`[smsBulk] 테스트 환경 — ${logLabel} 미발송. 수신 ${m.to}\n${m.text}`);
    }
    return { sentKeys: messages.map((m) => m.key), failures: [] };
  }

  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;
  const service = getService();
  if (!service || !senderNumber) {
    console.warn(`[smsBulk] SOLAPI_* 미설정 — ${logLabel} ${messages.length}건을 건너뜁니다.`);
    return { sentKeys: messages.map((m) => m.key), failures: [] };
  }

  const sentKeys: string[] = [];
  const failures: { key: string; reason: string }[] = [];

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);

    try {
      const res = await service.send(
        chunk.map((m) => ({ from: senderNumber, to: digitsOf(m.to), text: m.text }))
      );

      // 접수 실패한 건만 failedMessageList 에 수신번호로 담겨 온다.
      // ⚠️ 배열이 아니면(응답 형태가 예상과 다르면) 전부 성공으로 본다.
      //    SDK 는 전건 실패 시 MessageNotReceivedError 를 던지므로, 예외 없이
      //    돌아왔다는 것 자체가 "접수됐다" 는 뜻이다. 여기서 실패로 잡으면
      //    다음 실행이 같은 사람에게 다시 보내 중복 문자가 된다 — 더 나쁘다.
      const failedList = Array.isArray(res?.failedMessageList) ? res.failedMessageList : [];
      const failedByPhone = new Map<string, string>();
      for (const f of failedList) {
        failedByPhone.set(digitsOf(String(f.to)), f.statusMessage || f.statusCode || "발송 실패");
      }

      for (const m of chunk) {
        const reason = failedByPhone.get(digitsOf(m.to));
        if (reason) failures.push({ key: m.key, reason });
        else sentKeys.push(m.key);
      }

      if (failedList.length > 0) {
        console.error(
          `[smsBulk] ${logLabel} 부분 실패 ${failedList.length}/${chunk.length}`,
          JSON.stringify(failedList)
        );
      } else {
        console.log(`[smsBulk] ${logLabel} ${chunk.length}건 접수 완료`);
      }
    } catch (err) {
      // 전건 실패(MessageNotReceivedError) 또는 네트워크 오류.
      // ⚠️ 실패로 남겨 다음 실행이 재시도하게 둔다. 기존 한 건씩 보내던 코드와
      //    같은 판단이다 — 못 받는 것보다 한 번 더 받는 쪽이 낫다.
      const reason = err instanceof Error ? err.message : "알 수 없는 오류";
      console.error(`[smsBulk] ${logLabel} ${chunk.length}건 발송 실패`, err);
      for (const m of chunk) failures.push({ key: m.key, reason });
    }
  }

  return { sentKeys, failures };
}
