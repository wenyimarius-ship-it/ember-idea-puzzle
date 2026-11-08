// Shared source, copied verbatim into each experiment. No content is sent to analytics.
const endpoint='https://crgfsrfxnwyjcjgmvpjr.supabase.co/functions/v1/ember-vault';
const publishable='sb_publishable_fAfydI6PNUN5AKbayfRwQQ_20k0HRvw';
const limit=262144;
export function mountCloudVault({site,getState,restore,analytics}){
 const slot='ember-cloud-vault-'+site+'-v1';let remembered={key:'',revision:0};
 try{const v=JSON.parse(localStorage.getItem(slot)||'null');if(v&&/^ember_[a-f0-9]{64}$/.test(v.key)&&Number.isSafeInteger(v.revision))remembered=v}catch{}
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./cloud-vault.css',import.meta.url).href;document.head.append(css);
 const section=document.createElement('section');section.className='cloud-vault';section.setAttribute('aria-label','云端保存与恢复');
 section.innerHTML=`<details><summary>云端保存与恢复 <span>SUPABASE ↗</span></summary><div class="cloud-vault-body"><p>原有使用方式继续可用。点击“保存到云端”才会上传当前内容；修改后再次保存即可更新。使用同一恢复码，可在其他设备恢复。</p><p class="cloud-vault-warning">恢复码相当于钥匙，持有者可读取、更新或删除云端副本，请勿公开。恢复码仅记在此浏览器；丢失后无法找回。</p><label>恢复码<input type="password" class="cloud-vault-key" autocomplete="off" spellcheck="false" placeholder="首次保存自动生成；其他设备在此粘贴恢复码"></label><div class="cloud-vault-actions"><button type="button" data-cloud="save">保存到云端</button><button type="button" data-cloud="copy">复制恢复码</button><button type="button" data-cloud="load">从云端恢复</button><button type="button" data-cloud="delete">删除云端副本</button></div><p class="cloud-vault-status" role="status" aria-live="polite">内容仍保存在本机；尚未执行云端操作。</p><small>业务内容存入 Supabase。PostHog 只接收操作事件，不包含正文或恢复码。</small></div></details>`;
 document.body.append(section);section.addEventListener('keydown',e=>e.stopPropagation());
 const input=section.querySelector('input');input.value=remembered.key;
 const status=section.querySelector('[role=status]');const buttons=[...section.querySelectorAll('button')];
 function remember(key,revision){remembered={key,revision};try{localStorage.setItem(slot,JSON.stringify(remembered))}catch{status.textContent+=' 此浏览器无法记住恢复码，请立即复制保管。'}}
 async function request(action,key,revision,payload){
  const body=JSON.stringify({action,site,revision,...(payload?{payload}:{})});if(new TextEncoder().encode(body).length>limit)throw Error('too_large');
  const response=await fetch(endpoint,{method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json',apikey:publishable,'X-Ember-Recovery-Key':key},body,signal:AbortSignal.timeout(20000)});
  const result=await response.json().catch(()=>({}));if(!response.ok||result.error)throw Error(result.error||'unavailable');return result;
 }
 function track(action){
  if(!analytics?.enabled||!/^phc_[A-Za-z0-9]+$/.test(analytics.token||'')||analytics.apiHost!=='https://us.i.posthog.com')return;
  const traffic=new URLSearchParams(location.search).get('analytics_test')==='1'?'test':'live';
  void fetch(analytics.apiHost+'/capture/',{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:analytics.token,event:'cloud_'+action,properties:{distinct_id:'ember-cloud-aggregate',site,traffic,$process_person_profile:false,$geoip_disable:true}}),keepalive:true}).catch(()=>{});
 }
 const messages={conflict:'云端已有更新版本。请先恢复并检查内容，再重新保存；当前本地内容没有被覆盖。',rate_limited:'操作较频繁，请稍后重试。',payload_too_large:'内容超过云端副本大小限制，请先导出备份。',too_large:'内容超过云端副本大小限制，请先导出备份。',invalid_payload:'内容格式无法保存，请先导出本地备份。',unauthorized:'恢复码格式不正确。'};
 section.addEventListener('click',async e=>{
  const button=e.target.closest('button[data-cloud]');if(!button||button.disabled)return;const action=button.dataset.cloud;
  let key=input.value.trim();
  if(action==='copy'){
   if(!/^ember_[a-f0-9]{64}$/.test(key)){status.textContent='先保存一次，生成恢复码。';return}
   try{await navigator.clipboard.writeText(key);status.textContent='恢复码已复制。请保存在可信位置，不要公开分享。'}catch{input.type='text';input.focus();input.select();status.textContent='请手动复制恢复码，复制后可重新收起此面板。'}return;
  }
  if(!key&&action==='save'){key='ember_'+Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');input.value=key}
  if(!/^ember_[a-f0-9]{64}$/.test(key)){status.textContent='请粘贴完整恢复码；首次使用可直接点“保存到云端”。';return}
  if(action==='load'&&!window.confirm('用云端副本替换当前内容？如需保留本地内容，请先取消并备份。'))return;
  if(action==='delete'&&!window.confirm('删除该恢复码对应的云端副本？本地内容会保留。'))return;
  buttons.forEach(b=>b.disabled=true);status.textContent='正在连接云端…';
  try{
   let revision=remembered.key===key?remembered.revision:0;
   if(action==='save'){
    const payload=JSON.parse(JSON.stringify(getState()));const r=await request('save',key,revision,payload);
    status.textContent='已保存到云端 · 版本 '+r.revision+'。请复制恢复码以便换设备恢复。';remember(key,r.revision);track('save');
   }else if(action==='load'){
    const r=await request('load',key,0);if(!r.found){status.textContent='该恢复码下没有云端副本，请检查恢复码。';return}
    await restore(r.payload);status.textContent='已从云端恢复 · 版本 '+r.revision;remember(key,r.revision);track('restore');
   }else{
    const current=await request('load',key,0);const r=await request('delete',key,current.revision||0);
    status.textContent='云端副本已删除，本地内容仍保留。';remember(key,r.revision);track('delete');
   }
  }catch(error){status.textContent=messages[error.message]||'云端操作未完成。当前本地内容仍保留，请稍后重试。'}finally{buttons.forEach(b=>b.disabled=false)}
 });
 return section;
}
