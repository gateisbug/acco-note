const { test, expect } = require('@playwright/test');

test('keyboard focus and partial selection survive rendering',async({page})=>{
  await page.goto('/preview.html');
  const statistics=page.locator('[data-ledger-tab]').last();await statistics.focus();await page.keyboard.press('Enter');
  await expect(page.locator('[data-ledger-tab]').last()).toBeFocused();
  await page.locator('[data-ledger-tab]').first().click();
  await page.locator('[data-action=bulk-toggle]').focus();await page.keyboard.press('Enter');
  await expect(page.locator('.bulk-toggle')).toBeFocused();
  await page.locator('[data-detail="0"] input').focus();await page.keyboard.press('Space');
  await expect(page.locator('[data-detail="0"] input')).toBeChecked();
  await expect(page.locator('[data-detail="0"] input')).toBeFocused();
  expect(await page.locator('[data-action=bulk-all]').evaluate(el=>el.indeterminate)).toBe(true);
  await page.goto('/preview.html#manage');const categories=page.locator('[data-manage-tab]').nth(1);
  await categories.focus();await page.keyboard.press('Enter');await expect(page.locator('[data-manage-tab]').nth(1)).toBeFocused();
});

test('expanded detail adapts across responsive breakpoints',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto('/preview.html');
  await page.locator('[data-detail="0"] .row-detail-button').click();
  for(const [width,columns] of [[320,4],[768,5],[1440,6]]){
    await page.setViewportSize({width,height:900});
    await expect(page.locator('.inline-detail-row>td')).toHaveAttribute('colspan',String(columns));
    expect((await page.locator('[data-detail="0"] .ledger-title').boundingBox()).width).toBeGreaterThan(70);
    await noOverflow(page);
  }
});

