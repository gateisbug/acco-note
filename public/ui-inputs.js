/* Shared integer-won fields and local Korean calendar widgets. */
function formatMoneyInput(input) {
  const position=input.selectionStart??input.value.length;
  const digitsBefore=input.value.slice(0,position).replace(/\D/g,'').length;
  const digits=input.value.replace(/\D/g,'');
  const formatted=digits.replace(/\B(?=(\d{3})+(?!\d))/g,',');
  input.dataset.rawValue=digits;
  if(input.value===formatted)return;
  input.value=formatted;
  let caret=0,seen=0;
  while(caret<formatted.length&&seen<digitsBefore){if(/\d/.test(formatted[caret]))seen++;caret++;}
  if(document.activeElement===input)input.setSelectionRange(caret,caret);
}
document.addEventListener('beforeinput',event=>{
  if(event.target.matches('[data-money]')&&event.data&&!/^\d+$/.test(event.data)&&event.inputType==='insertText')event.preventDefault();
});
document.addEventListener('input',event=>{
  if(event.target.matches('[data-money]')&&!event.isComposing)formatMoneyInput(event.target);
});
document.addEventListener('paste',event=>{
  const input=event.target;
  if(!input.matches('[data-money]'))return;
  event.preventDefault();
  const digits=(event.clipboardData?.getData('text')||'').replace(/[\s,₩원]/g,'');
  if(!/^\d+$/.test(digits))return;
  input.setRangeText(digits,input.selectionStart,input.selectionEnd,'end');
  input.dispatchEvent(new Event('input',{bubbles:true}));
});
document.addEventListener('compositionend',event=>{
  if(event.target.matches('[data-money]'))formatMoneyInput(event.target);
});
function destroyInputWidgets(root=document){root.querySelectorAll('[data-date],[data-month]').forEach(input=>input._flatpickr?.destroy());}
function initInputWidgets(root){
  root.querySelectorAll('[data-money]').forEach(formatMoneyInput);
  root.querySelectorAll('[data-date],[data-month]').forEach(input=>{
    if(input._flatpickr)return;
    const month=input.hasAttribute('data-month');
    flatpickr(input,{
      locale:'ko',dateFormat:month?'Y-m':'Y-m-d',ariaDateFormat:'Y년 n월 j일',
      disableMobile:true,allowInput:false,animate:false,monthSelectorType:'static',
      prevArrow:icon('arrowLeft'),nextArrow:icon('arrow'),
      plugins:month?[new monthSelectPlugin({dateFormat:'Y-m',altFormat:'Y년 n월'})]:[],
      onReady:(_,__,instance)=>{
        input.setAttribute('role','combobox');input.setAttribute('aria-haspopup','dialog');input.setAttribute('aria-expanded','false');
        const id=`calendar-${[...document.querySelectorAll('[data-date],[data-month]')].indexOf(input)}`;
        instance.calendarContainer.id=id;input.setAttribute('aria-controls',id);
        instance.calendarContainer.setAttribute('role','dialog');
        instance.calendarContainer.setAttribute('aria-label',month?'월 선택':'날짜 선택');
        instance.prevMonthNav.setAttribute('aria-label','이전 달');
        instance.nextMonthNav.setAttribute('aria-label','다음 달');
        for(const nav of [instance.prevMonthNav,instance.nextMonthNav]){
          nav.setAttribute('role','button');nav.tabIndex=0;
          nav.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();nav.click();}});
        }
      },
      onOpen:()=>input.setAttribute('aria-expanded','true'),
      onClose:()=>input.setAttribute('aria-expanded','false')
    });
  });
}
// Escape first dismisses the calendar, preserving the form and its draft.
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  const input=[...document.querySelectorAll('[data-date],[data-month]')].find(el=>el._flatpickr?.isOpen);
  if(input){input._flatpickr.close();event.preventDefault();event.stopImmediatePropagation();}
},true);
