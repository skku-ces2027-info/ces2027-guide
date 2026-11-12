(function(){
  'use strict';
  /* Data: data/items.csv (one row per item) and data/updates.csv (date, note). The CSV keeps its Korean
     column names and values; this file only decides how they are shown. */
  var DAYS=['2027-01-06','2027-01-07','2027-01-08'];
  var WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var CATS=['세션','키노트','무대·행사','입장 규칙','기한','부스 정보'];
  var TRACKS=['AI','모빌리티·로보틱스','헬스·바이오','에너지·지속가능','공통','그 밖'];
  var PASSES=['Standard','유료 트랙','별도 티켓'];
  var STATES=['공개','작년 기준 예상','미정'];
  var TOP_HIDE=['d-02','d-03'];   // price and refund dates stay in the list only

  // English labels for CSV values. A value that is not listed here is shown as written in the CSV
  var EN={
    '세션':'Session','키노트':'Keynote','무대·행사':'Stage or event','입장 규칙':'Entry rule','기한':'Deadline','부스 정보':'Booth',
    '모빌리티·로보틱스':'Mobility & Robotics','헬스·바이오':'Health & Bio','에너지·지속가능':'Energy & Sustainability','공통':'Common','그 밖':'Other',
    '유료 트랙':'Paid track','별도 티켓':'Separate ticket',
    '공개':'Published','작년 기준 예상':'Expected, based on 2026','미정':'To be announced',
    '공식-직접확인':'Read on the official CES page','공식-요약':'Official summary','2차':'Press or third party','추정':'Estimated from last year',
    '미기재':'Not listed'
  };
  var GROUP_TITLE={'세션':'Sessions','키노트':'Keynotes','무대·행사':'Stages and events','입장 규칙':'Entry rules','기한':'Deadlines','부스 정보':'Booths'};
  function en(v){ return EN[v]||v; }
  function enRoom(r){ return String(r||'').replace(/(\d+)층/g,'Level $1').replace(/^미정$/,'To be announced').replace('장소 미기재','Not listed').replace('방 미기재','room not listed'); }

  /* Map. Coordinates are in the map generator's space (1700 wide); VIEW is the part maps/strip.svg shows.
     Pins mark a building or hall, not a room. */
  var VIEW=[-420,240,2120,1940];        // maps/strip.svg, the painted picture on the first screen
  var DETAIL=[0,300,1700,1500];         // maps/strip_detail.svg, the plain map in an opened row and in the full map
  var PIN={   // building: [x, y, label side]
    'Fontainebleau':[1045,575,'l'],'LVCC West':[1107.8,721.3,'r'],'LVCC North':[1404.1,832.6,'l'],'LVCC Central':[1520,700,'l'],'LVCC':[1300,640,'l'],
    'Wynn':[785,976.7,'r'],'Venetian':[633.7,1005.6,'l'],'Venetian Expo':[750.8,1098.6,'l'],'Sphere':[941.4,1115.3,'r'],'ARIA':[378.7,1370.1,'r']
  };
  var MAIN=['Fontainebleau','LVCC West','LVCC North','Venetian','Venetian Expo','Sphere','ARIA'];   // always labelled; the rest appear when they have items
  var PALAZZO=[681.3,884.5];
  var PLANS={
    city:{src:'maps/strip_detail.svg',name:'Las Vegas venues',vb:DETAIL},
    lvcc:{src:'maps/lvcc.svg',name:'LVCC halls',vb:[0,200,1700,1140]},
    v2f:{src:'maps/venetian_2f.svg',name:'Venetian Expo, Level 2',vb:[0,1440,1500,350]},
    v1f:{src:'maps/venetian_1f.svg',name:'Venetian Expo, Level 1',vb:[0,1780,1500,350]}
  };
  var HALL={west:[370,690],north:[590,850],central:[725,1000],f2:[294,1597],f1:[294,1943]};
  function campus(b){ return /LVCC/.test(b)?'lvcc':/Venetian|Wynn/.test(b)?'ven':b==='ARIA'?'cspace':b==='Fontainebleau'?'font':'etc'; }
  function spot(it){ if(/Palazzo/.test(it['방']||'')) return PALAZZO; var p=PIN[it['건물']]; return p?[p[0],p[1]]:null; }
  function plan(it){
    var b=it['건물'], r=it['방']||'';
    if(b==='LVCC West') return {map:'lvcc',xy:HALL.west};
    if(b==='LVCC North') return {map:'lvcc',xy:HALL.north};
    if(b==='LVCC Central') return {map:'lvcc',xy:HALL.central};
    if(b==='Venetian Expo'){ if(/Hall G|유레카/.test(r)) return {map:'v1f',xy:HALL.f1}; if(/2층|Health|헬스/.test(r)) return {map:'v2f',xy:HALL.f2}; }
    return null;
  }

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function day(iso){ var p=String(iso).split('-'); return new Date(+p[0],(+p[1])-1,+p[2]); }
  function md(iso){ var d=day(iso); return MON[d.getMonth()]+' '+d.getDate(); }
  function wmd(iso){ return WD[day(iso).getDay()]+', '+md(iso); }
  function pad(n){ return ('0'+n).slice(-2); }
  function isoOf(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function todayIso(){ return isoOf(new Date()); }
  function addDays(iso,n){ var d=day(iso); d.setDate(d.getDate()+n); return isoOf(d); }
  function safeUrl(u){ return /^https?:\/\//i.test(u||'')?u:''; }

  // CSV reader that keeps quotes, commas and line breaks inside fields; drops a BOM so Excel exports work
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

  /* State. The hash keeps the same keys as before (c, d, t, p, b, s, q) so old shared links still open */
  // Each item belongs to one tab: a CES day, 'rules' (deadlines and entry rules, to settle before leaving),
  // or 'places' (stages, events and booths with no fixed time, to drop by on site)
  function dayKey(it){
    if(DAYS.indexOf(it['날짜'])>=0) return it['날짜'];
    return it['날짜']||it['분류']==='기한'||it['분류']==='입장 규칙'?'rules':'places';
  }
  function tracksOf(it){ return (it['우리트랙']||'').split(';').map(function(s){return s.trim();}).filter(Boolean); }
  var GROUPS=[
    {key:'t',title:'Track',get:tracksOf,order:TRACKS},
    {key:'c',title:'Type',get:function(it){return [it['분류']];},order:CATS,panel:true},
    {key:'p',title:'Pass',get:function(it){return it['패스']?[it['패스']]:[];},order:PASSES,panel:true},
    {key:'b',title:'Building',get:function(it){return it['건물']?[it['건물']]:[];},order:null,panel:true},
    {key:'s',title:'Status',get:function(it){return [it['상태']];},order:STATES,panel:true}
  ];
  var TABS=DAYS.concat(['rules','places','all']);
  var TAB_NAME={rules:'Rules & deadlines',places:'Stages & booths',all:'All'};
  var TAB_NOTE={
    rules:'What to settle before leaving, and how entry works once you are there.',
    places:'Stages, official events and booths with no fixed time yet. These are for visiting on your own; the delegation does not ask for group visits.'
  };
  var ITEMS=[],BY_ID={},UPD=[],LATEST='',NEWFROM='',DEFAULT_DAY=DAYS[0];
  var state={q:'',d:DAYS[0]}; GROUPS.forEach(function(g){ state[g.key]=[]; });

  function readHash(){
    var h=new URLSearchParams(location.hash.slice(1));
    GROUPS.forEach(function(g){ var v=h.get(g.key); state[g.key]=v?v.split(','):[]; });
    state.q=h.get('q')||'';
    var d=(h.get('d')||'').split(',')[0];
    if(d==='pre'||d==='prep') d='rules'; else if(d==='none') d='places';   // tab names used by earlier versions
    state.d=TABS.indexOf(d)>=0?d:(state.q?'all':DEFAULT_DAY);
  }
  function writeHash(){
    var h=new URLSearchParams();
    if(state.d!==DEFAULT_DAY) h.set('d',state.d);
    GROUPS.forEach(function(g){ if(state[g.key].length) h.set(g.key,state[g.key].join(',')); });
    if(state.q) h.set('q',state.q);
    var s=h.toString(); history.replaceState(null,'',s?'#'+s:location.pathname+location.search);
  }
  function matchText(it){
    if(!state.q) return true;
    var hay=[it['제목'],it['원제목'],it['요약'],it['할일'],it['방'],it['건물'],it['CES트랙'],en(it['분류'])].join(' ').toLowerCase();
    return state.q.toLowerCase().split(/\s+/).filter(Boolean).every(function(w){ return hay.indexOf(w)>=0; });
  }
  function matchGroup(it,g){ var sel=state[g.key]; if(!sel.length) return true; return g.get(it).some(function(x){ return sel.indexOf(x)>=0; }); }
  function inTab(it){ return state.d==='all'||dayKey(it)===state.d; }
  // skip: a group to leave out, so each filter can show how many items its own values would give
  function matches(it,skip,anyDay){
    if(!anyDay&&!inTab(it)) return false;
    if(!matchText(it)) return false;
    for(var i=0;i<GROUPS.length;i++){ if(GROUPS[i]!==skip&&!matchGroup(it,GROUPS[i])) return false; }
    return true;
  }
  function filtersOn(){ return !!state.q||GROUPS.some(function(g){ return state[g.key].length; }); }
  function toggle(key,v){ var a=state[key],i=a.indexOf(v); if(i>=0) a.splice(i,1); else a.push(v); writeHash(); render(); }

  /* Bar */
  function tabLabel(k){ return TAB_NAME[k]||wmd(k); }
  function renderTabs(){
    $('tabs').innerHTML=TABS.map(function(k){
      var n=ITEMS.filter(function(it){ return (k==='all'||dayKey(it)===k)&&matches(it,null,true); }).length;
      return '<button type="button" data-d="'+k+'" aria-pressed="'+(state.d===k)+'">'+esc(tabLabel(k))+'<small>'+n+'</small></button>';
    }).join('');
  }
  function renderTracks(){
    var g=GROUPS[0], have={};
    ITEMS.forEach(function(it){ g.get(it).forEach(function(v){ have[v]=1; }); });
    $('tracks').innerHTML='<button type="button" data-t="" aria-pressed="'+(!state.t.length)+'">All tracks</button>'
      +TRACKS.filter(function(v){return have[v];}).map(function(v){ return '<button type="button" data-t="'+esc(v)+'" aria-pressed="'+(state.t.indexOf(v)>=0)+'">'+esc(en(v))+'</button>'; }).join('');
  }
  function renderPanel(){
    var box=$('filters'); box.innerHTML='';
    var picked=0;
    GROUPS.forEach(function(g){
      if(!g.panel) return;
      picked+=state[g.key].length;
      var all={},cnt={};
      ITEMS.forEach(function(it){ g.get(it).forEach(function(v){ all[v]=(all[v]||0)+1; }); });
      ITEMS.forEach(function(it){ if(matches(it,g)) g.get(it).forEach(function(v){ cnt[v]=(cnt[v]||0)+1; }); });
      var vals=g.order?g.order.filter(function(v){return all[v];}):Object.keys(all).sort(function(a,b){return all[b]-all[a];});
      var wrap=document.createElement('div'); wrap.className='fgroup';
      wrap.innerHTML='<h3>'+esc(g.title)+'</h3><div class="chips">'+vals.map(function(v){
        var on=state[g.key].indexOf(v)>=0, n=cnt[v]||0;
        return '<button type="button" class="chip" data-k="'+g.key+'" data-v="'+esc(v)+'" aria-pressed="'+on+'"'+(!n&&!on?' disabled':'')+'>'+esc(en(v))+'<span class="n">'+n+'</span></button>';
      }).join('')+'</div>';
      box.appendChild(wrap);
    });
    $('fcount').textContent=picked||'';
  }
  var introDone=false;
  function renderPins(){
    var g=GROUPS[3], cnt={};
    ITEMS.forEach(function(it){ if(matches(it,g)) g.get(it).forEach(function(v){ cnt[v]=(cnt[v]||0)+1; }); });
    var names=Object.keys(PIN).filter(function(b){ return cnt[b]||state.b.indexOf(b)>=0||MAIN.indexOf(b)>=0; });
    var box=$('pins');
    box.innerHTML=names.map(function(b){
      var p=PIN[b], on=state.b.indexOf(b)>=0, n=cnt[b]||0;
      return '<button type="button" class="pin '+p[2]+(n?'':' zero')+'" data-b="'+esc(b)+'" aria-pressed="'+on+'" aria-label="'+esc(b+', '+n+' items')+'" style="--c:var(--'+campus(b)+');left:'+((p[0]-VIEW[0])/VIEW[2]*100)+'%;top:'+((p[1]-VIEW[1])/VIEW[3]*100)+'%"><i>'+n+'</i>'+esc(b)+'</button>';
    }).join('');
    if(!introDone){   // the first labels wait for the opening move to finish
      introDone=true; box.className='intro';
      var wait=Math.max(0,2300-performance.now());
      [].forEach.call(box.children,function(el,i){ el.style.animationDelay=(wait+i*50)+'ms'; });
    } else box.className='';
    $('venues').innerHTML=names.map(function(b){
      return '<button type="button" class="chip" data-b="'+esc(b)+'" aria-pressed="'+(state.b.indexOf(b)>=0)+'" style="--c:var(--'+campus(b)+')">'+esc(b)+'<span class="n">'+(cnt[b]||0)+'</span></button>';
    }).join('');
  }

  /* List */
  var CAT_RANK={}; CATS.forEach(function(c,i){CAT_RANK[c]=i;});
  function defaultNote(it){
    if(it['분류']!=='세션') return '';
    if(it['패스']==='Standard') return '선착순 좌석, 2~4명씩 나눠 20~30분 전에 도착';
    if(it['패스']==='유료 트랙') return '이 트랙이나 Premium 구매자만 입장, 연수단 기본 계획(전원 Standard)으로는 입장 불가';
    return '';
  }
  function placeText(it){ var b=en(it['건물']), r=enRoom(it['방']); return b===r||!r?(b||r):(b?b+', '+r:r); }
  function rowHtml(it){
    var isS=it['분류']==='세션', paid=it['패스']==='유료 트랙';
    var t1=isS?it['원제목']:it['제목'], t2=isS?it['제목']:(it['요약']||'').split(/,\s/)[0];
    var bld=en(it['건물']), room=enRoom(it['방']);
    var sub=[]; if(room&&room!==bld) sub.push(room); if(it['끝']) sub.push('until '+it['끝']);
    if(it['상태']==='작년 기준 예상') sub.push('expected');
    var pl=(bld||sub.length)?'<span class="pl" style="--c:var(--'+campus(it['건물'])+')">'+esc(bld||room)+(sub.length?'<span>'+esc(sub.join(' · '))+'</span>':'')+'</span>':'<span class="pl"></span>';
    var tags='';
    if(it['상태']==='미정') tags+='<span class="tag">TBA</span>';
    if(it['변경일']&&it['변경일']>=NEWFROM) tags+='<span class="tag new">New</span>';
    var ps=it['패스']?'<b>'+esc(en(it['패스']))+'</b>':(isS?'':esc(en(it['분류'])));
    return '<li class="row'+(paid?' paid':'')+'" data-id="'+esc(it['id'])+'"><button type="button" class="row-b" aria-expanded="false">'
      +'<span class="t"><span class="t1"'+(isS?'':' lang="ko"')+'>'+esc(t1)+tags+'</span>'+(t2?'<span class="t2" lang="ko">'+esc(t2)+'</span>':'')+'</span>'
      +pl+'<span class="ps">'+ps+'</span></button><div class="detail" hidden></div></li>';
  }
  function byTime(a,b){ return (a['날짜']||'').localeCompare(b['날짜']||'')||(a['시작']||'99').localeCompare(b['시작']||'99')||(CAT_RANK[a['분류']]-CAT_RANK[b['분류']])||(a['건물']||'').localeCompare(b['건물']||''); }
  // sub: the small line under the heading; the item count unless something else is given
  function slotHtml(head,word,items,sub){
    return '<section class="slot"><h3'+(word?' class="word"':'')+'>'+head+'<small>'+(sub||items.length+(items.length>1?' items':' item'))+'</small></h3><ul>'+items.map(rowHtml).join('')+'</ul></section>';
  }
  function dayHtml(list){
    var by={},keys=[];
    list.sort(byTime).forEach(function(it){ var k=it['시작']||''; if(!by[k]){ by[k]=[]; keys.push(k); } by[k].push(it); });
    return keys.map(function(k){ return slotHtml(k?esc(k):'All day',!k,by[k]); }).join('');
  }
  function prepHtml(list){
    var today=todayIso(), out='';
    var dated=list.filter(function(it){ return it['날짜']; }).sort(byTime), by={},keys=[];
    dated.forEach(function(it){ var k=it['날짜']; if(!by[k]){ by[k]=[]; keys.push(k); } by[k].push(it); });
    keys.forEach(function(k){ var dd=Math.round((day(k)-day(today))/86400000);
      out+=slotHtml(esc(md(k)),true,by[k],dd>0?'in '+dd+' day'+(dd>1?'s':''):dd===0?'today':'passed'); });
    ['입장 규칙','키노트','무대·행사','부스 정보','세션','기한'].forEach(function(c){
      var items=list.filter(function(it){ return !it['날짜']&&it['분류']===c; });
      if(items.length) out+=slotHtml(esc(GROUP_TITLE[c]),true,items);
    });
    var rest=list.filter(function(it){ return !it['날짜']&&CATS.indexOf(it['분류'])<0; });
    if(rest.length) out+=slotHtml('Other',true,rest);
    return out;
  }
  function renderList(){
    var shown=ITEMS.filter(function(it){ return matches(it,null); }), html='';
    if(state.d==='all'){
      DAYS.concat(['rules','places']).forEach(function(k){
        var part=shown.filter(function(it){ return dayKey(it)===k; });
        if(part.length) html+='<h2 class="dayhead">'+esc(tabLabel(k))+'<small>'+part.length+'</small></h2>'+(DAYS.indexOf(k)<0?prepHtml(part):dayHtml(part));
      });
    } else if(DAYS.indexOf(state.d)>=0) html=dayHtml(shown);
    else html=shown.length?'<p class="tabnote">'+esc(TAB_NOTE[state.d])+'</p>'+prepHtml(shown):'';
    $('list').innerHTML=html||'<p class="empty">Nothing matches these filters'+(state.d==='all'?'.':' on this tab.')+'<button type="button" class="text-btn" data-reset>Clear all filters</button></p>';
    watch();
    var base=ITEMS.filter(inTab).length;
    $('count').innerHTML=(filtersOn()?shown.length+' of '+base:base)+' items'+(filtersOn()?'<button type="button" data-reset>Clear filters</button>':'');
  }
  /* Motion while scrolling. Time blocks come in as they enter the screen; the hero drifts and fades as it leaves */
  var calm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches, seer=null;
  function watch(){
    if(calm||!('IntersectionObserver' in window)) return;
    var list=$('list'); list.classList.add('reveal');
    if(seer) seer.disconnect();
    seer=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); seer.unobserve(e.target); } }); },{rootMargin:'0px 0px -7% 0px'});
    [].forEach.call(list.querySelectorAll('.slot,.dayhead'),function(el){
      [].forEach.call(el.querySelectorAll('.row'),function(r,i){ r.style.setProperty('--i',i); });
      seer.observe(el);
    });
  }
  function drift(){
    var top=document.querySelector('.top'), bar=$('bar'), mapIn=$('mapIn'), titleIn=$('titleIn'), wide=matchMedia('(min-width:900px) and (min-aspect-ratio:6/5)'), tick=false;
    function run(){
      tick=false;
      var y=window.scrollY, h=top.offsetHeight;
      bar.classList.toggle('stuck',bar.getBoundingClientRect().top<=0);
      if(calm||!wide.matches){ mapIn.style.transform=''; titleIn.style.cssText=''; return; }
      if(y>h) return;
      var p=y/h;
      mapIn.style.transform='translate3d(0,'+(y*.24).toFixed(1)+'px,0)';
      titleIn.style.transform='translate3d(0,'+(-y*.1).toFixed(1)+'px,0)'; titleIn.style.opacity=Math.max(0,1-p*1.7).toFixed(3);
    }
    window.addEventListener('scroll',function(){ if(!tick){ tick=true; requestAnimationFrame(run); } },{passive:true});
    window.addEventListener('resize',run); run();
  }

  /* One move between the first screen and the schedule. Touch, the scrollbar and Page keys are handled by
     CSS scroll snapping; a mouse wheel or an arrow key moves too little for that, so those are sent the whole way here */
  var moving=0, raf=0;
  // A slow, eased move. Snapping is switched off while it runs, or the browser would pull each frame back
  function go(y){
    var root=document.documentElement, from=window.scrollY, dist=y-from, dur=calm?0:Math.min(1500,Math.max(1100,Math.abs(dist)*1.3)), t0=performance.now();
    cancelAnimationFrame(raf);
    if(!dur||Math.abs(dist)<2){ window.scrollTo(0,y); return; }
    moving=Date.now()+dur; root.style.scrollSnapType='none';
    (function frame(now){
      var p=Math.min(1,(now-t0)/dur), e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
      window.scrollTo(0,from+dist*e);
      if(p<1) raf=requestAnimationFrame(frame); else root.style.scrollSnapType='';
    })(t0);
  }
  function snap(){
    var top=document.querySelector('.top'), last=0;
    function fits(){ return top.offsetHeight<=window.innerHeight+2; }   // on small screens the first screen can be taller; let it scroll
    function step(dir,fresh){
      var y=window.scrollY, h=top.offsetHeight;
      if(Date.now()<moving+250) return true;                // already on the way
      if(dir>0&&y<h-1){ go(h); return true; }
      if(dir<0&&y>0&&y<=h+1){ if(fresh) go(0); return true; }   // going back up starts with a new gesture, not leftover momentum
      return false;
    }
    window.addEventListener('wheel',function(e){
      if(e.ctrlKey||!fits()||document.querySelector('dialog[open]')) return;
      var now=Date.now(), fresh=now-last>220; last=now;
      if(step(e.deltaY>0?1:-1,fresh)) e.preventDefault();
    },{passive:false});
    window.addEventListener('keydown',function(e){
      if(!fits()||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||document.querySelector('dialog[open]')) return;
      var dir=e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0;
      if(dir&&step(dir,true)) e.preventDefault();
    });
  }
  // the opening zoom: as large as covers the screen without pushing a venue off the top or bottom
  (function(){
    var W=window.innerWidth, H=window.innerHeight, pad=Math.max(40,(W-1360)/2), res=pad+Math.min(480,.34*W)+24;
    var z=Math.max(H/1660,Math.min(H/1400,(W-res)/1530));
    document.documentElement.style.setProperty('--s',Math.max(1,Math.min(1.12,W/(2080*z),H/(1345*z))).toFixed(4));
  })();

  function render(){ renderTabs(); renderTracks(); renderPanel(); renderPins(); renderList(); $('q').value=state.q; }

  /* Detail: built when a row is opened. The map image is large, so it loads only then */
  function buildDetail(li,it){
    var box=li.querySelector('.detail'); if(box.dataset.done) return; box.dataset.done='1';
    var isS=it['분류']==='세션', note=it['할일']||defaultNote(it), url=safeUrl(it['원문링크']), xy=spot(it), pl=plan(it), kv=[];
    if(it['날짜']) kv.push(['When',wmd(it['날짜'])+(it['시작']?', '+it['시작']+(it['끝']?' to '+it['끝']:''):'')]);
    if(it['건물']||it['방']) kv.push(['Where',placeText(it)+(it['상태']==='작년 기준 예상'?' (expected)':'')]);
    if(it['CES트랙']) kv.push(['CES track',it['CES트랙']]);
    if(it['우리트랙']) kv.push(['Our track',tracksOf(it).map(en).join(', ')]);
    if(it['패스']) kv.push(['Pass',en(it['패스'])]);
    if(it['상태']&&it['상태']!=='공개') kv.push(['Status',en(it['상태'])]);
    if(it['근거']) kv.push(['Source',en(it['근거'])]);
    if(it['확인일']) kv.push(['Checked',md(it['확인일'])]);
    box.innerHTML='<div class="d-info">'
      +(!isS&&it['요약']?'<p class="d-sum" lang="ko">'+esc(it['요약'])+'</p>':'')
      +(note?'<p class="d-note" lang="ko"><b lang="en">Note for the delegation</b>'+esc(note)+'</p>':'')
      +'<dl class="kv">'+kv.map(function(p){ return '<dt>'+esc(p[0])+'</dt><dd>'+esc(p[1])+'</dd>'; }).join('')+'</dl>'
      +'<div class="d-act">'+(url?'<a class="go" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Open the source page</a>':'')+'</div></div>'
      +(xy?'<figure><button type="button" class="mini" data-map aria-label="Open the full map"><img alt="" src="'+PLANS.city.src+'"><i class="dot"></i><span class="open">Open the full map</span></button>'
        +'<figcaption class="cap">'+esc(en(it['건물']))+(pl?'. The full map also has the hall plan.':'. The pin marks the building, not the room.')+'</figcaption></figure>':'');
    if(!xy){ box.classList.add('nomap'); return; }
    box.hidden=false;
    // show the building in the middle, without sliding the map past its own edge
    var view=box.querySelector('.mini'), W=view.clientWidth, H=view.clientHeight, z=W/760;
    var x=(xy[0]-DETAIL[0])*z, y=(xy[1]-DETAIL[1])*z;
    var tx=Math.max(W-DETAIL[2]*z,Math.min(0,W/2-x)), ty=Math.max(H-DETAIL[3]*z,Math.min(0,H/2-y));
    var img=view.querySelector('img'); img.style.width=(DETAIL[2]*z)+'px'; img.style.transform='translate('+tx+'px,'+ty+'px)';
    var dot=view.querySelector('.dot'); dot.style.left=(x+tx)+'px'; dot.style.top=(y+ty)+'px';
  }
  /* The full map: the whole venue area with every building named and this item's building marked.
     Where a hall plan exists, a second tab shows it */
  function openMap(it){
    var views=[{map:'city',xy:spot(it)}], pl=plan(it), cur=0;
    if(pl) views.push(pl);
    $('mapTitle').textContent=it['분류']==='세션'?it['원제목']:it['제목']; $('mapPlace').textContent=placeText(it);
    function show(){
      var v=views[cur], m=PLANS[v.map], vb=m.vb;
      $('mapImg').src=m.src; $('mapStage').style.setProperty('--r',vb[2]/vb[3]);
      $('mapPin').style.left=((v.xy[0]-vb[0])/vb[2]*100)+'%'; $('mapPin').style.top=((v.xy[1]-vb[1])/vb[3]*100)+'%';
      $('mapLabs').innerHTML=v.map!=='city'?'':Object.keys(PIN).filter(function(b){ return MAIN.indexOf(b)>=0||b===it['건물']; }).map(function(b){
        var here=b===it['건물'], p=here?v.xy:PIN[b];
        return '<span class="lab '+(here?'here':PIN[b][2])+'" style="left:'+((p[0]-vb[0])/vb[2]*100)+'%;top:'+((p[1]-vb[1])/vb[3]*100)+'%">'+esc(b)+'</span>';
      }).join('');
      $('mapTabs').innerHTML=views.length<2?'':views.map(function(x,i){ return '<button type="button" class="chip" data-i="'+i+'" aria-pressed="'+(i===cur)+'">'+esc(PLANS[x.map].name)+'</button>'; }).join('');
    }
    $('mapTabs').onclick=function(e){ var b=e.target.closest('button'); if(b){ cur=+b.dataset.i; show(); } };
    show(); $('mapDlg').showModal();
  }

  /* Hero numbers and the update log */
  function renderTop(){
    var today=todayIso(), t0=day(today);
    $('total').textContent=ITEMS.length;
    var list=ITEMS.filter(function(it){ return it['분류']==='기한'&&it['날짜']>=today&&TOP_HIDE.indexOf(it['id'])<0; }).sort(byTime).slice(0,1)
      .map(function(it){ return {d:it['날짜'],name:it['제목'],ko:true}; });
    if(today<DAYS[0]) list.push({d:DAYS[0],name:'CES opens'});
    $('dues').innerHTML=list.map(function(x){
      var dd=Math.round((day(x.d)-t0)/86400000);
      return '<li><b>'+(dd===0?'Today':dd+' day'+(dd>1?'s':''))+'</b><span'+(x.ko?' lang="ko"':'')+'>'+esc(x.name)+'</span>, '+esc(md(x.d))+'</li>';
    }).join('');
    $('stamp').textContent=LATEST?'Updated '+md(LATEST):'';
    var by={},keys=[];
    UPD.forEach(function(u){ if(!by[u['날짜']]){ by[u['날짜']]=[]; keys.push(u['날짜']); } by[u['날짜']].push(u['내용']); });
    $('log').innerHTML=keys.map(function(d){ return '<h4 lang="en">'+esc(wmd(d))+'</h4><ul>'+by[d].map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>'; }).join('');
    var btn=$('logBtn'), seen='';
    try{ seen=localStorage.getItem('ces27.seen')||''; }catch(e){}
    if(LATEST&&seen<LATEST) btn.classList.add('unseen');
    btn.addEventListener('click',function(){ $('logDlg').showModal(); btn.classList.remove('unseen'); try{ localStorage.setItem('ces27.seen',LATEST); }catch(e){} });
  }

  function wire(){
    var q=$('q'), timer, panel=$('panel'), fbtn=$('fbtn'), scrim=$('scrim');
    function setPanel(on){ panel.classList.toggle('on',on); scrim.classList.toggle('on',on); fbtn.setAttribute('aria-expanded',on?'true':'false'); }
    function reset(){ GROUPS.forEach(function(g){ state[g.key]=[]; }); state.q=''; writeHash(); render(); }
    function toList(){ if($('below').getBoundingClientRect().top>4) go($('below').offsetTop); }
    $('cue').addEventListener('click',toList);
    q.addEventListener('input',function(){ clearTimeout(timer); timer=setTimeout(function(){
      var was=state.q; state.q=q.value.trim();
      if(!was&&state.q) state.d='all';             // a search looks through every day, so a match on another day is not hidden
      writeHash(); renderTabs(); renderPanel(); renderPins(); renderList();
    },150); });
    $('tabs').addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b) return; state.d=b.dataset.d; writeHash(); render(); });
    $('tracks').addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b) return;
      if(b.dataset.t) toggle('t',b.dataset.t); else { state.t=[]; writeHash(); render(); } });
    $('filters').addEventListener('click',function(e){ var b=e.target.closest('.chip'); if(b&&!b.disabled) toggle(b.dataset.k,b.dataset.v); });
    function pick(e){ var b=e.target.closest('[data-b]'); if(!b) return; var adding=state.b.indexOf(b.dataset.b)<0; toggle('b',b.dataset.b); if(adding) toList(); }
    $('pins').addEventListener('click',pick); $('venues').addEventListener('click',pick);
    fbtn.addEventListener('click',function(){ setPanel(!panel.classList.contains('on')); });
    scrim.addEventListener('click',function(){ setPanel(false); });
    $('done').addEventListener('click',function(){ setPanel(false); toList(); });
    $('reset').addEventListener('click',reset);
    document.addEventListener('keydown',function(e){ if(e.key==='Escape') setPanel(false); });
    document.addEventListener('click',function(e){ if(e.target.closest('[data-reset]')) reset(); });
    var copy=$('copy');
    copy.addEventListener('click',function(){
      var done=function(){ copy.textContent='Link copied'; copy.classList.add('ok'); setTimeout(function(){ copy.textContent='Copy link to this view'; copy.classList.remove('ok'); },1600); };
      if(navigator.clipboard) navigator.clipboard.writeText(location.href).then(done,function(){ prompt('Copy this address',location.href); });
      else prompt('Copy this address',location.href);
    });
    $('list').addEventListener('click',function(e){
      var p=e.target.closest('[data-map]');
      if(p){ openMap(BY_ID[p.closest('.row').dataset.id]); return; }
      var b=e.target.closest('.row-b'); if(!b) return;
      var li=b.parentNode, box=li.querySelector('.detail'), on=box.hidden;
      box.hidden=!on; li.classList.toggle('open',on); b.setAttribute('aria-expanded',on?'true':'false');
      if(on) buildDetail(li,BY_ID[li.dataset.id]);
    });
    [].forEach.call(document.querySelectorAll('dialog'),function(d){
      d.addEventListener('click',function(e){ if(e.target===d||e.target.closest('[data-close]')) d.close(); });
    });
    window.addEventListener('hashchange',function(){ readHash(); render(); });
  }

  function load(path){ return fetch(path,{cache:'no-cache'}).then(function(r){ if(!r.ok) throw new Error(path+' '+r.status); return r.text(); }).then(parseCSV); }
  Promise.all([load('data/items.csv'),load('data/updates.csv')]).then(function(res){
    ITEMS=res[0]; ITEMS.forEach(function(it){ BY_ID[it['id']]=it; });
    UPD=res[1].sort(function(a,b){ return b['날짜'].localeCompare(a['날짜']); });
    LATEST=UPD.length?UPD[0]['날짜']:''; NEWFROM=LATEST?addDays(LATEST,-7):'9999';
    var today=todayIso(); if(DAYS.indexOf(today)>=0) DEFAULT_DAY=today;   // during CES, open on today
    readHash(); renderTop(); wire(); drift(); snap(); render();
  }).catch(function(err){
    $('list').innerHTML='<p class="empty">The data could not be loaded ('+esc(err.message)+'). Reload the page to try again.</p>';
  });
})();
