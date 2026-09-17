---
name: wye-customer-facing
description: 고객이 잘못된 것을 보게 되는 작업. 공개 화면의 이미지를 갈아끼울 때, 화면 문구에 새 기호를 쓸 때 먼저 읽는다. public/ 의 이미지, Supabase theme-assets 버킷, src/components/ 의 화면 문구가 대상. 옛 이미지가 구글 검색에 한 달 넘게 남은 사고와, 화살표가 안드로이드에서 알파벳으로 보인 사고가 있었다.
---

한번 밖으로 나가면 우리 화면에서 지워도 남는다.

## 이 중 하나라도 하면 이 문서를 먼저 읽는다

- `public/` 의 이미지를 바꾸거나 지운다
- Supabase `theme-assets` 버킷에 올린다
- 화면 문구에 `‹ › • − ・ « » –` 같은 기호를 새로 쓴다

---

## ⚠️ 이미지를 갈아끼울 때 (2026-09-15)

**같은 파일명을 재사용하지 말 것.** 새 이름으로 올리고 옛 파일은 지운다.

`public/bar-o-title.png` 는 08-11 에 소개팅 큐피드 아트웍으로 올렸다가 08-13 에
노을 아트웍으로 **같은 이름 그대로** 갈아끼웠다. 구글 이미지는 페이지가 아니라
**이미지 URL 자체를 색인**하기 때문에, 그 URL 에 물린 옛 큐피드 썸네일이 한 달 넘게
검색에 남았다. 사이트에서는 안 보이는데 구글에만 뜨는 상태가 된다.

**그래서:**
- 이미지를 바꿀 땐 파일명도 바꾼다 (Supabase 스토리지 업로드는 이미 타임스탬프 이름을 쓴다)
- 옛 파일은 지워 **404** 로 만든다. 404 가 아니면 구글에서 지울 수 없다
- 지운 뒤 Search Console → 삭제 → 임시로 URL 삭제 로 즉시 요청 (소유 확인된 도메인이면 바로 승인)

⚠️ `theme-assets` 는 **public 버킷**이다. `themes/_original/` 같은 보존용 폴더도
   주소만 알면 누구나 접근된다. 공개돼도 괜찮은 것만 둘 것.

---

## ⚠️ 화면에 새 기호를 쓸 때 (2026-09-15)

본문 글꼴 **SUIT 에는 없는 글자가 꽤 있다.** `‹ › • − ・ « » –` 등. 없는 글자를
만나면 브라우저가 기기 기본 글꼴로 떨어지는데 그게 기기마다 달라서, 실제로 신청 폼
화살표가 어떤 안드로이드에서 **`E` / `e`** 로 보인 사고가 있었다.

**지금은 세 겹으로 막아 뒀다:**
1. UI 화살표는 글자가 아니라 SVG 다 — `src/components/ui/Chevron.tsx`. 화살표를 쓸 땐 이걸 쓸 것.
2. `fonts/WyeSymbols-Variable.woff2` (6KB) 가 SUIT 에 없는 기호를 메운다. 담긴 글자 목록은
   `src/app/(site)/fonts/WyeSymbols-README.md` 참고. 거기 없는 기호를 새로 쓰면 다시 뚫린다.
3. `globals.css` 의 `--font-sans` 에 한글 대체 글꼴을 순서대로 적어 뒀다.

**확인하는 법** — 문구를 많이 고쳤다면 한 번 돌려볼 것:
```bash
python3 -c "
from fontTools.ttLib import TTFont
cm=TTFont('src/app/(site)/fonts/SUIT-Variable.woff2').getBestCmap()
print([c for c in '여기에 확인할 문구' if ord(c)>0x7f and ord(c) not in cm])
"
```
빈 배열이 아니면 그 글자는 SUIT 에 없다. 위 2번 서브셋에 있는지 확인하고, 없으면
서브셋을 다시 만들거나(README 에 방법) 다른 글자로 바꾼다.
