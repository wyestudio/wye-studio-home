# 인스타 댓글 이벤트 쿠폰 자동 발급 — 운영 안내서

작성: 2026-09-16 · 대상 캠페인 키 `instagram_grand_open_202609`

---

## 1. 무엇이 자동이고 무엇이 아닌가

| 단계 | 자동? | 비고 |
|---|---|---|
| 이벤트 게시물에 댓글이 달리면 감지 | ✅ | ManyChat 댓글 트리거 |
| 댓글 단 사람에게 DM 발송 | ✅ | |
| **팔로우 여부 확인** | ✅ | ManyChat 「Follows your account」 조건 |
| **좋아요 여부 확인** | ❌ **불가능** | 인스타(메타)가 "누가 좋아요를 눌렀는지"를 외부 도구에 공개하지 않는다. ManyChat 문제가 아니라 플랫폼 제약이라 어떤 도구로도 안 된다. 안내문에는 조건으로 적되 검증은 하지 않는다. |
| 사람마다 다른 쿠폰 코드를 DM | ⚠️ | ManyChat **Pro** 전용 기능(External Request)이 필요 |

**Pro 무료체험은 14일.** 이벤트가 그보다 길면 중간에 자동 발급만 멈춘다 —
ManyChat 은 계속 DM 을 보내는데 코드만 비어서 나간다. 아래 4번을 반드시 설정할 것.

## 2. 발급 API

```http
POST https://www.wouldyouescape.com/api/coupons/instagram/claim
Authorization: Bearer {MANYCHAT_WEBHOOK_SECRET}
Content-Type: application/json

{ "instagram_username": "someone", "campaign_key": "instagram_grand_open_202609" }
```

응답:

| 상황 | HTTP | 본문 |
|---|---|---|
| 신규 발급 | 200 | `{"success":true,"coupon_code":"E01Y-07TY","already_issued":false}` |
| 이미 받아간 계정 | 200 | `{"success":true,"coupon_code":"E01Y-07TY","already_issued":true}` |
| 소진·기간종료·중지 | **200** | `{"success":false,"reason":"SOLD_OUT_OR_ENDED"}` |
| 아이디 비었음 | 400 | `{"success":false,"reason":"INVALID_REQUEST"}` |
| 키 없음/틀림 | 401 | `{"success":false,"reason":"UNAUTHORIZED"}` |

⚠️ 소진·종료를 **200 으로** 돌려준다. 4xx 로 주면 ManyChat 이 오류로 처리해
안내 DM 분기를 태울 수 없다.

**보장되는 것**
- 아이디는 `@` 제거 + 소문자로 정규화 (`@User_One` = `user_one`)
- 계정당 1장 — DB 유니크 제약으로 강제. 동시 요청 두 건도 두 장이 안 나간다
- 같은 계정이 다시 요청하면 새 코드를 만들지 않고 **그때 준 코드**를 돌려준다
- 코드는 `for update skip locked` 로 한 장씩 잠가 배정 — 같은 코드가 두 명에게 안 간다

## 3. ManyChat 설정 (대표님이 직접)

> Pro 플랜에서만 4-6번이 가능하다.

1. **Automation → New Automation → Instagram → Comments**
   - 대상 게시물: 이벤트 게시물 선택
   - 키워드: **전체 댓글**(특정 키워드 없음)
   - 같은 사람에게 반복 실행되지 않도록 「Only first time」 류 옵션을 켠다
2. **첫 DM** — 본문은 아래 6번 문구 참고, 버튼 `쿠폰 받기`
3. `쿠폰 받기` 클릭 → **Condition** 블록 → `Follows your account` **is true**
   - false 가지 → 미팔로우 안내 DM + 버튼 `팔로우 완료` → 다시 이 Condition 으로
4. true 가지 → **Actions → External Request**
   - Method `POST`
   - URL `https://www.wouldyouescape.com/api/coupons/instagram/claim`
   - Headers `Authorization: Bearer <비밀키>`, `Content-Type: application/json`
   - Body `{"instagram_username":"{{ig_username}}","campaign_key":"instagram_grand_open_202609"}`
   - Response mapping: `$.coupon_code` → 사용자 필드 `coupon_code`
     `$.success` → 사용자 필드 `claim_success`
5. **Condition** → `claim_success` is `true`
   - true → 쿠폰 발급 성공 DM (`{{coupon_code}}` 삽입)
   - false → 종료·소진 안내 DM
6. ⚠️ **`coupon_code` 가 비었을 때의 가지를 반드시 만든다.**
   체험이 끝나거나 서버가 응답하지 않으면 코드가 비어서 *"쿠폰 코드: (빈칸)"* 인 DM 이
   나간다. `coupon_code` is not set → "잠시 후 안내드릴게요" 로 빠지게 한다.

## 4. 체험 만료 후 — 수동 발급

**어드민 → 쿠폰 → 인스타 댓글 이벤트 → `코드` → 「인스타 아이디로 발급」**

아이디를 넣고 누르면 코드가 나온다. 그 코드를 DM 으로 붙여넣으면 된다.

⚠️ 자동 발급과 **같은 함수**를 쓴다. 이미 자동으로 받아간 계정이면
「이미 받아간 계정 — 같은 코드」 라고 알려주고 새 코드를 만들지 않는다.
따로 명단을 관리할 필요가 없다.

## 5. 이벤트를 끝낼 때

잔여석이 마감되면 **어드민 → 쿠폰 → 인스타 댓글 이벤트 → 수정 → 「사용 가능」 끄기**.
그 순간부터 API 가 `SOLD_OUT_OR_ENDED` 를 돌려주고 ManyChat 이 종료 안내로 분기한다.
이미 발급된 코드는 유효기간(10/4)까지 그대로 쓸 수 있다.

## 6. 롤백

- **자동 발급만 끄기**: 캠페인 「사용 가능」 끄기 (코드는 살아 있음)
- **API 만 막기**: Vercel 에서 `MANYCHAT_WEBHOOK_SECRET` 삭제 → 전부 500
- **기능 자체 되돌리기**:
  ```sql
  drop function if exists public.assign_coupon_to_handle(text, text);
  drop index if exists public.coupons_campaign_handle_uidx;
  alter table public.coupons drop column if exists issued_to_handle;
  -- coupon_campaigns.key 는 다른 연동이 쓸 수 있으니 남겨도 무방
  ```
  ⚠️ `issued_to_handle` 을 지우면 **누가 어느 코드를 받아갔는지 기록이 사라진다.**
  지우기 전에 CSV 로 내려받아 둘 것.

## 7. 배포 후 확인 목록

- [ ] `MANYCHAT_WEBHOOK_SECRET` 이 테스트·운영 양쪽에 있고 **재배포까지 끝났는지**
      (틀린 키로 호출했을 때 401 이면 적용됨, 500 `SERVER_NOT_CONFIGURED` 면 미적용)
- [ ] 캠페인에 `key = instagram_grand_open_202609` 가 박혀 있는지
- [ ] 코드가 충분히 발급돼 있는지 (현재 300장)
- [ ] 본인 인스타 계정으로 댓글 → DM → 쿠폰 수신까지 1회 실전 확인
- [ ] 같은 계정으로 한 번 더 요청해 **같은 코드**가 오는지
- [ ] 받은 코드로 예약 페이지에서 5,000원 할인이 붙는지
- [ ] 잼핏 쿠폰과 함께 넣어 6,000원(1인 기준)이 되는지
