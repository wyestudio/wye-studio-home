import "server-only";
import { createSign } from "node:crypto";

/**
 * 구글 시트 읽기 (서비스 계정).
 *
 * 왜 `googleapis` 패키지를 쓰지 않는가
 *   그 패키지는 구글 전 서비스를 담고 있어 수십 MB 다. 우리는 **시트 한 장을
 *   읽기만** 한다. JWT 를 직접 만들어 토큰을 받으면 의존성 없이 끝난다.
 *   (GA4 는 이미 `@google-analytics/data` 를 쓰지만 그건 Sheets 를 못 읽는다.)
 *
 * ⚠️ `server-only`. 서비스 계정 개인키가 여기 들어온다.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function serviceAccount(): { email: string; key: string } | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // ⚠️ Vercel 환경변수에 PEM 을 넣으면 개행이 "\n" 두 글자로 들어오는 경우가 있다.
  //    되돌리지 않으면 서명이 "DECODER routines::unsupported" 로 터진다 (ga4.ts 와 같은 함정).
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) return null;
  return { email, key };
}

/** 서비스 계정 JWT → 액세스 토큰. 토큰은 1시간짜리라 호출할 때마다 새로 받는다. */
async function accessToken(): Promise<string> {
  const sa = serviceAccount();
  if (!sa) throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL / _PRIVATE_KEY 가 없습니다.");

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: sa.email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = base64url(signer.sign(sa.key));
  const jwt = `${header}.${claim}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `토큰 발급 실패 (HTTP ${res.status})`);
  }
  return json.access_token;
}

/**
 * 시트 한 장을 2차원 배열로 읽는다. 첫 줄이 머리글이다.
 *
 * ⚠️ 시트를 **서비스 계정 이메일에 공유**해 둬야 한다. 안 하면 403 이 온다 —
 *    "비공개라 못 읽는다" 는 뜻이지 키가 틀린 게 아니다.
 */
export async function readSheet(spreadsheetId: string, range: string): Promise<string[][]> {
  const token = await accessToken();
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
    `/values/${encodeURIComponent(range)}?majorDimension=ROWS`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });

  const json = (await res.json().catch(() => ({}))) as {
    values?: string[][];
    error?: { message?: string; status?: string };
  };

  if (!res.ok) {
    const msg = json.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 403) {
      throw new Error(
        `${msg} — 시트를 서비스 계정(${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL})에 공유했는지 확인하세요.`
      );
    }
    throw new Error(msg);
  }

  return json.values ?? [];
}

/**
 * 구글 폼/시트 주소에서 시트 ID 만 뽑는다.
 * `https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0` → `<ID>`
 */
export function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  const m = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  // 이미 ID 만 넣은 경우.
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}
