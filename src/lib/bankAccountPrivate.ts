import "server-only";
import { BANK_ACCOUNT } from "@/lib/bankAccount";

/**
 * 입금 안내에 적는 계좌 — **가리지 않은 값**(하이픈 넣은 계좌번호 · 예금주 전체 이름).
 *
 * 화면용 BANK_ACCOUNT(bankAccount.ts)는 예금주 가운데 글자를 가린다. 본인에게만 가는 안내(신청 확인 문자,
 * 단체 예약 안내 문자)에는 가리지 않은 값을 쓴다 — 이체할 때 예금주를 대조해야 하기 때문이다.
 *
 * ⚠️ 서버 전용이다("use client" 화면이 import 하면 빌드가 깨진다). 브라우저 번들에 싣지 않는다.
 * ⚠️ **같은 값이 발송 코드(sms.ts · smsV2.ts)에도 따로 적혀 있다.** 관리자 개편은 발송 코드를 건드리지 않기로 해서
 *    거기는 그대로 뒀다. 계좌가 바뀌면 bankAccount.ts · 이 파일 · sms.ts · smsV2.ts 네 곳을 같이 고친다.
 *    (발송 코드가 이 파일을 읽게 합치는 일은 대표님 확인을 받고 따로 한다.)
 */
export const BANK_ACCOUNT_PRIVATE = {
  bankName: BANK_ACCOUNT.bankName,
  accountNumber: "3333-05-2843942",
  accountHolder: "김시온",
} as const;

/** 문자에 넣는 한 줄 — '카카오뱅크 3333-05-2843942 (예금주 김시온)'. */
export const BANK_ACCOUNT_LINE = `${BANK_ACCOUNT_PRIVATE.bankName} ${BANK_ACCOUNT_PRIVATE.accountNumber} (예금주 ${BANK_ACCOUNT_PRIVATE.accountHolder})`;