for(const width of [320,1440]) {
  test(`shared amount and date controls ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});await page.goto('/preview.html');
    await page.getByRole('button',{name:'내역 추가',exact:true}).click();
    const amount=page.getByLabel('금액',{exact:true});
    await amount.fill('12000');await expect(amount).toHaveValue('12,000');
    await amount.press('End');await amount.pressSequentially('e+-.abc');
    await expect(amount).toHaveValue('12,000');
    await amount.evaluate(el=>{el.select();const data=new DataTransfer();data.setData('text','₩ 1,234원');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
    await expect(amount).toHaveValue('1,234');
    await amount.fill('');await expect(amount).toHaveValue('');
    await amount.fill('12000');
    await amount.evaluate(el=>el.setSelectionRange(1,1));await amount.pressSequentially('9');
    await expect(amount).toHaveValue('192,000');
    await expect(amount).toHaveAttribute('data-raw-value','192000');
    const date=page.getByLabel('날짜',{exact:true});await date.click();
    const calendar=page.locator('.flatpickr-calendar.open');await expect(calendar).toBeVisible();
    const bounds=await calendar.boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);
    await calendar.locator('[aria-label="2026년 11월 10일"]').click();
    await expect(date).toHaveValue('2026-11-10');
    await date.click();await page.keyboard.press('Escape');
    await expect(calendar).toHaveCount(0);await expect(page.locator('#inline-panel')).toBeVisible();
    const select=page.getByLabel('수입/지출',{exact:true});
    expect(await select.evaluate(el=>getComputedStyle(el).paddingRight)).toBe('36px');
    expect(await select.evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('svg');
    await date.click();await page.screenshot({path:`test-results/datepicker-${width}.png`,fullPage:true});
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');
    await expect(page.locator('.flatpickr-calendar')).toHaveCount(0);
    await page.goto('/preview.html#budget');await page.getByRole('button',{name:'다른 달에서 복사',exact:true}).click();
    await page.getByLabel('가져올 월',{exact:true}).click();
    await expect(page.locator('.flatpickr-calendar.open .flatpickr-monthSelect-month')).toHaveCount(12);
    await page.locator('.flatpickr-monthSelect-month').first().click();
    await expect(page.getByLabel('가져올 월',{exact:true})).toHaveValue('2026-01');
    await page.goto('/preview.html');await expect(page.locator('.flatpickr-calendar')).toHaveCount(0);
  });
}

async function noOverflow(page) {
  const overflow = await page.evaluate(() => ({ viewport:innerWidth, document:document.documentElement.scrollWidth,
    elements:[...document.querySelectorAll('main *')].filter(el=>{
      const r=el.getBoundingClientRect();let left=r.left,right=r.right;
      for(let p=el.parentElement;p;p=p.parentElement){if(['hidden','clip','auto','scroll'].includes(getComputedStyle(p).overflowX)){const clip=p.getBoundingClientRect();left=Math.max(left,clip.left);right=Math.min(right,clip.right);}}
      return r.width>0 && right>left && (right>innerWidth+1 || left < -1);
    }).slice(0,8).map(el=>({tag:el.tagName,classes:el.className})) }));
  expect(overflow, JSON.stringify(overflow)).toMatchObject({document:overflow.viewport, elements:[]});
}

for (const width of [320,390,768,1440]) {
  test(`screens and panels fit ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/preview.html');
    await expect(page.getByRole('heading',{name:'내역',exact:true})).toBeVisible();
    await expect(page.locator('.summary')).toContainText('남은 예산');
    await expect(page.locator('.summary')).not.toContainText('이번 달 수입');
    await expect(page.locator('.notes')).toHaveCount(0);
    const unitsShareLine = await page.locator('.summary .amount').evaluateAll(elements=>elements.every(el=>{
      const number=document.createRange();number.selectNode(el.firstChild);
      const unit=el.querySelector('small').getBoundingClientRect();
      return Math.abs(number.getBoundingClientRect().bottom-unit.bottom)<8;
    }));
    expect(unitsShareLine).toBe(true);
    await noOverflow(page);
    await page.getByRole('button',{name:'내역 추가',exact:true}).click();
    await expect(page.locator('#inline-panel')).toBeVisible();
    await page.getByLabel('내역명',{exact:true}).fill('테스트 입력');
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect(page.locator('.ledger-card > .transaction-editor')).toBeVisible();
    await expect(page.locator('.transaction-editor .panel-header')).toHaveCount(0);
    await page.locator('.inline-memo input').fill('메모 입력 유지');
    await noOverflow(page);
    await page.screenshot({path:`test-results/inline-entry-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'추가',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('실제 데이터는 변경되지');
    await expect(page.getByLabel('내역명',{exact:true})).toHaveValue('테스트 입력');
    await page.keyboard.press('Escape');
    await expect(page.locator('#inline-panel')).not.toBeVisible();
    await page.locator('.ledger-table [data-detail="0"] .row-detail-button').click();
    await expect(page.locator('.inline-detail-row .transaction-facts')).toBeVisible();
    await noOverflow(page);
    await page.screenshot({path:`test-results/table-detail-${width}.png`,fullPage:true});
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'달력 보기',exact:true}).click();
    await expect(page.getByRole('button',{name:'11월 30 일',exact:true})).toBeVisible();
    await noOverflow(page);
    await page.getByRole('button',{name:'통계',exact:true}).click();
    await noOverflow(page);
    for (const name of ['예산','저축','관리']) {
      await page.getByRole('navigation',{name:'주 메뉴'}).getByRole('link',{name,exact:true}).click();
      await noOverflow(page);
      if(name==='저축') {
        await expect(page.getByRole('button',{name:'보관함',exact:true})).toHaveCount(0);
        await expect(page.locator('.completed-goals')).not.toHaveAttribute('open');
        await page.locator('.completed-goals summary').click();
        await expect(page.getByRole('heading',{name:'자전거 구입',exact:true})).toBeVisible();
        await noOverflow(page);
        await page.locator('.completed-goals summary').click();
        await expect(page.getByRole('heading',{name:'자전거 구입',exact:true})).not.toBeVisible();
        await page.locator('[data-goal="1"]').click();
        await expect(page.locator('#inline-panel')).toContainText('비상금');
        await noOverflow(page);
        await page.keyboard.press('Escape');
      }
    }
    for(const name of ['카테고리','결제수단','백업·복원']) {
      await page.getByRole('button',{name,exact:true}).click();
      await noOverflow(page);
    }
    await page.getByRole('button',{name:'복원 미리보기',exact:true}).click();
    await noOverflow(page);
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
    await page.goto('/preview.html');
    await page.screenshot({path:`test-results/ledger-${width}.png`,fullPage:true});
  });
}

test('detail, refund and edit preserve selected sample', async ({page}) => {
  await page.goto('/preview.html');
  await page.locator('[data-detail="2"]').click();
  await expect(page.locator('#inline-panel')).toHaveAttribute('aria-label','일주일의 장보기 상세 정보');
  await page.getByRole('button',{name:'환불',exact:true}).click();
  await expect(page.getByLabel('환불 가능액',{exact:true})).toHaveValue('58,200원');
  await expect(page.getByLabel('환불 가능액',{exact:true})).toHaveAttribute('readonly','');
  await expect(page.getByLabel('내역명',{exact:true})).toHaveValue('일주일의 장보기');
  await expect(page.getByLabel('내역명',{exact:true})).toHaveAttribute('readonly','');
  await page.keyboard.press('Escape');
  await page.locator('[data-detail="2"]').click();
  await page.getByRole('button',{name:'수정',exact:true}).click();
  await expect(page.getByLabel('내역명',{exact:true})).toHaveValue('일주일의 장보기');
  await expect(page.getByLabel('금액',{exact:true})).toHaveValue('58,200');
  await expect(page.getByLabel('날짜',{exact:true})).toHaveValue('2026-11-06');
  await expect(page.locator('#inline-panel').getByLabel('카테고리',{exact:true})).toHaveValue('생활·쇼핑');
  await expect(page.locator('#inline-panel').getByLabel('결제수단',{exact:true})).toHaveValue('생활비 카드');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-detail="2"]')).toContainText('58,200');
});

test('no external requests, storage writes or service worker', async ({page}) => {
  const external=[];
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173'))external.push(r.url());});
  await page.goto('/preview.html');
  await page.getByRole('button',{name:'내역 추가',exact:true}).click();
  await page.getByRole('button',{name:'추가',exact:true}).click();
  expect(await page.evaluate(async()=>({local:localStorage.length,session:sessionStorage.length,db:(await indexedDB.databases()).length,sw:(await navigator.serviceWorker.getRegistrations()).length}))).toEqual({local:0,session:0,db:0,sw:0});
  expect(external).toEqual([]);
});

test('card payment day and card-only sample history', async ({page}) => {
  await page.setViewportSize({width:320,height:900});
  await page.goto('/preview.html#manage');
  await page.getByRole('button',{name:'결제수단',exact:true}).click();
  await page.locator('[data-payment="0"]').click();
  await expect(page.locator('#inline-panel')).toContainText('매월 14일');
  await expect(page.locator('.payment-transactions [data-detail]')).toHaveCount(28);
  await expect(page.locator('.payment-transactions')).not.toContainText('지하철 교통비');
  await expect(page.locator('.payment-transactions')).not.toContainText('11월 월급');
  await noOverflow(page);
  await page.getByRole('button',{name:'결제수단 수정',exact:true}).click();
  await expect(page.getByLabel('결제일 · 선택',{exact:true})).toHaveValue('매월 14일');
  await page.getByLabel('유형',{exact:true}).selectOption('체크카드');
  await expect(page.locator('#payment-day-field')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.locator('[data-payment="2"]').click();
  await expect(page.locator('#inline-panel')).toContainText('샘플 내역이 없습니다');
});

for(const width of [320,1440]) {
  test(`compact detail toggle and bulk delete ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});await page.goto('/preview.html');
    const first=page.locator('.ledger-table [data-detail="0"]');
    await first.locator('button').click();
    await expect(page.locator('#inline-panel .panel-header')).toHaveCount(0);
    await expect(page.locator('#inline-panel .panel-footer button')).toHaveText(['삭제','수정','환불']);
    await noOverflow(page);
    await first.locator('button').click();
    await expect(page.locator('#inline-panel')).toHaveCount(0);
    await page.getByRole('button',{name:'여러 내역 삭제',exact:true}).click();
    const countBefore=await page.locator('.ledger-table tbody > tr[data-detail]').count();
    await expect(page.getByRole('button',{name:'선택 삭제',exact:true})).toBeDisabled();
    await page.getByRole('checkbox',{name:'점심, 따뜻한 한 끼 선택',exact:true}).click();
    await page.getByRole('checkbox',{name:'오후의 커피 선택',exact:true}).click();
    await expect(page.locator('.selection-bar')).toContainText('2건 선택');
    await noOverflow(page);
    await page.getByRole('button',{name:'선택 삭제',exact:true}).click();
    await expect(page.locator('.ledger-table tbody > tr[data-detail]')).toHaveCount(countBefore);
    await page.getByRole('button',{name:'돌아가기',exact:true}).click();
    await expect(page.getByRole('checkbox',{name:'오후의 커피 선택',exact:true})).toBeChecked();
    await page.getByRole('button',{name:'선택 삭제',exact:true}).click();
    await page.getByRole('button',{name:'삭제 확인',exact:true}).click();
    await expect(page.locator('.ledger-table [data-detail="0"]')).toHaveCount(0);
    await expect(page.locator('.ledger-table [data-detail="1"]')).toHaveCount(0);
    await page.getByRole('button',{name:'여러 내역 삭제',exact:true}).click();
    await page.getByRole('checkbox',{name:'전체 내역 선택',exact:true}).click();
    const remaining=await page.locator('.ledger-table tbody > tr[data-detail]').count();
    await expect(page.locator('.selection-bar')).toContainText(`${remaining}건 선택`);
    await page.getByRole('checkbox',{name:'전체 내역 선택',exact:true}).click();
    await expect(page.getByRole('button',{name:'선택 삭제',exact:true})).toBeDisabled();
    await page.reload();
    await expect(page.locator('.ledger-table [data-detail="0"]')).toHaveCount(1);
    await expect(page.locator('.ledger-table [data-detail="1"]')).toHaveCount(1);
  });
}
for (const width of [320, 1440]) {
  test(`infinite scroll preserves draft ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height:700});
    await page.goto('/preview.html');
    const rows=page.locator('.ledger-table tbody > tr[data-detail]');
    await expect(rows).toHaveCount(12);
    await expect(page.getByRole('button',{name:'이전 내역 보기'})).toHaveCount(0);
    await page.getByRole('button',{name:'내역 추가',exact:true}).click();
    await page.getByLabel('내역명',{exact:true}).fill('입력 유지 확인');
    await page.locator('#list-end').scrollIntoViewIfNeeded();
    await expect(rows).toHaveCount(24);
    await expect(page.getByLabel('내역명',{exact:true})).toHaveValue('입력 유지 확인');
    await page.locator('#list-end').scrollIntoViewIfNeeded();
    await expect(rows).toHaveCount(30);
    await expect(page.locator('#list-end')).toContainText('마지막 내역입니다');
    await expect(page.locator('#list-end')).toHaveAttribute('aria-busy','false');
    const ids=await rows.evaluateAll(elements=>elements.map(el=>el.dataset.detail));
    expect(new Set(ids).size).toBe(30);
    await noOverflow(page);
  });
}
