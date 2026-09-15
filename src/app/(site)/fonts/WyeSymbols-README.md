# WyeSymbols-Variable.woff2

본문 글꼴 **SUIT 에 없는 기호만** 담은 6KB 짜리 보조 글꼴이다.

## 왜 필요한가

SUIT 에는 `‹ › • − ・ « » – … → ✓` 같은 기호가 없다. 없는 글자를 만나면
브라우저가 기기 기본 글꼴로 떨어지는데 그게 기기마다 달라서, 어떤 안드로이드에서는
신청 폼의 화살표가 **'E' / 'e'** 로 보였다(2026-09-15 제보).

화살표처럼 중요한 것은 SVG(`components/ui/Chevron.tsx`)로 그려 글꼴에서 떼어냈지만,
본문에 기호를 쓸 일은 앞으로도 생긴다. 그때마다 폰트 문자표를 대조할 수는 없으므로
**빠진 기호를 메우는 글꼴**을 뒤에 깔아 둔다.

브라우저는 웹폰트를 **실제로 그 글자가 쓰일 때만** 내려받는다. 지금은 쓰이는 기호가
없어서 평소에는 0바이트다.

## 담긴 글자 (30자)

```
‹ › • − ・ ˄ « » – — … ™ → ← ↑ ↓ ✓ ✕ · © ® ° ± × ÷ ≤ ≥ № ♥ ★ ☆
```

## 출처와 이름을 바꾼 이유

Pretendard v1.3.9 (Copyright (c) 2021, Kil Hyung-jin, SIL OFL 1.1) 의 가변 버전에서
위 글자만 추려냈다. SUIT 와 결이 비슷해 섞여도 튀지 않는다.

⚠️ Pretendard 의 OFL 은 **Reserved Font Name** 조항을 달고 있다(`WyeSymbols-OFL.txt` 2행).
   서브셋은 OFL 이 말하는 '수정본' 이므로 원래 이름을 쓸 수 없어 `WYE Symbols` 로 바꿨다.
   원본 라이선스 전문은 같은 폴더의 `WyeSymbols-OFL.txt` 에 함께 둔다(OFL 재배포 조건).

## 다시 만들 때

```python
from fontTools import subset
from fontTools.ttLib import TTFont
CHARS = "‹›•−・˄«»–—…™→←↑↓✓✕·©®°±×÷≤≥№♥★☆"
opts = subset.Options(); opts.flavor="woff2"; opts.layout_features=["*"]
opts.name_IDs=["*"]; opts.notdef_outline=True
f = TTFont("PretendardVariable.woff2")
s = subset.Subsetter(options=opts); s.populate(text=CHARS); s.subset(f)
# name ID 1,3,4,6,16,17… 의 "Pretendard" 를 "WYE Symbols" 로 치환 (ID 6 은 공백 제거)
f.flavor="woff2"; f.save("WyeSymbols-Variable.woff2")
```
