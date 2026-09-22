---
name: wye-cleanup
description: 운영에 남은 기록을 지우는 작업. 슬랙 알림 메시지를 지울 때, 운영에서 테스트한 신청 건의 흔적을 치울 때 먼저 읽는다. scripts/slack-cleanup-alerts.mjs 실행이 대상이며, "테스트한 거 정리해줘" · "이 알림 지워줘" · "테스트 신청 치워줘" 같은 요청이 트리거다. 잘못 지우면 진짜 고객의 신청 기록이 사라지고 되돌릴 수 없다.
---

지운 것은 돌아오지 않는다. 여기서 실수하면 **진짜 손님의 신청 기록**이 사라진다.

## 항상 이 순서로. 건너뛰지 않는다

1. **dry-run** — 옵션 없이 실행해 목록을 뽑는다
2. **목록을 눈으로 확인** — 지우면 안 될 게 섞였는지 본다. 건수만 보고 넘어가지 않는다
3. **`--apply --limit 1`** — 1건만 지워 실제로 되는지 본다
4. **`--apply`** — 나머지 전체

3번을 건너뛰지 않는다. "문서상 된다" 와 "이 워크스페이스에서 된다" 는 다르다.

## 슬랙 알림 지우기

```bash
cd ~/workspace/wye-studio-home
echo -n "토큰: "; read -rs SLACK_USER_TOKEN; echo; export SLACK_USER_TOKEN

node scripts/slack-cleanup-alerts.mjs --code 123456              # 1. dry-run
node scripts/slack-cleanup-alerts.mjs --code 123456 --apply --limit 1
node scripts/slack-cleanup-alerts.mjs --code 123456 --apply      # 4. 전체
```

**테스트 건은 `--code <접수번호>` 로 고른다.** 접수번호는 새신청 알림과 미입금 알림
양쪽 본문에 들어가므로, 그 한 건의 알림을 전부·그것만 고를 수 있다
← 본문 문구로 고르면 진짜 손님 신청까지 걸린다.

셀렉터를 안 주면 **미입금 알림만** 대상이 된다. 그게 기본값이다.
`--after` · `--before` 로 시각 범위를, `--channel` 로 다른 채널을 지정한다.

### 토큰은 `WYE Cleanup` 앱에서 꺼낸다

이 워크스페이스에 청소 전용 앱 **`WYE Cleanup`** 이 이미 있다.
api.slack.com/apps → WYE Cleanup → OAuth & Permissions → **User OAuth Token**(`xoxp-`).

- **새로 만들지 않는다.** Slack 은 앱 생성에 속도 제한을 걸어서 한 번 막히면 수십 분 기다린다
- **`Wouldyouescape Notify` 앱은 건드리지 않는다.** 운영 알림 웹훅 4개가 거기 붙어 있고,
  재설치하면 기존 웹훅이 무효화될 수 있다 ← 신청·환불 알림이 조용히 끊긴다
- **토큰을 파일에 저장하지 않는다.** 계정 권한으로 슬랙을 읽고 쓴다. `read -rs` 로 넣고
  터미널을 닫으면 사라지게 둔다

### 봇 토큰으로는 못 지운다 (헤매지 말 것)

알림은 Incoming Webhook 으로 보낸다. `chat.delete` 는 봇 토큰이면 "그 봇이 직접 보낸"
메시지만 지울 수 있는데, **웹훅 메시지는 소유자가 봇이 아니라 웹훅이다.**
Owner/Admin 계정의 **user token(`xoxp-`)** 만 지운다.
근거: https://docs.slack.dev/reference/methods/chat.delete

### 옮기는 기능은 없다

Slack 에는 메시지를 다른 채널로 **이동하는 기능이 없다.** 새 채널에 다시 써넣고
원본을 지우는 복제뿐이고, 그러면 시각과 작성자가 바뀐다. 요청받으면 이 사실을 먼저 말한다.

## 운영 DB 의 테스트 신청을 지울 때

절차가 아직 정립돼 있지 않다. **임의로 `delete` 하지 않는다.**
`wye-db-release` 를 먼저 읽고, 지우기 전에 사용자에게 확인받는다.
