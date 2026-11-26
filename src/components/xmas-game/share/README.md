# 공유 카드 그림에 쓰는 파일

`xmasShareImage.tsx` 가 카카오톡 · 인스타 DM 공유 카드(1200×630)를 그릴 때 읽는다.

| 파일 | 무엇 | 어떻게 만들었나 |
|---|---|---|
| `Jua-share.ttf` | 주아(Jua, SIL OFL 1.1) 글꼴에서 **카드에 나오는 글자만** 남긴 것(64자, 26KB) | 아래 명령 |
| `logo-santa.png` | 산타모자 쓴 로고 | `public/logo-white.png` 에 `public/season/christmas/xmas-santa-hat.webp` 를 헤더와 같은 비율(폭 48%, 왼쪽 40%, 위 −26%, 12° 기울임)로 얹어 높이 176px 로 줄였다 |

## 카드 문구를 고쳤으면 글꼴을 다시 만든다

글꼴에 없는 글자는 그림에 네모로 찍힌다. `scripts/season/build-xmas-share-font.py` 의 `TEXT` 에 새 문구를 더하고:

```bash
npm run dev   # 한 번 띄우면 next/font 가 주아 조각(woff2)을 .next/dev/static/media 에 받아 둔다
python3 scripts/season/build-xmas-share-font.py .next/dev/static/media src/components/xmas-game/share/Jua-share.ttf
```

그림 엔진은 woff2 를 못 읽어서 TTF 로 따로 둔다. 숫자 · `-` · `!` 는 이미 들어 있다.
