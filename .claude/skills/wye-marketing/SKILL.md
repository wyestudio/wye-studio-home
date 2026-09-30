---
name: wye-marketing
description: 유입 측정이 어긋나면 어느 홍보가 먹혔는지 알 수 없게 되는 작업. UTM 링크·짧은 주소·리다이렉트·GA4 집계를 건드릴 때 먼저 읽는다. src/lib/attribution.ts, src/lib/attributionServer.ts, src/lib/utmLinks.ts, src/lib/shortLinks.ts, src/lib/ga4.ts, src/lib/analytics.ts, src/app/(site)/admin/utm/, src/app/(site)/go/, next.config.ts 의 redirects(), GTM 컨테이너의 트리거·태그가 대상.
---

링크에 붙은 값이 한 글자만 틀려도 그 유입은 별개 채널로 집계되어 통계에서 사라진다.

## 이 중 하나라도 건드리면 이 문서를 먼저 읽는다

- `src/lib/attribution.ts`, `src/lib/attributionServer.ts`
- `src/lib/utmLinks.ts`, `src/lib/shortLinks.ts`, `src/lib/ga4.ts`, `src/lib/analytics.ts`
- GTM 컨테이너(`GTM-K5MMSPTV`)의 트리거·태그
- `src/app/(site)/admin/utm/`, `src/app/(site)/go/`, `src/app/(site)/open-event/`
- `next.config.ts` 의 `redirects()`

---

## ⚠️ GTM 트리거는 GA4 와 Meta 가 나눠 쓴다

- **트리거를 고치기 전에 "이 트리거를 참조한 항목" 을 먼저 본다** ← `CE - 신청 시작`·
  `CE - 신청 완료` 에 GA4 태그와 Meta Pixel 태그가 함께 걸려 있어, 한쪽만 보고 고치면
  광고 전환 추적이 조용히 깨진다(Meta 는 에러를 안 낸다)
- **코드가 push 하는 이벤트 이름과 트리거의 이벤트 이름을 코드포인트로 대조한다**
  ← 한 글자만 달라도 에러 없이 안 잡힌다. 구성 전체는 `ANALYTICS.md`

---

**파라미터 값 규칙은 컨플루언스 WYE-89** 「SNS 채널별 UTM 파라미터 설정 및 유입 추적 검증」에 있다.
값을 바꿀 일이 생기면 **문서를 먼저 고치고** 코드를 맞춘다 — 거꾸로 하면 잼핏·오방 같은
외부에 이미 전달한 링크와 어긋난다.

---

## ⚠️ 새 채널의 값을 정할 때 (2026-09-21)

**매체(`utm_medium`)는 GA4 버킷이 아니라 채널 성격으로 먼저 고른다.** 수수료를 주면
`affiliate`, 돈 내고 배너·공지를 걸면 `display`, 대가 없는 커뮤니티 노출이면 `social`,
SNS 가 아닌 등재 채널이면 `referral` 이다 ← 분류가 예쁘게 나오는 값을 먼저 집으면
성격이 다른 제휴가 한 버킷에 섞여, 나중에 어느 쪽이 먹혔는지 못 가른다.
**사용자가 값을 지정해 줬더라도 성격부터 되묻는다.**

**전달 방식은 매체가 아니라 `utm_content` 에 담는다.** DM·공지·배너처럼 "어떻게
보냈나" 는 진입 지점이지 유입 유형이 아니다. 예: `somoim` / `social` / `dm`.

**WYE-89 1.1 의 다섯 값(`social`·`paid_social`·`referral`·`affiliate`·`display`) 밖으로
나가지 않는다.** 밖의 값은 GA4 기본 채널 그룹이 어느 규칙에도 못 붙여 **미분류
(Unassigned)** 로 빠진다. 소스만으로는 못 구한다 — 소스가 GA4 의 소셜 사이트 목록에
있어야 구제되는데 `somoim`·`openkakao`·`daangn` 은 그 목록에 없다. `utm_links` 표의
`utm_links_medium_rule` 제약도 같은 이유로 막는다.

---

## ⚠️ 유입경로(utm)를 건드릴 때 (2026-09-15)

**첫 유입만 기록한다(first-touch).** 잼핏 → 홈 → 컨텐츠 → 테마 상세 → 신청폼으로
넘어가는 동안 주소창의 utm 은 사라진다. 신청 시점에 주소를 읽으면 **전부 '직접 방문'
으로 잡힌다.** 그래서 처음 도착한 순간 `sessionStorage` 에 한 번만 저장하고
(`src/lib/attribution.ts`), 신청할 때 그 값을 꺼내 쓴다.

**`submit_application*()` 에 파라미터를 더하지 않는다.** 신청이 성공한 **뒤**
`recordAttribution()`(`src/lib/attributionServer.ts`)이 따로 UPDATE 한다.
2026-08-14 에 그 함수의 시그니처를 잘못 건드려 서비스가 마비된 적이 있다 —
분석용 값 때문에 신청 경로를 다시 흔들 이유가 없다.

**실패해도 신청은 그대로 간다.** 유입경로 기록은 전부 try/catch 로 감싸고 로그만
남긴다. 값이 전부 비면 아무것도 쓰지 않는다 — **빈 칸이 곧 '직접 방문'** 이다.

**외부 링크에는 `?utm_source=...` 를 붙여야 한다.** 안 붙이면 referrer 호스트로만
잡히고, 그마저 없으면 '직접 방문' 이 된다.
