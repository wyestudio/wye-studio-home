---
name: wye-marketing
description: 유입 측정이 어긋나면 어느 홍보가 먹혔는지 알 수 없게 되는 작업. UTM 링크·짧은 주소·리다이렉트·GA4 집계를 건드릴 때 먼저 읽는다. src/lib/attribution.ts, src/lib/attributionServer.ts, src/lib/utmLinks.ts, src/lib/shortLinks.ts, src/lib/ga4.ts, src/app/(site)/admin/utm/, src/app/(site)/go/, next.config.ts 의 redirects() 가 대상.
---

링크에 붙은 값이 한 글자만 틀려도 그 유입은 별개 채널로 집계되어 통계에서 사라진다.

## 이 중 하나라도 건드리면 이 문서를 먼저 읽는다

- `src/lib/attribution.ts`, `src/lib/attributionServer.ts`
- `src/lib/utmLinks.ts`, `src/lib/shortLinks.ts`, `src/lib/ga4.ts`
- `src/app/(site)/admin/utm/`, `src/app/(site)/go/`, `src/app/(site)/open-event/`
- `next.config.ts` 의 `redirects()`

**파라미터 값 규칙은 컨플루언스 WYE-89** 「SNS 채널별 UTM 파라미터 설정 및 유입 추적 검증」에 있다.
값을 바꿀 일이 생기면 **문서를 먼저 고치고** 코드를 맞춘다 — 거꾸로 하면 잼핏·오방 같은
외부에 이미 전달한 링크와 어긋난다.

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

**신청 폼이 두 개다.** 새 폼(`/themes/[slug]/apply`)만 고치면 집계가 반쪽이 된다.
옛 폼(`/sessions/[slug]/apply`)도 회차 상세 CTA 와 SMS 재신청 링크로 아직
들어올 수 있어서 양쪽 다 남겨야 한다.

**실패해도 신청은 그대로 간다.** 유입경로 기록은 전부 try/catch 로 감싸고 로그만
남긴다. 값이 전부 비면 아무것도 쓰지 않는다 — **빈 칸이 곧 '직접 방문'** 이다.

**외부 링크에는 `?utm_source=...` 를 붙여야 한다.** 안 붙이면 referrer 호스트로만
잡히고, 그마저 없으면 '직접 방문' 이 된다.
