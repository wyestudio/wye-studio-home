# 단체 예약(/group) 기본 구성 칸의 도트 아이콘을 만든다. 16x16 격자를 직접 찍는다.
# 바-ㅇ탈출 캐릭터처럼 여러 색이 든 도트 그림이 필요했는데 맞는 공개 세트가 없어 직접 그렸다(2026-10-26).
# 실행: python3 scripts/group-pixel-icons.py public/group/pixel
# 글자 하나가 한 칸이다. "." 은 빈칸, 나머지는 PAL 의 색.
import sys,os
out=sys.argv[1]
PAL={'K':'#252231','P':'#f082f4','p':'#c45fc9','Y':'#fbcf4a','y':'#d4930f','W':'#ffffff','C':'#f0e7d8',
     'B':'#845835','b':'#c9925a','Q':'#a78bfa','q':'#7c5fd6','G':'#b6b4ca','g':'#6b6880','L':'#6cc5bd','l':'#3f8f88',
     'R':'#e85d75','M':'#6cc5bd'}
ICONS={
'hourglass':[
"................",
"..KKKKKKKKKKKK..",
"..KbbbbbbbbbbK..",
"..KKKKKKKKKKKK..",
"...KCCCCCCCCK...",
"...KCYYYYYYCK...",
"....KCYYYYCK....",
".....KCYYCK.....",
"......KYYK......",
".....KCCYCK.....",
"....KCCCYCCK....",
"...KCCCYYYCCK...",
"...KYYYYYYYYK...",
"..KKKKKKKKKKKK..",
"..KbbbbbbbbbbK..",
"..KKKKKKKKKKKK.."],
'party-popper':[
"................",
"...........Y....",
"..M.....P.....M.",
".......Y...P....",
"..........Y.....",
"......KKK....P..",
".....KPPYK......",
"....KYPPYYK..Y..",
"....KYYPPYK.....",
"...KPYYPPK......",
"...KPPYYK...M...",
"..KYPPYK........",
"..KYYPK.........",
".KPYKK..........",
".KKK............",
"................"],
'drink':[
"..........KK....",
".........KRK....",
"........KRK.....",
"...KKKKKRKKKK...",
"..KWWWWWRWWWWK..",
"..KKKKKKRKKKKK..",
"...KPPPPRPPPK...",
"...KPWPPPPPPK...",
"...KPWPPPPPPK...",
"....KPWPPPPK....",
"....KPPPPPPK....",
"....KPgPgPPK....",
"....KgPgPgPK....",
".....KppppK.....",
".....KKKKKK.....",
"................"],
'gift':[
"................",
"....KK....KK....",
"...KYYK..KYYK...",
"...KYYYKKYYYK...",
"....KKYYYYKK....",
".KKKKKKYYKKKKKK.",
".KPPPPPYYPPPPPK.",
".KPPPPPYYPPPPPK.",
".KKKKKKYYKKKKKK.",
"..KQQQQYYQQQQK..",
"..KQQQQYYQQQQK..",
"..KQQQQYYQQQQK..",
"..KQQQQYYQQQQK..",
"..KqqqqyyqqqqK..",
"..KKKKKKKKKKKK..",
"................"],
'camera':[
"................",
"................",
".....KKKK.......",
"....KggggK..KK..",
".KKKKKKKKKKKKKK.",
".KPPPPPPPPPPRPK.",
".KPPPKKKKKPPPPK.",
".KPPKLLLLLKPPPK.",
".KPKLLWLLLlKPPK.",
".KPKLWLLLLlKPPK.",
".KPKLLLLLllKPPK.",
".KPPKlllllKPPPK.",
".KppppKKKKKpppK.",
".KKKKKKKKKKKKKK.",
"................",
"................"],
'mic':[
"................",
".....KKKKKK.....",
"....KGGGGGGK....",
"...KGWGGGGGgK...",
"...KGWGGGGGgK...",
"...KGGGGGGggK...",
"....KGGGGggK....",
"....KKKKKKKK....",
"....KPPPPPpK....",
".....KPPPpK.....",
"......KggK......",
"......KggK......",
"......KggK......",
"......KggK......",
".......KK.......",
"................"],
}
for name,rows in ICONS.items():
    assert len(rows)==16,(name,len(rows))
    rects=[]
    for y,r in enumerate(rows):
        assert len(r)==16,(name,y,len(r),r)
        x=0
        while x<16:
            c=r[x]
            if c=='.': x+=1; continue
            x0=x
            while x<16 and r[x]==c: x+=1
            rects.append(f'<rect x="{x0}" y="{y}" width="{x-x0}" height="1" fill="{PAL[c]}"/>')
    open(os.path.join(out,name+'.svg'),'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">{"".join(rects)}</svg>\n')
print('ok')
