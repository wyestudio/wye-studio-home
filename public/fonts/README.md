# public/fonts — 보드판 사진 페이지(/photo) 전용 도트 글꼴

갈무리11(SIL OFL)을 **이 페이지에 나오는 글자만 남겨** 잘라 둔 것이다.

| 파일 | 원본 | 지금 |
|---|---|---|
| `Galmuri11.woff2` (400) | 504,736 | **4,612** |
| `Galmuri11-Bold.woff2` (700) | 166,584 | **3,708** |

왜 자르는가 — 이 화면은 방탈출을 막 끝낸 참가자가 **QR 을 찍어 휴대폰 데이터로**
여는 자리다. 글꼴 671KB 를 받게 할 이유가 없다. 같은 이유로 `WyeSymbols` 도
잘라 뒀다(`src/app/(site)/fonts/WyeSymbols-README.md`).

## ⚠️ 문구를 고치면 글꼴도 다시 잘라야 한다

잘라낸 글자만 들어 있어서, **새 글자를 쓰면 그 글자만 시스템 글꼴로 떨어진다.**
한 줄 안에서 글꼴이 섞여 보인다.

`/photo` 의 문구(`page.tsx` · `PhotoView.tsx`)를 고쳤다면 이렇게 다시 만든다.

```bash
# 1) 빠진 글자가 있는지 먼저 확인
python3 - <<'PY'
import re
from fontTools.ttLib import TTFont
text = ''
for p in ['src/app/photo/[...key]/page.tsx', 'src/app/photo/[...key]/PhotoView.tsx']:
    s = open(p, encoding='utf-8').read()
    s = re.sub(r'/\*[\s\S]*?\*/', '', s)
    s = re.sub(r'^\s*//.*$', '', s, flags=re.M)
    s = re.sub(r'const PAGE_STYLES[\s\S]*$', '', s)   # CSS 는 화면 글자가 아니다
    text += s
need = {c for c in text if ord(c) > 0x7f}
for f in ['public/fonts/Galmuri11.woff2', 'public/fonts/Galmuri11-Bold.woff2']:
    cm = TTFont(f).getBestCmap()
    print(f, sorted(c for c in need if ord(c) not in cm) or '빠진 글자 없음')
PY

# 2) 빠진 글자가 있으면 원본에서 다시 자른다.
#    원본은 저장소에 없다 — https://github.com/quiple/galmuri 에서 받는다.
python3 -m fontTools.subset <원본>/Galmuri11.woff2 \
  --text="$(cat 화면에_나오는_글자_전부)" --flavor=woff2 --layout-features='*' \
  --output-file=public/fonts/Galmuri11.woff2
```

## 쓰는 곳

`src/app/photo/[...key]/page.tsx` 의 `PAGE_STYLES` 안 `@font-face` 두 개뿐이다.
사이트 본체(`(site)`)는 `next/font` 로 따로 불러온다
(`src/app/(site)/fonts/Galmuri11-Bold.woff2`) — **이 파일들과 섞어 쓰지 말 것.**
저쪽은 전체 글자가 들어 있고 이쪽은 잘려 있다.
