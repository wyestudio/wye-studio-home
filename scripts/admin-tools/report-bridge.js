
/* wye-bridge:start — 관리자 화면에서 값을 받고, 고친 내용을 돌려주는 부분(우주이스케이프 관리자 개편 6단계).
   디자인은 건드리지 않는다. 이 블록은 scripts/admin-tools/patch-play-report.mjs 가 넣는다.

   관리자 화면(부모 창)과 주고받는 메시지
     ← wye-report-fill       { docId, saved?, fill: { texts, games, teams: [{ name, members, comment }] } }
                             saved 가 있으면 그것으로 이어서, 없으면 fill 로 새로 채운다
     ← wye-report-teams      { teams } 팀 편성만 다시 가져온다(점수 · 상 이름은 자리대로 둔다)
     ← wye-report-get-state  고친 내용을 달라
     → wye-report-ready      받을 준비가 됐다
     → wye-report-loaded     { teams } 채웠다
     → wye-report-state      { state } 사진을 뺀 내용(글자 · 팀 · 점수 · 꾸밈)
   사진은 주고받지 않는다 — 사진은 이 화면 안에만 있고, [HTML 저장] · [PDF / 인쇄] 로 보관한다.
   파일을 그냥 열면(부모 창이 없으면) 이 블록은 아무것도 하지 않는다. */
(function(){
  if(window.parent===window) return;
  var parentOrigin='*';
  var str=function(v,max){ return Array.from(String(v==null?'':v)).slice(0,max).join(''); };
  function toTeam(t){ return {name:str(t&&t.name,40)||'팀', members:str(t&&t.members,300), award:str(t&&t.award,60), comment:str(t&&t.comment,120)}; }
  function fixScores(s){
    s.scores=s.teams.map(function(_,i){ var row=Array.isArray(s.scores&&s.scores[i])?s.scores[i]:[]; return s.games.map(function(_,j){ return str(row[j]==null?'0':row[j],12); }); });
  }
  function fill(data){
    var f=data.fill||{}, saved=data.saved&&typeof data.saved==='object'?data.saved:null;
    var next=clone(DEFAULT);
    next.texts={}; next.photos={};
    if(saved){
      ['theme','pri','perPage','photoPages','sbSort'].forEach(function(k){ if(saved[k]!=null) next[k]=saved[k]; });
      next.texts=Object.assign({},saved.texts||{});
      if(Array.isArray(saved.games)&&saved.games.length) next.games=saved.games.slice(0,MAX_GAMES).map(function(g){ return {name:str(g&&g.name,40)}; });
      next.teams=(Array.isArray(saved.teams)?saved.teams:[]).slice(0,MAX_TEAMS).map(toTeam);
      next.scores=saved.scores;
    }else{
      next.texts=Object.assign({},f.texts||{});
      if(Array.isArray(f.games)&&f.games.length) next.games=f.games.slice(0,MAX_GAMES).map(function(g){ return {name:str(g&&g.name,40)}; });
      next.teams=(Array.isArray(f.teams)?f.teams:[]).slice(0,MAX_TEAMS).map(toTeam);
      next.scores=[];
    }
    if(!next.teams.length) next.teams=[toTeam({name:'1팀'})];
    fixScores(next);
    next.docId=str(data.docId||'wye',60); next.ts=Date.now();
    state=next; render();
    return state.teams.length;
  }
  function setTeams(list){
    var teams=(Array.isArray(list)?list:[]).slice(0,MAX_TEAMS).map(function(t,i){ var cur=state.teams[i]||{}, n=toTeam(t); n.award=cur.award||''; if(cur.photo) n.photo=cur.photo; return n; });
    if(!teams.length) return state.teams.length;
    state.teams=teams; fixScores(state); state.ts=Date.now(); render();
    return state.teams.length;
  }
  function exportState(){
    if(document.activeElement&&document.activeElement.blur) document.activeElement.blur();
    var c=clone(state); c.photos={}; (c.teams||[]).forEach(function(t){ delete t.photo; });
    return c;
  }
  window.addEventListener('message',function(event){
    if(event.source!==window.parent) return;
    var data=event.data; if(!data||typeof data!=='object') return;
    if(event.origin&&event.origin!=='null') parentOrigin=event.origin;
    if(data.type==='wye-report-fill') window.parent.postMessage({type:'wye-report-loaded',teams:fill(data)},parentOrigin);
    else if(data.type==='wye-report-teams') window.parent.postMessage({type:'wye-report-loaded',teams:setTeams(data.teams)},parentOrigin);
    else if(data.type==='wye-report-get-state') window.parent.postMessage({type:'wye-report-state',state:exportState()},parentOrigin);
  });
  window.parent.postMessage({type:'wye-report-ready'},'*');
}());
/* wye-bridge:end */
