# 공유 카드 그림에 쓰는 파일

`xmasShareImage.tsx` 가 카카오톡 · 인스타 DM 공유 카드(1200×630)를 그릴 때 읽는다.

| 파일 | 무엇 | 어떻게 만들었나 |
|---|---|---|
| `Jua-share.ttf` | 주아(Jua, SIL OFL 1.1) 글꼴에서 **카드에 나오는 글자만** 남긴 것(64자, 26KB) | 아래 명령 |
| `logo-santa.png` | 산타모자 쓴 로고 | `public/logo-white.png` 위에 로고용 모자 원본(로고와 같은 캔버스에 그린 것 — 사이트는 그 모자만 잘라 `public/season/christmas/xmas-santa-hat-logo.webp` 로 쓴다)을 그대로 겹쳐(모자가 로고 위로 솟은 만큼 캔버스가 길다) 높이 176 으로 줄였다 |

## 카드 문구를 고쳤으면 글꼴을 다시 만든다

글꼴에 없는 글자는 그림에 네모로 찍힌다. `scripts/season/build-xmas-share-font.py` 의 `TEXT` 에 새 문구를 더하고:

```bash
npm run dev   # 한 번 띄우면 next/font 가 주아 조각(woff2)을 .next/dev/static/media 에 받아 둔다
python3 scripts/season/build-xmas-share-font.py .next/dev/static/media src/components/xmas-game/share/Jua-share.ttf
```

그림 엔진은 woff2 를 못 읽어서 TTF 로 따로 둔다. 숫자 · `-` · `!` 는 이미 들어 있다.
