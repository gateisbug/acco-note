/* Shared markup for the static publishing screens. No storage or API calls. */
function createUI(icon) {
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  return Object.freeze({
    button: (label, action, primary=false, ico='') => `<button type="button" class="ui-button ${primary?'primary':'button'}" data-action="${escape(action)}">${ico?icon(ico):''}${escape(label)}</button>`,
    field: (label,type='text',value='',placeholder='',readonly=false) => `<label class="field ui-field"><span>${escape(label)}</span><input type="${type==='number'?'text':escape(type)}"${type==='number'?' data-money inputmode="numeric" autocomplete="off"':type==='date'?' data-date':type==='month'?' data-month':''} value="${escape(value)}" placeholder="${escape(placeholder)}"${readonly?' readonly':''}></label>`,
    select: (label,options,selected='') => `<label class="field ui-field"><span>${escape(label)}</span><select aria-label="${escape(label)}">${options.map(x=>`<option${x===selected?' selected':''}>${escape(x)}</option>`).join('')}</select></label>`,
    heading: (title,action='') => `<div class="heading ui-heading"><h1>${escape(title)}</h1>${action}</div>`,
    tabs: (labels,selected,attr) => `<div class="tabs ui-tabs">${labels.map(label=>`<button class="${selected===label?'selected':''}" data-${escape(attr)}="${escape(label)}" aria-pressed="${selected===label}">${escape(label)}</button>`).join('')}</div>`,
    money: (amount,cls='') => `<span class="amount ${escape(cls)}">${escape(amount)}<small>원</small></span>`,
    progress: (percent,color='') => `<div class="progress ${escape(color)}"><span style="width:${Math.max(0,Math.min(100,Number(percent)||0))}%"></span></div>`
  });
}
