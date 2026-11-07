const icon = (name, cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.ledger}</svg>`;
const {button, field, select, heading, tabs, money, progress} = createUI(icon);
const navs = [['ledger','내역'],['budget','예산'],['savings','저축'],['manage','관리']];
const main = document.querySelector('#main');
let bulkMode=false, confirmBulk=false;
const selectedIds=new Set(), removedIds=new Set();
const visibleTransactions=()=>transactions.filter(t=>!removedIds.has(t.id));
const PAGE_SIZE=12;
let visibleLimit=PAGE_SIZE, listObserver=null, loadTimer=null;
const loadedTransactions=()=>transactions.slice(0,visibleLimit).filter(t=>!removedIds.has(t.id));
function stopInfiniteScroll(){listObserver?.disconnect();listObserver=null;clearTimeout(loadTimer);loadTimer=null;}
function updateListEnd(){
 const end=document.querySelector('#list-end');if(!end)return;
 end.textContent=visibleLimit>=transactions.length?`마지막 내역입니다 · ${visibleTransactions().length}건`:`${loadedTransactions().length} / ${visibleTransactions().length}건`;
 end.setAttribute('aria-busy','false');
}
function setupInfiniteScroll(){
 stopInfiniteScroll();const end=document.querySelector('#list-end');if(!end)return;updateListEnd();
 if(bulkMode||visibleLimit>=transactions.length)return;
 listObserver=new IntersectionObserver(entries=>{
  if(!entries.some(entry=>entry.isIntersecting)||loadTimer)return;
  listObserver.disconnect();end.textContent='내역 불러오는 중…';end.setAttribute('aria-busy','true');
  loadTimer=setTimeout(()=>{
   loadTimer=null;if(!end.isConnected||bulkMode)return;
   const start=visibleLimit;visibleLimit=Math.min(visibleLimit+PAGE_SIZE,transactions.length);
   const rows=transactions.slice(start,visibleLimit).filter(t=>!removedIds.has(t.id));
   document.querySelector('.ledger-table tbody')?.insertAdjacentHTML('beforeend',rows.map(transactionRow).join(''));
   updateListEnd();if(visibleLimit<transactions.length)listObserver.observe(end);
  },200);
 },{rootMargin:'0px 0px 80px 0px'});
 listObserver.observe(end);
}
function selectionBar(){return bulkMode?`<div class="selection-bar" role="region" aria-label="선택 삭제"><strong>${selectedIds.size}건 선택</strong><span>${confirmBulk?'선택한 샘플 내역을 삭제할까요? 새로고침하면 복원됩니다.':'삭제할 내역을 선택하세요.'}</span><div>${confirmBulk?button('삭제 확인','bulk-confirm',true)+button('돌아가기','bulk-back'):`<button class="primary" data-action="bulk-delete" ${selectedIds.size?'':'disabled'}>선택 삭제</button>`}${button('취소','bulk-toggle')}</div></div>`:'';}
let panelAnchor = null;
let panelTrigger = null;
let page = 'ledger', view = 'list', ledgerTab = '내역', manageTab = '고정지출';
let selectedTransaction = 0;
let selectedGoal = '여행 자금';
let selectedPayment = null;
const paymentMethods = [
  {name:'생활비 카드',type:'신용카드',paymentDay:14,color:'forest'},
  {name:'교통 카드',type:'체크카드',paymentDay:null,color:'navy'},
  {name:'현금',type:'현금',paymentDay:null,color:'clay'}
];
const paymentRows = method => visibleTransactions().filter(t=>!t.income && t.method===method);
const sampleTotal = method => paymentRows(method).reduce((sum,t)=>sum+Number(t.money.replaceAll(',','')),0).toLocaleString('ko-KR');
function paymentDetail(index) {
  selectedPayment=index;
  const method=paymentMethods[index], rows=paymentRows(method.name);
  openPanel(method.name,`<span class="pill">${method.type}</span><dl><dt>결제일</dt><dd>${method.paymentDay?`매월 ${method.paymentDay}일`:method.type==='체크카드'?'즉시 출금':'해당 없음'}</dd><dt>조회 기간</dt><dd>2026년 11월</dd><dt>샘플 내역 합계</dt><dd>${sampleTotal(method.name)}원 · ${rows.length}건</dd></dl>${method.paymentDay?'<p class="form-hint">등록한 정기 결제일입니다. 실제 출금일은 카드사 기준을 확인해 주세요.</p>':''}<h3>사용 내역</h3><div class="payment-transactions">${rows.length?rows.map(t=>`<button class="transaction" data-detail="${t.id}"><span class="category-icon ${t.color}">${icon(t.icon)}</span><span class="transaction-title"><strong>${t.title}</strong><small>${t.date} · ${t.category}</small></span><span class="transaction-amount">${t.money}<small>원</small></span></button>`).join(''):'<div class="empty"><p>이 결제수단의 샘플 내역이 없습니다.</p></div>'}</div>`,`${button('닫기','close')}${button('결제수단 수정','payment-edit',true)}`);
}
let toastTimer;
const transactions = [
  {id:0, day:'오늘', date:'11월 7일 토요일', title:'점심, 따뜻한 한 끼', category:'식비', method:'생활비 카드', money:'12,000', icon:'food', color:'peach', memo:'회사 근처에서 먹은 김치찌개'},
  {id:1, day:'오늘', date:'11월 7일 토요일', title:'오후의 커피', category:'카페·간식', method:'생활비 카드', money:'4,500', icon:'coffee', color:'sand', memo:'산책하다 만난 작은 카페'},
  {id:2, day:'어제', date:'11월 6일 금요일', title:'일주일의 장보기', category:'생활·쇼핑', method:'생활비 카드', money:'58,200', icon:'bag', color:'lavender', memo:'우유, 계란, 채소와 과일'},
  {id:3, day:'어제', date:'11월 6일 금요일', title:'지하철 교통비', category:'교통', method:'교통 카드', money:'3,000', icon:'transit', color:'blue', memo:''},
  {id:4, day:'11월 5일', date:'11월 5일 목요일', title:'11월 월급', category:'급여', method:'계좌이체', money:'3,200,000', icon:'budget', color:'mint', income:true, memo:'이번 달도 수고했어요.'},
  {id:5, day:'11월 5일', date:'11월 5일 목요일', title:'책 한 권의 시간', category:'문화·여가', method:'생활비 카드', money:'18,000', icon:'ledger', color:'sand', memo:''}
];
// Additional local fixtures for scrolling; no request or persistent storage.
transactions.push(...Array.from({length:24},(_,i)=>({
 id:i+6,day:`11월 ${4-Math.floor(i/6)}일`,date:`11월 ${4-Math.floor(i/6)}일`,
 title:`${['식사','카페','장보기','간식','점심','저녁'][i%6]} ${i+1}`,
 category:'식비',method:'생활비 카드',money:((i+1)*1000).toLocaleString('ko-KR'),
 icon:'food',color:'peach',memo:''
})));
function notify(message='퍼블리싱 미리보기입니다. 실제 데이터는 변경되지 않아요.') { clearTimeout(toastTimer); const el=document.querySelector('#toast'); el.textContent=message; el.classList.add('visible'); toastTimer=setTimeout(()=>el.classList.remove('visible'),3500); }
function render() {
  const active=document.activeElement;
  const focusAttribute=['data-ledger-tab','data-manage-tab','data-view','data-action','href'].find(attr=>active?.hasAttribute(attr));
  const focusSelector=focusAttribute?`${active.tagName.toLowerCase()}[${focusAttribute}="${CSS.escape(active.getAttribute(focusAttribute))}"]`:null;
  stopInfiniteScroll();
  destroyInputWidgets(main);
  document.querySelector('#navigation').innerHTML=navs.map(([id,label])=>`<a href="#${id}" class="nav-item ${page===id?'active':''}" ${page===id?'aria-current="page"':''}>${icon(id)}<span>${label}</span>${page===id?'<i></i>':''}</a>`).join('');
  main.innerHTML=page==='ledger'?ledger():page==='budget'?budget():page==='savings'?savings():manage();
  setupInfiniteScroll();
  const all=document.querySelector('[data-action="bulk-all"]');
  if(all)all.indeterminate=selectedIds.size>0&&selectedIds.size<loadedTransactions().length;
  if(focusSelector)document.querySelector(focusSelector)?.focus({preventScroll:true});
}
function summary() { return `<section class="summary" aria-label="이번 달 요약"><div><span>이번 달 지출 <i class="dot orange"></i></span>${money('684,200')}<small><b>↓ 12.4%</b> 지난달 같은 기간보다</small></div><div><span>남은 금액</span>${money('2,515,800')}<small>수입 − 지출</small></div><div><span>남은 예산</span>${money('515,800')}<small>전체 예산 1,200,000원 · <a href="#budget">예산 보기 →</a></small></div></section>`; }
function ledger() { return `${heading('내역',button('내역 추가','add',true,'plus'))}
  <div class="month-row"><div class="month"><button class="icon-button" data-action="sample" aria-label="이전 달">${icon('arrowLeft')}</button><h2>2026년 11월</h2><button class="icon-button" data-action="sample" aria-label="다음 달">${icon('arrow')}</button><span class="pill">이번 달</span></div><span class="quiet">11.01 — 11.30</span></div>${summary()}
  <div class="content-grid"><section class="card ledger-card"><div class="card-tabs">${tabs(['내역','통계'],ledgerTab,'ledger-tab')}</div>${ledgerTab==='통계'?statistics():`<div class="toolbar"><label class="search">${icon('search')}<input aria-label="내역 검색" placeholder="내역명·메모 검색" data-preview-input></label><button class="button compact" data-action="filters">${icon('filter')}<span>필터</span></button><div class="view-toggle"><button data-view="list" class="${view==='list'?'selected':''}" aria-label="목록 보기">${icon('ledger')}</button><button data-view="calendar" class="${view==='calendar'?'selected':''}" aria-label="달력 보기">${icon('calendar')}</button></div><button class="button bulk-toggle ${bulkMode?'selected':''}" data-action="bulk-toggle" aria-label="여러 내역 삭제" aria-pressed="${bulkMode}">${icon('trash')}</button></div>${selectionBar()}<div id="filter-area" hidden><div class="filters">${select('거래 유형',['모든 유형','지출','수입'])}${select('카테고리',['모든 카테고리','식비','교통'])}${button('적용 미리보기','sample')}</div></div>${view==='calendar'?calendar():transactionList()}`}</section></div>`; }
function transactionRow(t) {return `<tr data-detail="${t.id}" class="${selectedIds.has(t.id)?'row-selected':''}"><td><time datetime="2026-11-${t.date.match(/11월 (\d+)일/)[1].padStart(2,'0')}">11.${t.date.match(/11월 (\d+)일/)[1].padStart(2,'0')}</time></td><td>${t.category}</td><td class="ledger-title">${t.title}<small class="mobile-meta"><span class="mobile-category">${t.category} · </span>${t.method}</small></td><td class="ledger-money ${t.income?'income':''}">${t.income?'+':'−'}${t.money}<small>원</small></td><td>${t.method}</td><td>${bulkMode?`<input type="checkbox" aria-label="${t.title} 선택" ${selectedIds.has(t.id)?'checked':''}>`:`<button class="row-detail-button" aria-label="${t.title} 자세히 보기" aria-expanded="false">${icon('arrow')}</button>`}</td></tr>`;}
function transactionList() {
 return `<div class="ledger-table-wrap"><table class="ledger-table"><caption class="sr-only">2026년 11월 거래 내역</caption><thead><tr><th scope="col">날짜</th><th scope="col">카테고리</th><th scope="col">내역명</th><th scope="col">금액</th><th scope="col">결제수단</th><th scope="col">${bulkMode?`<input type="checkbox" data-action="bulk-all" aria-label="전체 내역 선택" ${selectedIds.size===loadedTransactions().length&&selectedIds.size?'checked':''}>`:'<span class="sr-only">상세</span>'}</th></tr></thead><tbody>${loadedTransactions().map(transactionRow).join('')}</tbody></table></div><div id="list-end" class="list-end" aria-live="polite" aria-busy="false"></div>`;
}
function calendar() { return `<div class="calendar"><div class="calendar-week">${['월','화','수','목','금','토','일'].map(d=>`<span>${d}</span>`).join('')}</div><div class="calendar-days">${Array.from({length:42},(_,i)=>{const d=i-5, inMonth=d>=1&&d<=30,month=d<1?10:d>30?12:11,day=d<1?26+i:d>30?d-30:d;return `<button class="${d===7?'current':''} ${!inMonth?'muted-day':''}" data-action="${inMonth?'sample':'noop'}" ${!inMonth?'disabled':''}><span><span class="sr-only">${month}월 </span>${day}<span class="sr-only">일</span></span>${[5,6,7,11,15].includes(d)?`<small class="${d===5?'income':''}">${{5:'+320만',6:'−6.1만',7:'−1.7만',11:'예정',15:'예정'}[d]}</small>`:''}</button>`}).join('')}</div></div>`; }
function statistics() { return `<div class="statistics"><div class="section-title"><div><h3>하루하루의 소비</h3><p>11월의 지출 흐름</p></div><span class="pill">일별</span></div><div class="bar-chart" role="img" aria-label="샘플 일별 지출 막대 차트"><div class="chart-bars">${[30,48,25,64,35,86,42,0,0,0,0,0,0,0].map((v,i)=>`<div><span style="height:${v}%" class="${i===6?'highlight':''}"></span><small>${i+1}</small></div>`).join('')}</div></div><div class="section-title"><h3>어디에 가장 많이 썼을까요?</h3><span class="quiet">환불 전 지출 비중</span></div>${[['식비','248,000','36', 'peach'],['생활·쇼핑','182,200','27','lavender'],['주거·통신','154,000','22','blue'],['그 외','100,000','15','sand']].map(([n,a,p,c])=>`<div class="stat-row"><span class="dot ${c}"></span><strong>${n}</strong><span>${a}원</span><b>${p}%</b></div>`).join('')}<p class="sample-caption">화면 확인을 위한 예시 통계입니다.</p></div>`; }
function budget() { return `${heading('예산',button('예산 설정','budget-form',true,'plus'))}<div class="month-row"><div class="month"><button class="icon-button" data-action="sample" aria-label="이전 달">${icon('arrowLeft')}</button><h2>2026년 11월</h2><button class="icon-button" data-action="sample" aria-label="다음 달">${icon('arrow')}</button></div>${button('다른 달에서 복사','budget-copy')}</div><section class="budget-hero"><div><span class="eyebrow">이번 달 남은 예산</span><h2>515,800<small>원</small></h2></div><div class="budget-hero-progress"><div><span>684,200원 사용</span><strong>57%</strong></div>${progress(57)}<div><span>전체 예산</span><span>1,200,000원</span></div></div></section><div class="section-heading"><h2>카테고리별 예산</h2></div><div class="cards-grid">${[['식비','food','peach','248,000','400,000',62],['생활·쇼핑','bag','lavender','182,200','300,000',61],['주거·통신','home','blue','154,000','200,000',77],['카페·간식','coffee','sand','45,000','100,000',45],['교통','transit','mint','30,000','100,000',30],['문화·여가','ledger','peach','25,000','100,000',25]].map(([n,ico,c,a,b,p])=>`<section class="card category-budget"><div class="section-title"><span class="category-icon ${c}">${icon(ico)}</span>${button('수정','budget-form')}</div><h3>${n}</h3>${money(a)}<p>목표 ${b}원</p>${progress(p)}<div class="progress-caption"><span>${p}% 사용</span><a href="#ledger">내역 보기 →</a></div></section>`).join('')}</div>`; }
function savings() { return `${heading('저축 목표',button('목표 만들기','goal-form',true,'plus'))}<div class="saving-banner"><span class="plant-large">${icon('savings')}</span><div><span class="eyebrow">총 저축액</span><h2>2,850,000<small>원</small></h2></div></div><div class="section-heading"><h2>나의 저축 목표 <span class="count">3</span></h2></div><div class="cards-grid goals">${[['여행 자금','다음 여름, 제주에서 쉬어가기','1,200,000','2,000,000',60,'2027.06.30','blue','여행'],['비상금','예상하지 못한 순간을 위한 여유','900,000','3,000,000',30,'2027.12.31','mint','여유'],['노트북 구입','더 좋은 도구로 새로운 시작','250,000','1,500,000',17,'2027.03.31','sand','일상']].map(([n,sub,a,b,p,date,c,tag],i)=>`<button class="card goal-card" data-goal="${i}"><div class="goal-art ${c}"><span class="goal-tag">${tag}</span>${i===0?'<div class="sun"></div><div class="sea sea-back"></div><div class="sea"></div>':i===1?'<div class="coin c1">₩</div><div class="coin c2">₩</div><div class="coin c3">₩</div>':'<div class="laptop"></div>'}</div><div class="goal-body"><h3>${n}</h3>${money(a)}<span class="quiet"> / ${b}원</span>${progress(p)}<div class="progress-caption"><strong>${p}% 모았어요</strong><span>${date}까지</span></div></div></button>`).join('')}</div><details class="completed-goals"><summary><h2>완료된 목표 <span class="count">1</span></h2>${icon('arrow','completed-chevron')}</summary><div class="completed-goal-list"><article class="completed-goal"><span class="category-icon mint">${icon('check')}</span><div class="completed-goal-title"><h3>자전거 구입</h3><p>목표 500,000원 · 100% 달성</p></div>${money('500,000')}<span class="pill">완료</span></article></div></details>`; }
function manage() { return `${heading('관리')}<section class="card management">${tabs(['고정지출','카테고리','결제수단','백업·복원'],manageTab,'manage-tab')}<div class="management-body">${manageContent()}</div></section>`; }
function manageContent() {
 if(manageTab==='고정지출') return `<div class="section-title"><div><h2>반복되는 지출</h2></div>${button('고정지출 추가','recurring-form',true,'plus')}</div><div class="recurring-summary"><span>매월 예정된 고정지출</span>${money('715,000')}<span class="pill">활성 3개</span></div>${[['월세','매월 1일','650,000','home','blue'],['휴대폰 요금','매월 11일','48,000','repeat','mint'],['넷플릭스','매월 15일','17,000','ledger','peach']].map(([n,d,a,i,c])=>`<button class="transaction" data-recurring="${n}"><span class="category-icon ${c}">${icon(i)}</span><span class="transaction-title"><strong>${n}</strong><small>${d} · 생활비 카드</small></span><span class="transaction-amount">${a}<small>원</small></span>${icon('arrow')}</button>`).join('')}`;
 if(manageTab==='카테고리') return `<div class="section-title"><div><h2>카테고리</h2></div>${button('카테고리 추가','category-form',true,'plus')}</div><div class="mini-tabs"><button class="selected" data-action="sample">지출</button><button data-action="sample">수입</button><button data-action="archive">보관</button></div><div class="category-grid">${[['식비','food','peach'],['카페·간식','coffee','sand'],['교통','transit','blue'],['주거·통신','home','mint'],['생활·쇼핑','bag','lavender'],['문화·여가','ledger','peach']].map(([n,i,c])=>`<button data-action="category-form"><span class="category-icon ${c}">${icon(i)}</span><strong>${n}</strong>${icon('arrow')}</button>`).join('')}</div>`;
 if(manageTab==='결제수단') return `<div class="section-title"><div><h2>결제수단</h2><p>카드를 선택하면 결제일과 해당 카드의 내역을 확인할 수 있습니다.</p></div>${button('결제수단 추가','payment-form',true,'plus')}</div><div class="cards-grid payment-cards">${paymentMethods.map((m,i)=>`<button class="payment-card ${m.color}" data-payment="${i}">${icon('budget')}<span>${m.type}</span><h3>${m.name}</h3><p class="payment-date">${m.paymentDay?`결제일 · 매월 ${m.paymentDay}일`:m.type==='체크카드'?'즉시 출금':'결제일 해당 없음'}</p><small>11월 샘플 내역 합계</small>${money(sampleTotal(m.name))}<span class="payment-link">사용 내역 ${paymentRows(m.name).length}건 보기 →</span></button>`).join('')}</div>`;
 return `<div class="section-title"><div><h2>백업·복원</h2><p>기록은 이 브라우저에 저장되니, 가끔 파일로 보관해 주세요.</p></div></div><div class="backup-grid"><section><span class="category-icon mint">${icon('download')}</span><h3>내 기록 내보내기</h3><p>가계부 전체를 JSON 파일로 보관해요.</p>${button('JSON 내보내기','sample',true,'download')}</section><section><span class="category-icon sand">${icon('repeat')}</span><h3>이전 기록 가져오기</h3><p>백업 파일로 현재 데이터를 전체 대체해요.</p>${button('복원 미리보기','restore')}</section></div><div class="info-note">현재는 UI 미리보기예요. 파일을 읽거나 내보내지 않으며, 데이터는 저장되지 않아요.</div>`;
}
function removeInlinePanel() {
 const current=document.querySelector('#inline-panel');
 if(current)destroyInputWidgets(current);
 if(current) (current.closest('.inline-detail-row')||current).remove();
 document.querySelectorAll('.row-detail-button[aria-expanded="true"]').forEach(el=>el.setAttribute('aria-expanded','false'));
}
function resizeDetailRow(){
 const cell=document.querySelector('.inline-detail-row>td');
 if(cell)cell.colSpan=[...cell.closest('table').querySelectorAll('thead th')].filter(th=>getComputedStyle(th).display!=='none').length;
}
for(const query of ['(max-width:767px)','(max-width:1199px)'])matchMedia(query).addEventListener('change',resizeDetailRow);
function closePanel() {
  removeInlinePanel();
  if(panelTrigger?.isConnected)panelTrigger.focus({preventScroll:true});
  panelAnchor=null;
}
function openPanel(title,body,footer='',editor=false) {
  removeInlinePanel();
  const section=document.createElement('section');
  section.id='inline-panel';
  section.className=`panel inline-panel${editor?' transaction-editor':''}`;
  section.setAttribute('aria-labelledby','inline-title');
  if(editor){section.removeAttribute('aria-labelledby');section.setAttribute('aria-label',title);}
  section.innerHTML=`<div id="panel-content">${editor?'':`<div class="panel-header"><h2 id="inline-title" tabindex="-1">${title}</h2><button class="icon-button" data-action="close" aria-label="닫기">${icon('close')}</button></div>`}<div class="panel-body">${body}</div>${footer?`<div class="panel-footer">${footer}</div>`:''}</div>`;
  const toolbar=document.querySelector('.ledger-card .toolbar');
  if(editor && title==='내역 추가' && toolbar)toolbar.insertAdjacentElement('afterend',section);
  else if(panelAnchor?.isConnected && panelAnchor.matches('tr')){
   const row=document.createElement('tr');row.className='inline-detail-row';
   const cell=document.createElement('td');cell.colSpan=[...panelAnchor.closest('table').querySelectorAll('thead th')].filter(th=>getComputedStyle(th).display!=='none').length;row.append(cell);cell.append(section);
   panelAnchor.insertAdjacentElement('afterend',row);
   panelAnchor.querySelector('.row-detail-button')?.setAttribute('aria-expanded','true');
  }
  else if(panelAnchor?.isConnected)panelAnchor.insertAdjacentElement('afterend',section);
  else (document.querySelector('.management-body')||document.querySelector('.cards-grid')||main).prepend(section);
  section.querySelector('input:not([readonly]),select,#inline-title')?.focus({preventScroll:true});
  section.scrollIntoView({block:'nearest',behavior:'instant'});
  initInputWidgets(section);
}
const formFooter = ()=>`${button('저장 미리보기','sample',true)}${button('취소','close')}`;
function openForm(type) {
 if(type==='add') {ledgerTab='내역';view='list';panelAnchor=null;render();panelTrigger=document.querySelector('[data-action="add"]');}
 const memo=`<label class="field"><span>메모 <small>선택</small></span><textarea placeholder="메모 입력" rows="3">${type==='edit'?transactions[selectedTransaction].memo:''}</textarea></label>`;
 const demo='<p class="form-hint">샘플 화면입니다. 입력한 내용은 저장되지 않아요.</p>';
 let title,body; const current=transactions[selectedTransaction];
 if(type==='add'||type==='edit') {
   const editing=type==='edit', income=editing&&current.income;
   const date=editing?`2026-11-${current.date.match(/11월 (\d+)일/)[1].padStart(2,'0')}`:'2026-11-07';
   title=editing?'내역 수정':'내역 추가';
   body=`${field('날짜','date',date)}${select('수입/지출',['지출','수입'],income?'수입':'지출')}${field('내역명','text',editing?current.title:'','내역명 입력')}${field('금액','number',editing?current.money.replaceAll(',',''):'','0원')}${select('카테고리',['선택 안 함','식비','카페·간식','교통','생활·쇼핑','문화·여가','급여'],editing?current.category:'')}${select('결제수단',['선택 안 함','생활비 카드','교통 카드','현금','계좌이체'],editing?current.method:'')}`;
 }
 else if(type==='refund'){title='환불 기록';body=`${field('내역명','text',current.title,'',true)}${field('환불 가능액','text',`${current.money}원`,'',true)}${field('환불일','date','2026-11-07')}${field('환불 금액','number','','0원')}`;}
 else if(type==='budget-form'){title='11월 예산 설정';body=`${field('전체 예산','number','1200000')}${select('카테고리',['식비','생활·쇼핑','주거·통신'])}${field('카테고리 한도','number','400000')}<div class="info-note">한도 합계가 전체 예산보다 커도 설정할 수 있어요.</div>`;}
 else if(type==='budget-copy'){title='다른 달 예산 복사';body=`${field('가져올 월','month','2026-10')}<div class="info-note">2026년 11월로 복사해요. 기존 예산이 있다면 새 설정으로 바뀌어요.</div><dl><dt>전체 예산</dt><dd>1,200,000원</dd><dt>카테고리 한도</dt><dd>6개</dd></dl>`;}
 else if(type==='goal-form'){title='저축 목표 추가';body=`${field('목표명','text','','목표명 입력')}${field('목표 금액','number','','0원')}${field('시작일','date','2026-11-07')}${field('목표일','date','2027-06-30')}`;}
 else if(type==='saving-entry'){title='저축·인출 기록';body=`<div class="info-note">${selectedGoal}</div>${select('기록 유형',['저축','인출'])}${field('날짜','date','2026-11-07')}${field('금액','number','','0원')}${memo}`;}
 else if(type==='recurring-form'){title='고정지출 추가';body=`${field('내역명','text','','예: 휴대폰 요금')}${field('기본 금액','number','','0원')}${select('반복 주기',['매월','매주','매일','매년'])}${field('시작일','date','2026-11-11')}${field('종료일 · 선택','date')}${select('카테고리',['주거·통신','문화·여가','식비'])}${select('결제수단',['생활비 카드','현금'])}${memo}`;}
 else if(type==='category-form'){title='카테고리 설정';body=`${field('이름','text','','카테고리 이름')}${select('유형',['지출','수입'])}<div class="info-note">사용 중인 항목은 보관해서 이전 내역을 유지할 수 있어요.</div>`;}
 else {
   const method=type==='payment-edit'?paymentMethods[selectedPayment]:null;
   title='결제수단 설정';
   body=`${field('이름','text',method?.name||'','예: 생활비 카드')}${select('유형',['기타','신용카드','체크카드','현금','계좌이체','간편결제'],method?.type||'기타')}<div id="payment-day-field" ${method?.type==='신용카드'?'':'hidden'}>${select('결제일 · 선택',['미설정',...Array.from({length:31},(_,i)=>`매월 ${i+1}일`)],method?.paymentDay?`매월 ${method.paymentDay}일`:'미설정')}<p class="form-hint">카드에 등록된 정기 결제일을 선택하세요. 청구액 계산이나 자동 납부는 하지 않습니다.</p></div>`;
 }
 const editor=type==='add'||type==='edit'||type==='refund';
 const actions=type==='add'?`${button('추가','sample',true)}${button('취소','close')}`:type==='refund'?`${button('환불','sample',true)}${button('취소','close')}`:formFooter();
 openPanel(title,`<form onsubmit="return false">${body}${editor?`<div class="inline-form-actions"><label class="field inline-memo"><span class="sr-only">메모</span><input type="text" placeholder="메모 입력 (선택)"></label>${actions}</div>`:''}${demo}</form>`,editor?'':actions,editor);
 if(editor)document.querySelector('.inline-memo input').value=type==='edit'?current.memo||'':'';
 if(type==='refund')document.querySelector('#inline-panel').classList.add('refund-editor');
}
function details(id) {
 selectedTransaction=id; const t=transactions[id];
 openPanel('내역 정보',`<dl class="transaction-facts memo-only"><dt>메모</dt><dd class="fact-memo">${t.memo||'없음'}</dd></dl>`,`${button('삭제','delete')}${button('수정','edit')}${!t.income?button('환불','refund'):''}`);
 const region=document.querySelector('#inline-panel');
 region.classList.add('transaction-detail');
 region.setAttribute('aria-label',`${t.title} 상세 정보`);
 region.removeAttribute('aria-labelledby');
 region.querySelector('.panel-header').remove();
 if(panelTrigger?.isConnected)panelTrigger.focus({preventScroll:true});
}

document.addEventListener('click',e=>{
 const trigger=e.target.closest('button');
 if(trigger && !trigger.closest('#inline-panel')) {
   panelTrigger=trigger;
   panelAnchor=trigger.closest('tr[data-detail], .transaction')||null;
 }
 const payment=e.target.closest('[data-payment]');if(payment){paymentDetail(Number(payment.dataset.payment));return;}
 const detail=e.target.closest('[data-detail]'); if(detail){
   const id=Number(detail.dataset.detail);
   if(bulkMode&&detail.closest('.ledger-table')){selectedIds.has(id)?selectedIds.delete(id):selectedIds.add(id);confirmBulk=false;render();document.querySelector(`[data-detail="${id}"] input`)?.focus({preventScroll:true});return;}
   if(document.querySelector('#inline-panel.transaction-detail') && selectedTransaction===id){closePanel();return;}
   panelAnchor=detail;panelTrigger=detail.querySelector('button')||detail;details(id);return;
 }
 const tab=e.target.closest('[data-ledger-tab]'); if(tab){ledgerTab=tab.dataset.ledgerTab;bulkMode=false;confirmBulk=false;selectedIds.clear();render();return;}
 const mt=e.target.closest('[data-manage-tab]'); if(mt){manageTab=mt.dataset.manageTab;render();return;}
 const v=e.target.closest('[data-view]'); if(v){view=v.dataset.view;bulkMode=false;confirmBulk=false;selectedIds.clear();render();return;}
 const fk=e.target.closest('[data-form-kind]'); if(fk){fk.parentElement.querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b===fk));return;}
 const goal=e.target.closest('[data-goal]'); if(goal){const names=['여행 자금','비상금','노트북 구입'];selectedGoal=names[Number(goal.dataset.goal)];openPanel(selectedGoal,`<div class="detail-intro"><span class="category-icon mint">${icon('savings')}</span></div><div class="info-note">저축 내역 화면 미리보기</div><div class="transaction"><span class="category-icon mint">${icon('plus')}</span><div class="transaction-title"><strong>이번 달 저축</strong><small>2026.11.05</small></div><strong class="income">+200,000원</strong></div>`,`${button('목표 수정','goal-form')}${button('저축 기록','saving-entry',true)}`);return;}
 const recurring=e.target.closest('[data-recurring]');if(recurring){openPanel(recurring.dataset.recurring,`<span class="pill">활성 · 매월 반복</span><dl><dt>결제수단</dt><dd>생활비 카드</dd><dt>종료일</dt><dd>계속 반복</dd></dl><h3>회차 내역</h3><div class="transaction"><span class="date-box">11<small>일</small></span><div class="transaction-title"><strong>이번 달 회차</strong><small>예정 · 기본 금액</small></div>${button('건너뛰기','sample')}</div><div class="info-note">개별 회차 변경은 이후 회차에 영향을 주지 않아요.</div>`,`${button('중지','sample')}${button('반복 수정','recurring-form',true)}`);return;}
 const target=e.target.closest('[data-action]');if(!target)return; const action=target.dataset.action;
 if(action==='bulk-toggle'){bulkMode=!bulkMode;confirmBulk=false;selectedIds.clear();view='list';ledgerTab='내역';render();}
 else if(action==='bulk-all'){const rows=loadedTransactions();if(selectedIds.size===rows.length)selectedIds.clear();else rows.forEach(t=>selectedIds.add(t.id));confirmBulk=false;render();}
 else if(action==='bulk-delete'){if(selectedIds.size){confirmBulk=true;render();}}
 else if(action==='bulk-back'){confirmBulk=false;render();}
 else if(action==='bulk-confirm'){const count=selectedIds.size;selectedIds.forEach(id=>removedIds.add(id));selectedIds.clear();bulkMode=false;confirmBulk=false;render();notify(`${count}건을 샘플 목록에서 삭제했습니다. 새로고침하면 복원됩니다.`);}
 else if(action==='close')closePanel();
 else if(action==='sample')notify();
 else if(action==='noop')return;
 else if(action==='filters'){const f=document.querySelector('#filter-area');f.hidden=!f.hidden;target.setAttribute('aria-expanded',String(!f.hidden));}
 else if(action==='delete')openPanel('이 내역을 삭제할까요?',`<p>삭제한 내역은 개별 복구할 수 없어요.</p><div class="info-note">확인 화면 미리보기이며 실제 내역은 삭제되지 않습니다.</div>`,`${button('취소','close')}${button('삭제 미리보기','sample',true)}`);
 else if(action==='archive')openPanel('보관한 항목',`<div class="empty"><span>${icon('ledger')}</span><h3>아직 보관한 항목이 없어요.</h3></div>`,button('돌아가기','close'));
 else if(action==='welcome')openPanel('미리보기 안내',`<div class="detail-intro"><span class="category-icon mint">${icon('savings')}</span><p>지금은 화면 구성을 살펴보는 UI 미리보기예요.</p></div><div class="info-note">샘플 데이터만 표시합니다.<br>입력·저장·검색·백업 기능은 아직 연결하지 않았어요.</div>`,button('둘러보기','close',true));
 else if(action==='restore')openPanel('복원 내용 미리보기',`<span class="pill">샘플 파일 · JSON v1</span><dl><dt>거래</dt><dd>현재 32개 → 48개</dd><dt>환불</dt><dd>현재 0개 → 2개</dd><dt>예산</dt><dd>현재 1개월 → 3개월</dd><dt>자동 확정 예정</dt><dd>2개 · 65,000원</dd></dl><div class="info-note">실제 복원 시 기존 데이터를 전체 대체해요. 현재는 파일을 사용하지 않는 미리보기입니다.</div>`,`${button('취소','close')}${button('전체 대체 미리보기','sample',true)}`);
 else openForm(action);
});
document.addEventListener('change',e=>{
 if(e.target.matches('select[aria-label="유형"]')){
   const field=document.querySelector('#payment-day-field');
   if(field)field.hidden=e.target.value!=='신용카드';
 }
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('#inline-panel'))closePanel();});
window.addEventListener('hashchange',()=>{bulkMode=false;confirmBulk=false;selectedIds.clear();const next=location.hash.slice(1);page=navs.some(n=>n[0]===next)?next:'ledger';render();window.scrollTo(0,0);});
page=navs.some(n=>n[0]===location.hash.slice(1))?location.hash.slice(1):'ledger';render();
