(function(){
  'use strict';
  /* 데이터: data/items.csv(항목 한 줄 = 하나), data/updates.csv(날짜·내용). 엑셀에서 저장해도 되게 BOM을 지운다 */
  var DOW=['일','월','화','수','목','금','토'];
  var CATS=['세션','키노트','무대·행사','입장 규칙','기한','부스 정보'];
  var TRACKS=['AI','모빌리티·로보틱스','헬스·바이오','에너지·지속가능','공통','그 밖'];
  var PASSES=['Standard','유료 트랙','별도 티켓'];
  var STATES=['공개','작년 기준 예상','미정'];
  var GRADE={'공식-직접확인':'CES 공식 페이지를 직접 읽음','공식-요약':'공식 자료 요약으로 확인','2차':'언론·제3자 자료','추정':'지난해 실적에서 추정'};
  var JAN=['2027-01-06','2027-01-07','2027-01-08'];
  var TOP_HIDE=['d-02','d-03'];

  /* 지도: 가이드북 v3 조감도·확대 평면의 좌표(가로 1700 × 세로 2400). 지도마다 그 좌표계에서 잘라 낸 범위가 vb(x,y,폭,높이)이고,
     small이 있으면 작은 지도에는 그 범위(건물 도형)만 보여 준다.
     표시는 건물·홀 단위이고 방 위치는 아니다 */
  var MAPS={
    strip:{src:'maps/strip.svg',name:'스트립 전체',zoom:.3,vb:[0,160,1700,2240]},
    lvcc:{src:'maps/lvcc.svg',name:'LVCC 안',zoom:.3,vb:[0,200,1700,1140]},
    v2f:{src:'maps/venetian_2f.svg',name:'Venetian Expo 2층',vb:[0,1440,1500,350],small:[20,1444,590,300]},
    v1f:{src:'maps/venetian_1f.svg',name:'Venetian Expo 1층',vb:[0,1780,1500,350],small:[20,1784,590,300]}
  };
  var STRIP={palazzo:[681.3,884.5],venetian:[633.7,1005.6],expo:[750.8,1098.6],west:[1107.8,721.3],lvcc:[1404.1,832.6],font:[1056.8,418.8],cspace:[378.7,1370.1],sphere:[941.4,1115.3],wynn:[785,976.7]};
  var HALLS={west:[370,690],north:[590,850],central:[725,1000],f2:[294,1597],f1:[294,1943]};   // 홀 이름을 가리지 않는 자리
  function placeText(it){ var b=it['건물'],r=it['방']; return b===r||!r?(b||r||''):(b?b+' · '+r:r); }
  function guess(it){ return it['상태']==='작년 기준 예상'?' (예상)':''; }
  function spots(it){
    var b=it['건물'],r=it['방']||'',out=[];
    function add(map,xy){ if(xy) out.push({map:map,x:xy[0],y:xy[1]}); }
    if(/Palazzo/.test(r)) add('strip',STRIP.palazzo);
    else if(b==='Venetian') add('strip',STRIP.venetian);
    else if(b==='Venetian Expo'){ add('strip',STRIP.expo); if(/Hall G|유레카/.test(r)) add('v1f',HALLS.f1); else if(/2층|Health|헬스/.test(r)) add('v2f',HALLS.f2); }
    else if(b==='LVCC West'){ add('strip',STRIP.west); add('lvcc',HALLS.west); }
    else if(b==='LVCC North'){ add('strip',STRIP.lvcc); add('lvcc',HALLS.north); }
    else if(b==='LVCC Central'){ add('strip',STRIP.lvcc); add('lvcc',HALLS.central); }
    else if(b==='LVCC') add('strip',STRIP.lvcc);
    else if(b==='Fontainebleau') add('strip',STRIP.font);
    else if(b==='ARIA') add('strip',STRIP.cspace);
    else if(b==='Sphere') add('strip',STRIP.sphere);
    else if(b==='Wynn') add('strip',STRIP.wynn);
    return out;
  }
  // 펼친 행 오른쪽의 작은 지도: 표시한 곳이 가운데 오도록 잘라 보여 준다. 가장 자세한 지도 한 장만 쓰고, 나머지는 크게 보기에서 고른다.
  // 무거운 그림이라 펼칠 때 비로소 불러온다
  function buildMaps(li,it){
    var box=li.querySelector('.mapfigs'); if(!box||box.dataset.done) return; box.dataset.done='1';
    var list=spots(it), i=list.length-1, sp=list[i], m=MAPS[sp.map];
    var fig=document.createElement('button'); fig.type='button'; fig.className='mapfig'; fig.dataset.i=i;
    fig.setAttribute('aria-label','지도 크게 보기');
    fig.innerHTML='<span class="view"><img alt="" src="'+m.src+'"><i class="pin"></i></span><span class="cap">지도 크게 보기</span>';
    box.appendChild(fig);
    var view=fig.querySelector('.view'),W=view.clientWidth,vb=m.vb,box=m.small||vb,z=m.small?W/box[2]:m.zoom;
    if(m.small) view.style.height=(box[3]*z)+'px';
    var H=view.clientHeight,px=(sp.x-vb[0])*z,py=(sp.y-vb[1])*z;
    var tx=Math.max(W-(box[0]+box[2]-vb[0])*z,Math.min((vb[0]-box[0])*z,W/2-px)),ty=Math.max(H-(box[1]+box[3]-vb[1])*z,Math.min((vb[1]-box[1])*z,H/2-py));
    var img=fig.querySelector('img'); img.style.width=(vb[2]*z)+'px'; img.style.transform='translate('+tx+'px,'+ty+'px)';
    var pin=fig.querySelector('.pin'); pin.style.left=(px+tx)+'px'; pin.style.top=(py+ty)+'px';
  }
  // 크게 보기 창
  function openMap(it,idx){
    var dlg=document.getElementById('mapDlg'),list=spots(it),cur=idx;
    document.getElementById('mapTitle').textContent=it['분류']==='세션'?it['원제목']:it['제목'];
    document.getElementById('mapPlace').textContent=placeText(it)+guess(it);
    var tabs=document.getElementById('mapTabs'),img=document.getElementById('mapImg'),pin=document.getElementById('mapPin'),stage=img.parentNode;
    function show(){
      var sp=list[cur],vb=MAPS[sp.map].vb; img.src=MAPS[sp.map].src;
      stage.style.setProperty('--r',vb[2]/vb[3]); stage.classList.toggle('wide',vb[2]>vb[3]);
      pin.style.left=((sp.x-vb[0])/vb[2]*100)+'%'; pin.style.top=((sp.y-vb[1])/vb[3]*100)+'%';
      tabs.innerHTML=list.length<2?'':list.map(function(x,i){ return '<button type="button" class="chip" data-i="'+i+'" aria-pressed="'+(i===cur)+'">'+esc(MAPS[x.map].name)+'</button>'; }).join('');
    }
    tabs.onclick=function(e){ var b=e.target.closest('button'); if(b){ cur=+b.dataset.i; show(); } };
    show(); dlg.showModal();
  }

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function day(iso){ var p=String(iso).split('-'); return new Date(+p[0],(+p[1])-1,+p[2]); }
  function md(iso){ var p=String(iso).split('-'); return (+p[1])+'/'+(+p[2]); }
  function dow(iso){ return DOW[day(iso).getDay()]; }
  function todayIso(){ var d=new Date(); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
  function addDays(iso,n){ var d=day(iso); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
  function safeUrl(u){ return /^https?:\/\//i.test(u||'')?u:''; }

  // 따옴표·쉼표·줄바꿈을 지키는 CSV 읽기
  function parseCSV(text){
    text=text.replace(/^﻿/,'');
    var rows=[],row=[],f='',q=false;
    for(var i=0;i<text.length;i++){
      var c=text[i];
      if(q){ if(c==='"'){ if(text[i+1]==='"'){f+='"';i++;} else q=false; } else f+=c; }
      else if(c==='"') q=true;
      else if(c===','){ row.push(f); f=''; }
      else if(c==='\n'||c==='\r'){ if(c==='\r'&&text[i+1]==='\n') i++; row.push(f); rows.push(row); row=[]; f=''; }
      else f+=c;
    }
    if(f!==''||row.length){ row.push(f); rows.push(row); }
    var head=rows.shift()||[];
    return rows.filter(function(r){ return r.some(function(x){return x.trim()!=='';}); }).map(function(r){
      var o={}; head.forEach(function(h,j){ o[h.trim()]=(r[j]||'').trim(); }); return o;
    });
  }

  // 각 항목이 어느 필터 값에 속하나
  function dateKey(it){ if(JAN.indexOf(it['날짜'])>=0) return it['날짜']; if(it['날짜']) return 'pre'; return 'none'; }
  function dateLabel(k){ if(k==='pre') return '출국 전 기한'; if(k==='none') return '날짜 상관없음'; return md(k)+'('+dow(k)+')'; }
  function tracks(it){ return (it['우리트랙']||'').split(';').map(function(s){return s.trim();}).filter(Boolean); }
  var GROUPS=[
    {key:'c',title:'분류',get:function(it){return [it['분류']];},order:CATS},
    {key:'d',title:'날짜',get:function(it){return [dateKey(it)];},order:JAN.concat(['pre','none']),label:dateLabel},
    {key:'t',title:'트랙(미기탐 기준)',get:tracks,order:TRACKS},
    {key:'p',title:'패스',get:function(it){return it['패스']?[it['패스']]:[];},order:PASSES},
    {key:'b',title:'건물',get:function(it){return it['건물']?[it['건물']]:[];},order:null},
    {key:'s',title:'상태',get:function(it){return [it['상태']];},order:STATES}
  ];

  var ITEMS=[],BY_ID={},UPD=[],LATEST='',NEWFROM='';
  var state={q:''}; GROUPS.forEach(function(g){ state[g.key]=[]; });

  function readHash(){
    var h=new URLSearchParams(location.hash.slice(1));
    GROUPS.forEach(function(g){ var v=h.get(g.key); state[g.key]=v?v.split(','):[]; });
    state.q=h.get('q')||'';
  }
  function writeHash(){
    var h=new URLSearchParams();
    GROUPS.forEach(function(g){ if(state[g.key].length) h.set(g.key,state[g.key].join(',')); });
    if(state.q) h.set('q',state.q);
    var s=h.toString(); history.replaceState(null,'',s?'#'+s:location.pathname+location.search);
  }

  function matchText(it){
    if(!state.q) return true;
    var hay=[it['제목'],it['원제목'],it['요약'],it['할일'],it['방'],it['건물'],it['CES트랙']].join(' ').toLowerCase();
    return state.q.toLowerCase().split(/\s+/).filter(Boolean).every(function(w){ return hay.indexOf(w)>=0; });
  }
  function matchGroup(it,g){
    var sel=state[g.key]; if(!sel.length) return true;
    var v=g.get(it); return v.some(function(x){ return sel.indexOf(x)>=0; });
  }
  function matches(it,skip){
    if(!matchText(it)) return false;
    for(var i=0;i<GROUPS.length;i++){ if(GROUPS[i]!==skip && !matchGroup(it,GROUPS[i])) return false; }
    return true;
  }

  function renderFilters(){
    var box=document.getElementById('filters'); box.innerHTML='';
    GROUPS.forEach(function(g){
      var all={},cnt={};
      ITEMS.forEach(function(it){ g.get(it).forEach(function(v){ all[v]=(all[v]||0)+1; }); });
      ITEMS.forEach(function(it){ if(matches(it,g)) g.get(it).forEach(function(v){ cnt[v]=(cnt[v]||0)+1; }); });
      var vals=g.order?g.order.filter(function(v){return all[v];}):Object.keys(all).sort(function(a,b){return all[b]-all[a];});
      var wrap=document.createElement('div'); wrap.className='fgroup';
      wrap.innerHTML='<h3>'+esc(g.title)+'</h3><div class="chips"></div>';
      var chips=wrap.querySelector('.chips');
      vals.forEach(function(v){
        var on=state[g.key].indexOf(v)>=0, n=cnt[v]||0;
        var b=document.createElement('button'); b.type='button'; b.className='chip';
        b.setAttribute('aria-pressed',on?'true':'false'); if(!n&&!on) b.disabled=true;
        b.innerHTML=esc(g.label?g.label(v):v)+'<span class="n">'+n+'</span>';
        b.addEventListener('click',function(){
          var a=state[g.key], i=a.indexOf(v); if(i>=0) a.splice(i,1); else a.push(v);
          writeHash(); render();
        });
        chips.appendChild(b);
      });
      box.appendChild(wrap);
    });
  }

  function passTag(p){
    if(p==='Standard') return '<span class="tag std">Standard</span>';
    if(p==='유료 트랙') return '<span class="tag paid">유료 트랙</span>';
    if(p==='별도 티켓') return '<span class="tag ticket">별도 티켓</span>';
    return '';
  }
  function defaultTodo(it){
    if(it['분류']!=='세션') return '';
    if(it['패스']==='Standard') return '선착순 좌석, 2~4명씩 나눠 20~30분 전에 도착';
    if(it['패스']==='유료 트랙') return '이 트랙이나 Premium 구매자만 입장, 연수단 기본 계획(전원 Standard)으로는 입장 불가';
    return '';
  }

  function rowHtml(it){
    var isS=it['분류']==='세션';
    var when='';
    if(JAN.indexOf(it['날짜'])>=0) when=it['시작']?'<b>'+esc(it['시작'])+'</b>'+(it['끝']?'~'+esc(it['끝']):''):'<b>'+esc(md(it['날짜']))+'</b>';
    else if(it['날짜']) when='<b>'+esc(md(it['날짜']))+'</b>('+esc(dow(it['날짜']))+')';
    else when=esc(it['분류']);
    var t1=isS?it['원제목']:it['제목'];
    var t2=isS?it['제목']:(it['요약']||'').split(/,\s/)[0];
    var tags=passTag(it['패스']);
    if(it['상태']==='미정') tags+='<span class="tag tbd">미정</span>';
    if(it['변경일']&&it['변경일']>=NEWFROM) tags+='<span class="tag new">새로</span>';
    var where=(it['방']||it['건물'])?'<span class="room">'+esc((it['방']||it['건물'])+guess(it))+'</span>'+(it['방']&&it['건물']&&it['방']!==it['건물']?esc(it['건물']):''):'';
    if(!where&&guess(it)&&t1.indexOf('(예상)')<0) where='<span class="room">(예상)</span>';   // 장소가 없는 기한 항목
    var todo=it['할일']||defaultTodo(it);
    var url=safeUrl(it['원문링크']);
    var kv=[];
    if(it['날짜']) kv.push(['일시',md(it['날짜'])+'('+dow(it['날짜'])+')'+(it['시작']?' '+it['시작']+(it['끝']?'~'+it['끝']:''):'')]);
    if(it['건물']||it['방']) kv.push(['장소',placeText(it)+guess(it)]);
    if(it['CES트랙']) kv.push(['CES 트랙',it['CES트랙']]);
    if(it['우리트랙']) kv.push(['트랙(미기탐 기준)',tracks(it).join(', ')]);
    if(it['근거']) kv.push(['근거',GRADE[it['근거']]||it['근거']]);
    if(it['확인일']) kv.push(['확인한 날',md(it['확인일'])]);
    var info=(isS?'':'<p>'+esc(it['요약'])+'</p>')
      +(todo?'<p class="todo"><b>참고</b>'+esc(todo)+'</p>':'')
      +'<div class="kv">'+kv.map(function(p){return '<span>'+esc(p[0])+'</span><b>'+esc(p[1])+'</b>';}).join('')+'</div>'
      +(url?'<a class="src" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">원문 열기 ↗</a>':'');
    var body='<div class="info">'+info+'</div>'+(spots(it).length?'<div class="mapfigs"></div>':'');
    return '<li class="row" data-id="'+esc(it['id'])+'"><button type="button" aria-expanded="false">'
      +'<span class="when">'+when+'</span>'
      +'<span><span class="t1">'+esc(t1)+'</span>'+(t2?'<span class="t2" style="display:block">'+esc(t2)+'</span>':'')+'</span>'
      +'<span class="where">'+where+'<span class="tags">'+tags+'</span></span>'
      +'</button><div class="detail"><div class="body">'+body+'</div></div></li>';
  }

  var CAT_RANK={}; CATS.forEach(function(c,i){CAT_RANK[c]=i;});
  function renderList(){
    var shown=ITEMS.filter(function(it){ return matches(it,null); });
    document.getElementById('count').textContent='항목 '+shown.length+'개 / 전체 '+ITEMS.length+'개';
    var groups=[];
    JAN.forEach(function(d){ groups.push({title:(+d.slice(5,7))+'월 '+(+d.slice(8))+'일 ('+dow(d)+')',sub:'CES 관람일',items:shown.filter(function(it){return it['날짜']===d;})}); });
    groups.push({title:'출국 전 기한',sub:'11~12월',items:shown.filter(function(it){return dateKey(it)==='pre';})});
    ['입장 규칙','무대·행사','부스 정보'].forEach(function(c){
      var sub=c==='부스 정보'?'관심 있는 학생 개별 방문용 · 연수단 단체 방문은 요청하지 않음':c==='무대·행사'?'배지로 들어가는 공식 행사 · 날짜 미정 포함':'';
      groups.push({title:c,sub:sub,items:shown.filter(function(it){return dateKey(it)==='none'&&it['분류']===c;})});
    });
    var others=shown.filter(function(it){ return dateKey(it)==='none'&&['입장 규칙','무대·행사','부스 정보'].indexOf(it['분류'])<0; });
    if(others.length) groups.push({title:'그 밖',sub:'',items:others});
    var out=document.getElementById('groups'); var html='';
    groups.forEach(function(g){
      if(!g.items.length) return;
      g.items.sort(function(a,b){ return (a['날짜']||'').localeCompare(b['날짜']||'')||(a['시작']||'99').localeCompare(b['시작']||'99')||(CAT_RANK[a['분류']]-CAT_RANK[b['분류']])||(a['건물']||'').localeCompare(b['건물']||''); });
      html+='<h3 class="gtitle">'+esc(g.title)+(g.sub?'<span class="sub">'+esc(g.sub)+'</span>':'')+'<span class="sub">'+g.items.length+'개</span></h3><ul class="rows">'+g.items.map(rowHtml).join('')+'</ul>';
    });
    out.innerHTML=html||'<p class="empty">조건에 맞는 항목이 없습니다. 필터를 줄여 보세요.</p>';
  }

  function render(){ renderFilters(); renderList(); document.getElementById('q').value=state.q; }

  function renderTop(){
    var today=todayIso(), t0=day(today);
    var ul=document.getElementById('dues'); ul.innerHTML='';
    // 다가오는 기한 2개와 CES 개막을 남은 날이 적은 순으로 보여 준다. 등록 가격·환불 기한은 목록에만 둔다
    var list=ITEMS.filter(function(it){return it['분류']==='기한'&&it['날짜']>=today&&TOP_HIDE.indexOf(it['id'])<0;}).map(function(it){return {d:it['날짜'],name:it['제목']};});
    list.sort(function(a,b){return a.d.localeCompare(b.d);});
    list=list.slice(0,2).concat([{d:'2027-01-06',name:'CES 개막'}]);
    list.forEach(function(x){
      var dd=Math.round((day(x.d)-t0)/86400000);
      var li=document.createElement('li'); if(dd<=7) li.className='soon';
      li.innerHTML='<b>'+(dd===0?'오늘':dd+'일')+'</b>'+esc(x.name)+' · '+esc(md(x.d));
      ul.appendChild(li);
    });
    document.getElementById('stamp').textContent=LATEST?md(LATEST)+' 갱신':'';
    // 업데이트 기록 창
    var sheet=document.getElementById('logSheet'), by={};
    UPD.forEach(function(u){ (by[u['날짜']]=by[u['날짜']]||[]).push(u['내용']); });
    sheet.innerHTML=Object.keys(by).sort().reverse().map(function(d){ return '<h4>'+esc(md(d))+'('+esc(dow(d))+')</h4><ul>'+by[d].map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>'; }).join('');
    var btn=document.getElementById('logBtn'), seen='';
    try{ seen=localStorage.getItem('ces27.seen')||''; }catch(e){}
    if(LATEST&&seen<LATEST) btn.classList.add('unseen');
    btn.addEventListener('click',function(e){
      e.stopPropagation(); var on=sheet.classList.toggle('on'); btn.setAttribute('aria-expanded',on?'true':'false');
      if(on){ btn.classList.remove('unseen'); try{ localStorage.setItem('ces27.seen',LATEST); }catch(e2){} }
    });
    document.addEventListener('click',function(e){ if(!sheet.contains(e.target)&&sheet.classList.contains('on')){ sheet.classList.remove('on'); btn.setAttribute('aria-expanded','false'); } });
  }

  function wire(){
    var q=document.getElementById('q'), timer;
    q.addEventListener('input',function(){ clearTimeout(timer); timer=setTimeout(function(){ state.q=q.value.trim(); writeHash(); renderFilters(); renderList(); },150); });
    document.getElementById('reset').addEventListener('click',function(){ GROUPS.forEach(function(g){state[g.key]=[];}); state.q=''; writeHash(); render(); });
    var copy=document.getElementById('copy');
    copy.addEventListener('click',function(){
      var done=function(){ copy.textContent='링크를 복사했습니다'; copy.classList.add('ok'); setTimeout(function(){ copy.textContent='이 조건 링크 복사'; copy.classList.remove('ok'); },1600); };
      if(navigator.clipboard) navigator.clipboard.writeText(location.href).then(done,function(){ prompt('이 주소를 복사하세요',location.href); });
      else prompt('이 주소를 복사하세요',location.href);
    });
    document.getElementById('groups').addEventListener('click',function(e){
      var b=e.target.closest('.row>button'); if(!b) return;
      var li=b.parentNode, on=li.classList.toggle('open'); b.setAttribute('aria-expanded',on?'true':'false');
      if(on) buildMaps(li,BY_ID[li.dataset.id]);
    });
    document.getElementById('groups').addEventListener('click',function(e){
      var f=e.target.closest('.mapfig'); if(f) openMap(BY_ID[f.closest('.row').dataset.id],+f.dataset.i);
    });
    var dlg=document.getElementById('mapDlg');
    document.getElementById('mapClose').addEventListener('click',function(){ dlg.close(); });
    dlg.addEventListener('click',function(e){ if(e.target===dlg) dlg.close(); });
    window.addEventListener('hashchange',function(){ readHash(); render(); });
  }

  function load(path){ return fetch(path,{cache:'no-cache'}).then(function(r){ if(!r.ok) throw new Error(path+' '+r.status); return r.text(); }).then(parseCSV); }
  Promise.all([load('data/items.csv'),load('data/updates.csv')]).then(function(res){
    ITEMS=res[0]; ITEMS.forEach(function(it){ BY_ID[it['id']]=it; }); UPD=res[1].sort(function(a,b){return b['날짜'].localeCompare(a['날짜']);});
    LATEST=UPD.length?UPD[0]['날짜']:''; NEWFROM=LATEST?addDays(LATEST,-7):'9999';
    readHash(); renderTop(); wire(); render();
  }).catch(function(err){
    document.getElementById('groups').innerHTML='<p class="empty">데이터를 불러오지 못했습니다. ('+esc(err.message)+')</p>';
  });
})();
