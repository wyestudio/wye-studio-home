/**
 * 인스타 게시물 주소에서 올린 날짜를 읽는다.
 *
 * 주소 끝의 코드(`/p/DcoJeDdGG43/`)는 게시물 ID 를 64진수로 적은 것이고, 그 ID 의
 * 윗자리가 **올린 시각(밀리초)** 이다. API 나 로그인 없이 날짜를 알 수 있다.
 * 어드민에서 주소만 붙여넣은 인스타 후기는 날짜가 비어 있어, 이게 없으면 최신순
 * 정렬에서 늘 맨 뒤로 밀린다.
 *
 * 2026-10-16 에 날짜를 아는 게시물 4개로 대조해 하루도 어긋나지 않음을 확인했다.
 * 인스타가 ID 체계를 바꾸면 틀릴 수 있으므로, 날짜가 적혀 있으면 그쪽을 먼저 쓴다.
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/** 인스타 ID 의 기준 시각(2011-08-24). ID 윗자리는 이 시각부터 흐른 밀리초다. */
const EPOCH_MS = 1314220021721;

/** "2026.08.29" (한국 시간). 인스타 주소가 아니거나 읽을 수 없으면 null. */
export function instagramPostedDate(url: string): string | null {
  const code = url.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1];
  // 11자를 넘는 코드는 비공개 공유용 꼬리가 붙은 것이다. 앞 11자가 ID 다.
  if (!code || code.length < 11) return null;

  let id = BigInt(0);
  for (const ch of code.slice(0, 11)) {
    const v = ALPHABET.indexOf(ch);
    if (v === -1) return null;
    id = id * BigInt(64) + BigInt(v);
  }
  const ms = Number(id >> BigInt(23)) + EPOCH_MS;
  // 2015년 이전이나 미래면 해석이 틀린 것이다.
  if (ms < Date.UTC(2015, 0, 1) || ms > Date.now() + 86400_000) return null;

  const kst = new Date(ms + 9 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${kst.getUTCFullYear()}.${p(kst.getUTCMonth() + 1)}.${p(kst.getUTCDate())}`;
}
