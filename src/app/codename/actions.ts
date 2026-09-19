"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, checkRateLimit, recordFailure } from "@/lib/loginRateLimit";
import { CODENAME_LENGTH, currentRound } from "./content";
import { HINTS } from "./hints";

/**
 * 코드네임 이벤트 응모 저장.
 *
 * ⚠️ 정답은 브라우저로 내려보내지 않는다. 맞았는지 여부도 응답에 담지 않는다 —
 *    정답을 알려주는 화면이 아니고, 응답만 보면 정답을 맞춰볼 수 있게 된다.
 * ⚠️ 회차는 브라우저가 보낸 값을 쓰지 않고 서버에서 다시 구한다.
 * ⚠️ 중복 판정·연락처 암호화·회차당 한 줄 보장은 전부 DB 함수(submit_codename)에 있다.
 *    여기서 "이미 있나" 를 조회하고 없으면 넣는 식으로 짜면 동시 제출에 두 줄이 생긴다.
 */

export type SubmitResult =
  | { status: "ok"; replaced: boolean }
  | { status: "duplicate"; previousAt: string }
  | { status: "error"; message: string };

export type SubmitInput = {
  nickname: string;
  codename: string;
  phone: string;
  consent: boolean;
  /** 중복 안내를 보고 "이번 것으로 교체" 를 누른 경우에만 true. */
  replace: boolean;
};

const PHONE_RE = /^01\d{8,9}$/;

/**
 * 힌트 한 줄을 내어 준다. 열람 버튼을 누를 때만 호출된다.
 *
 * ⚠️ 힌트 원문을 화면 코드(content.ts)에 두면 잠긴 힌트까지 브라우저 번들에 실려
 *    개발자도구로 전부 읽힌다. 그래서 서버에서 한 줄씩 건네준다.
 * 순서 강제는 화면이 한다 — 버튼을 세 번 누르면 어차피 다 열리는 값이라
 *    서버가 진행도를 들고 있을 이유가 없다. 여기서는 범위만 확인한다.
 */
export async function revealHint(index: number): Promise<string | null> {
  const key = `codename:${await getClientIp()}`;
  if (checkRateLimit(key).blocked) return null;

  if (!Number.isInteger(index) || index < 0 || index >= HINTS.length) {
    recordFailure(key);
    return null;
  }
  return HINTS[index];
}

/**
 * "이 번호로 이미 낸 적 있나" 만 확인한다. 봉인 버튼을 눌렀을 때 중복 안내를
 * 먼저 띄우기 위한 것으로, 아무것도 저장하지 않는다.
 *
 * ⚠️ 기존에 낸 코드네임은 돌려주지 않는다 — 남의 번호를 넣어보는 것만으로
 *    답안을 알아낼 수 있게 된다. 언제 냈는지만 알려준다.
 */
export async function checkExistingCodename(
  phoneInput: string
): Promise<{ exists: boolean; at: string | null }> {
  const key = `codename:${await getClientIp()}`;
  if (checkRateLimit(key).blocked) return { exists: false, at: null };

  const phone = (phoneInput ?? "").replace(/\D/g, "");
  if (!PHONE_RE.test(phone)) {
    recordFailure(key);
    return { exists: false, at: null };
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("codename_exists", {
      p_phone: phone,
      p_round: currentRound().roundNo,
    });

    if (error) {
      // 조회가 실패해도 흐름은 막지 않는다. 저장 단계에서 DB 가 다시 걸러낸다.
      console.error("[codename] 중복 조회 실패", error.message);
      return { exists: false, at: null };
    }

    const result = data as { exists?: boolean; at?: string };
    return { exists: result?.exists === true, at: result?.at ?? null };
  } catch (err) {
    console.error("[codename] 중복 조회 예외", err instanceof Error ? err.message : err);
    return { exists: false, at: null };
  }
}

export async function submitCodename(input: SubmitInput): Promise<SubmitResult> {
  const key = `codename:${await getClientIp()}`;
  const { blocked, retryAfterMs } = checkRateLimit(key);
  if (blocked) {
    const minutes = Math.ceil(retryAfterMs / 60000);
    return { status: "error", message: `요청이 너무 많습니다. ${minutes}분 후 다시 시도해주세요.` };
  }

  const nickname = (input.nickname ?? "").trim();
  const codename = (input.codename ?? "").trim().toUpperCase();
  const phone = (input.phone ?? "").replace(/\D/g, "");

  // 화면에서 이미 막은 값들이다. 여기까지 왔다면 화면을 거치지 않은 요청이므로
  // 실패를 기록해 반복 호출을 막는다.
  const invalid =
    !nickname ||
    nickname.length > 30 ||
    codename.length !== CODENAME_LENGTH ||
    !/^[A-Z]+$/.test(codename) ||
    !PHONE_RE.test(phone) ||
    input.consent !== true;

  if (invalid) {
    recordFailure(key);
    return { status: "error", message: "입력값을 다시 확인해주세요." };
  }

  // 서버 자동 채점. 정답이 설정돼 있지 않으면 null(미채점)로 남긴다.
  const answer = process.env.EVENT_CODENAME_ANSWER?.trim().toUpperCase();
  const isCorrect = answer ? codename === answer : null;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("submit_codename", {
      p_round: currentRound().roundNo,
      p_nickname: nickname,
      p_codename: codename,
      p_phone: phone,
      p_consent: input.consent,
      p_is_correct: isCorrect,
      p_replace: input.replace === true,
    });

    if (error) {
      console.error("[codename] 저장 실패", error.message);
      return { status: "error", message: "전송에 실패했습니다. 잠시 후 다시 시도해주세요." };
    }

    const result = data as { ok?: boolean; status?: string; previous_at?: string };

    if (result?.status === "duplicate") {
      return { status: "duplicate", previousAt: result.previous_at ?? "" };
    }

    if (!result?.ok) {
      console.error("[codename] 저장 거부:", result?.status ?? "unknown");
      return { status: "error", message: "전송에 실패했습니다. 잠시 후 다시 시도해주세요." };
    }

    return { status: "ok", replaced: result.status === "replaced" };
  } catch (err) {
    console.error("[codename] 예외", err instanceof Error ? err.message : err);
    return { status: "error", message: "전송에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }
}
