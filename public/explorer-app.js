const catalog=document.querySelector("#catalog"),output=document.querySelector("#output");
async function call(url){const r=await fetch(url);const d=await r.json();if(!r.ok)throw new Error(d.error||`요청 실패 (${r.status})`);return d;}
async function init(){const d=await call("/api/explorer");catalog.innerHTML=d.items.map(x=>`<div><b>${x.label}</b><span>${x.provider==="kakao"?"카카오클라우드":"네이버클라우드"}</span><button data-id="${x.id}">조회 · 예상 0원</button></div>`).join("");}
catalog.onclick=async(e)=>{const b=e.target.closest("[data-id]");if(!b)return;b.disabled=true;output.textContent="클라우드에서 조회 중…";try{const d=await call(`/api/explorer?id=${encodeURIComponent(b.dataset.id)}`);output.textContent=JSON.stringify(d,null,2);}catch(x){output.textContent=`오류: ${x.message}`;}finally{b.disabled=false;}};
init().catch(x=>output.textContent=`초기화 오류: ${x.message}`);
