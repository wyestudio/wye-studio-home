---
name: wye-server-cost
description: Vercel 서버 사용량(Fluid Active CPU · 함수 호출)을 쓸데없이 늘리는 코드를 막는다. 공개 페이지(`force-dynamic` 이 붙은 page.tsx), 클라이언트에서 `router.replace` · `router.push` · `router.refresh` · `<Link>` 를 쓸 때, `src/app/api/cron/**`, `opengraph-image.tsx`, `src/proxy.ts`, 외부 스케줄러(cron-job.org · GitHub Actions)에서 부르는 API 를 만들거나 고칠 때 먼저 읽는다. 틀리면 무료 한도를 넘겨 사이트가 통째로 멈추거나 요금이 나간다.
---

서버가 한 번 더 돌 때마다 돈이다. 페이지가 단순해 보여도 **방문 × 클릭 수만큼** 곱해진다.

## 이 중 하나라도 하면 이 문서를 먼저 읽는다

- 공개 페이지(`src/app/(site)/**/page.tsx`)를 만들거나 데이터 읽는 부분을 고친다
- 클라이언트 컴포넌트에서 주소를 바꾼다(`router.replace` · `router.push` · `router.refresh` · `<Link>`)
- `src/app/api/cron/**` 을 만들거나, 외부 스케줄러에 호출을 등록한다
- `opengraph-image.tsx` · `src/proxy.ts` 를 고친다

---

## 화면만 바뀌면 서버를 부르지 않는다

**주소의 검색 파라미터(`?d=` · `?tab=`)만 바꿀 때는 `window.history.replaceState` 를 쓴다.**
`router.replace` · `router.push` 는 `force-dynamic` 페이지 전체를 서버에서 다시 그린다.
Next 는 `history.replaceState` 를 `useSearchParams` 와 맞춰 주고 서버는 부르지 않는다.
← 테마 상세 달력이 날짜 하나 누를 때마다 페이지를 서버에서 다시 그렸다. 광고로 방문이 늘자
  무료 한도(월 CPU 4시간)를 넘겨 2026-10-29 사이트가 멈췄다(`SessionPicker.tsx` 의 `selectDate`)

- 내용이 정말 바뀌어야 할 때(모드 전환처럼 가격표·안내가 달라질 때)만 서버를 부른다
- `router.refresh()` 는 저장 직후 한 번만. **주기적으로 부르지 않는다**(`setInterval` + 서버 호출 금지)
- 확인: `next dev` 로그를 보며 그 동작을 해 본다. `GET /경로?…` 줄이 늘면 서버가 돈 것이다

## 서버 렌더 한 번을 가볍게

- **`Intl.DateTimeFormat` 은 모듈 상수로 한 번만 만든다.** 회차마다 `new` 하면 렌더 한 번에
  수백 개가 생긴다(`src/lib/format.ts` · `SessionPicker.tsx` 가 이 모양이다)
- 같은 목록을 여러 번 돌며 같은 값을 다시 계산하지 않는다. 한 번 만든 Map 을 넘긴다
- DB 를 회차마다 따로 부르지 않는다. 한 번에 읽고 코드에서 나눈다
- 화면이 안 쓰는 지난 데이터까지 읽지 않는다(기간을 건다)

## 움직이는 화면은 서버와 상관없다

애니메이션 · 마스코트 · 「이렇게 플레이해요」 같은 클라이언트 동작은 **손님 브라우저**에서 돈다.
서버 CPU 를 쓰지 않으니 이 이유로 줄이지 않는다. 다만 그 안에서 **서버를 부르면**(fetch ·
server action · router) 위 규칙이 그대로 적용된다.

## cron · 외부 스케줄러

- 할 일이 없으면 **DB 를 읽기 전에** 바로 끝낸다(새벽 쉬는 시간처럼)
- 호출 주기는 실제로 필요한 만큼만. 15분이면 한 달 2,900번이다 — 한 번이 가벼워도 쌓인다
- 같은 작업을 두 곳(cron-job.org · GitHub Actions)에 중복 등록하지 않는다. 등록할 때 다른 곳을 확인한다
- 호출이 실패해도 무한히 다시 부르지 않는다(재시도 횟수 · 간격을 둔다)

## 사용량은 숫자로 확인한다

- Vercel → wye-studio-home → **Observability → Functions**: 경로별 호출 수 · Active CPU
- 팀 한도: **Usage → Fluid Active CPU**. 운영 · 테스트 프로젝트가 **같은 팀 한도를 나눠 쓴다**
- 큰 변경을 올렸으면 하루이틀 뒤 같은 화면에서 그 경로의 호출 수 · CPU 를 전과 비교한다
- Spend Management 예산은 **$1 · Pause Off** 다(알림용). Pause 를 켜면 한도에서 사이트가 멈춘다
