const{chromium,expect}=require('@playwright/test');
(async()=>{const b=await chromium.launch(process.platform==='darwin'?{channel:'chrome'}:{});const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:5175/admin');await p.getByPlaceholder('아이디').fill('qa-master');await p.getByPlaceholder('비밀번호').fill('TestFixture-Only-Strong8');await p.getByRole('button',{name:'로그인',exact:true}).click();await expect(p.getByRole('button',{name:'내 클래스',exact:true})).toBeVisible();
const baseline=await p.evaluate(()=>globalThis.__realtimeDiagnostics.active);
await p.evaluate(async()=>{globalThis.Harness=await import('/tests/support/RealtimeHarness.jsx');Harness.renderProbe({sessionId:'runtime_alpha',questionId:'q1',participantId:'legacy_master',dmId:'dm_alpha',assignmentId:'runtime_alpha'})});
await expect(p.locator('#probe-result')).toContainText('Alpha 채팅');await expect(p.locator('#probe-result')).toContainText('Alpha 상담');
await p.evaluate(()=>{globalThis.__realtimeFrames=[];Harness.renderProbe({sessionId:'runtime_beta',questionId:'q1',participantId:'legacy_master',dmId:'dm_beta',assignmentId:'runtime_beta'})});
await expect(p.locator('#probe-result')).toContainText('Beta');const stale=await p.evaluate(()=>__realtimeFrames.filter(x=>x.scope==='runtime_beta'&&JSON.stringify(x).includes('Alpha')));expect(stale).toEqual([]);
for(let i=0;i<60;i++){await p.evaluate(async()=>{Harness.destroyProbe();await new Promise(r=>setTimeout(r,0));Harness.renderProbe({sessionId:'runtime_beta',questionId:'q1',participantId:'legacy_master',assignmentId:'runtime_beta'})});}
await p.evaluate(()=>Harness.destroyProbe());await expect.poll(()=>p.evaluate(()=>__realtimeDiagnostics.active)).toBe(baseline);
const diagnostics=await p.evaluate(()=>__realtimeDiagnostics);expect(errors).toEqual([]);console.log(JSON.stringify({result:'PASS',baseline,after:diagnostics.active,starts:diagnostics.starts,stops:diagnostics.stops,mountCycles:60,staleFrames:stale.length,pageErrors:errors}));await b.close()})().catch(e=>{console.error(e);process.exit(1)});
