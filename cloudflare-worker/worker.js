const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (data, status=200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
const PAGE = "<!doctype html><html lang=\"pl\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Most Nowy Cleaner</title><style>body{font:16px system-ui;background:#0b1220;color:#eef4ff;max-width:850px;margin:auto;padding:20px}section{background:#121d30;border:1px solid #26354d;border-radius:14px;padding:16px;margin:14px 0}button,a{padding:12px;border:0;border-radius:9px;background:#6ee7b7;color:#08231b;font-weight:bold;text-decoration:none;margin:5px}button:disabled{opacity:.5}.item{display:flex;gap:10px;padding:10px;border-bottom:1px solid #26354d}.muted{color:#91a0b8}#results{white-space:normal}</style><h2>✦ Most Nowy Cleaner</h2><section><b id=\"connection\">Sprawdzam połączenie…</b><p class=\"muted\">Skanowanie Dysku Google, wykrywanie identycznych kopii i dużych plików.</p><a id=\"connect\" href=\"/auth/google\">Połącz Google</a><button id=\"scan\" disabled>Skanuj Dysk</button><button id=\"logout\" hidden>Odłącz konto</button><p id=\"status\" class=\"muted\"></p></section><section id=\"summary\" hidden></section><section id=\"results\" hidden><h3>Duplikaty</h3><div id=\"dupes\"></div><h3>Duże pliki</h3><div id=\"large\"></div><h3>Powiązane części archiwów</h3><div id=\"archives\"></div><button id=\"trash\" disabled>Przenieś zaznaczone do kosza</button><button id=\"clear\">Wyczyść wybór</button><p id=\"trashStatus\" class=\"muted\"></p></section><section class=\"muted\">Obsługuje Google Drive. Google Photos i pamięć telefonu wymagają osobnych integracji. Usuwanie następuje wyłącznie po Twoim potwierdzeniu.</section><script>\nlet scanId=null;const selected=new Set(),$=x=>document.getElementById(x);\nasync function api(p,o){let r=await fetch(p,Object.assign({credentials:\"same-origin\",headers:{\"content-type\":\"application/json\"}},o||{})),d=await r.json();if(!r.ok)throw Error(d.message||d.error||\"Błąd\");return d}\nfunction row(f,tag,locked=false){let l=document.createElement(\"label\");l.className=\"item\";let c=document.createElement(\"input\");c.type=\"checkbox\";c.disabled=locked;c.onchange=()=>{c.checked?selected.add(f.id):selected.delete(f.id);$(\"trash\").disabled=!selected.size};let t=document.createElement(\"span\");t.style.flex=\"1\";t.textContent=(f.name||\"plik\")+\" · \"+Math.round(Number(f.size||0)/1048576)+\" MB\";let b=document.createElement(\"small\");b.textContent=tag;l.append(c,t,b);return l}\nasync function init(){try{let d=await api(\"/api/status\");$(\"connection\").textContent=d.connected?\"Google połączone\":\"Google niepołączone\";$(\"connect\").hidden=d.connected;$(\"scan\").disabled=!d.connected;$(\"logout\").hidden=!d.connected}catch(e){$(\"connection\").textContent=e.message}}\n$(\"scan\").onclick=async()=>{$(\"scan\").disabled=true;$(\"status\").textContent=\"Skanuję…\";selected.clear();try{let d=await api(\"/api/drive/scan\",{method:\"POST\",body:\"{}\"});scanId=d.scanId;$(\"summary\").hidden=false;$(\"results\").hidden=false;$(\"summary\").textContent=\"Pliki: \"+d.totalFiles+\" | Duplikaty: \"+d.duplicateCopies+\" | Potencjalne odzyskanie: \"+(d.reclaimableBytes/1048576).toFixed(1)+\" MB\";$(\"dupes\").replaceChildren();$(\"large\").replaceChildren();$(\"archives\").replaceChildren();d.duplicateCandidates.forEach(f=>$(\"dupes\").append(row(f,\"duplikat\")));d.largeFiles.forEach(f=>$(\"large\").append(row(f,\"duży\")));(d.archiveParts||[]).forEach(f=>$(\"archives\").append(row(f,\"część archiwum, zachowaj\",true)));$(\"status\").textContent=d.partial?\"Skan częściowy, osiągnięto limit stron.\":\"Skan zakończony.\"}catch(e){$(\"status\").textContent=\"Błąd: \"+e.message}finally{$(\"scan\").disabled=false;$(\"trash\").disabled=true}};\n$(\"trash\").onclick=async()=>{let ids=[...selected];if(!scanId||!ids.length||!confirm(\"Przenieść \"+ids.length+\" plików do kosza?\"))return;$(\"trash\").disabled=true;try{let d=await api(\"/api/drive/trash\",{method:\"POST\",body:JSON.stringify({scanId,ids,confirm:true})});$(\"trashStatus\").textContent=\"Przeniesiono: \"+d.results.filter(x=>x.ok).length+\" z \"+ids.length+\". Błędy: \"+d.results.filter(x=>!x.ok).length;selected.clear()}catch(e){$(\"trashStatus\").textContent=e.message}};\n$(\"clear\").onclick=()=>{selected.clear();document.querySelectorAll('input[type=checkbox]').forEach(x=>x.checked=false);$(\"trash\").disabled=true};\n$(\"logout\").onclick=async()=>{await api(\"/api/logout\",{method:\"POST\",body:\"{}\"});location.reload()};init();\n</script></html>";
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
async function randomToken() { const b=new Uint8Array(32); crypto.getRandomValues(b); return b64url(b); }
async function googleToken(env, refreshToken) {
  const body=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:refreshToken,grant_type:"refresh_token"});
  const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
  const d=await r.json(); if(!r.ok) throw new Error(d.error_description||d.error||"Google token refresh failed"); return d.access_token;
}
async function api(env, session, path, init={}) {
  const saved=await env.OAUTH_KV.get("session:"+session); if(!saved) return json({error:"unauthorized"},401);
  const record=JSON.parse(saved); const access=await googleToken(env,record.refresh_token);
  const r=await fetch("https://www.googleapis.com"+path,{...init,headers:{...(init.headers||{}),authorization:"Bearer "+access}});
  const body=await r.text(); return new Response(body,{status:r.status,headers:{"content-type":r.headers.get("content-type")||"application/json","cache-control":"no-store"}});
}
export default {
 async fetch(request,env) {
  const u=new URL(request.url), p=u.pathname;
  try {
   if(request.method==="GET" && p==="/") return new Response(PAGE,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","content-security-policy":"default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'"}});
   if(request.method==="GET" && p==="/health") return json({ok:true,service:"photos-cleaner-google-api",oauthConfigured:!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET)});
   if(request.method==="GET" && p==="/auth/google") {
    const state=await randomToken(); await env.OAUTH_KV.put("state:"+state,"1",{expirationTtl:600});
    const redirect=u.origin+"/oauth/callback";
    const scopes=["openid","email","https://www.googleapis.com/auth/drive"];
    const q=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:redirect,response_type:"code",scope:scopes.join(" "),access_type:"offline",prompt:"consent",state});
    return Response.redirect("https://accounts.google.com/o/oauth2/v2/auth?"+q.toString(),302);
   }
   if(request.method==="GET" && p==="/oauth/callback") {
    const state=u.searchParams.get("state"), code=u.searchParams.get("code");
    if(!state||!code||!await env.OAUTH_KV.get("state:"+state)) return json({error:"invalid_state"},400);
    await env.OAUTH_KV.delete("state:"+state);
    const redirect=u.origin+"/oauth/callback";
    const body=new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:redirect,grant_type:"authorization_code"});
    const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
    const d=await r.json(); if(!r.ok||!d.refresh_token) return json({error:"token_exchange_failed",details:d.error_description||d.error||"No refresh token"},400);
    const session=await randomToken(); await env.OAUTH_KV.put("session:"+session,JSON.stringify({refresh_token:d.refresh_token}),{expirationTtl:2592000});
    return new Response(null,{status:302,headers:{location:"/","set-cookie":"mn_session="+encodeURIComponent(session)+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000","cache-control":"no-store"}});
   }
   const cookie=(request.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("mn_session="));
   const session=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"") || (cookie?decodeURIComponent(cookie.slice(11)):null);
   if(!session) return json({error:"missing_session"},401);
   
   if(request.method==="GET" && p==="/api/status") return json({connected:!!(session && await env.OAUTH_KV.get("session:"+session))});
   if(request.method==="POST" && p==="/api/logout") {
    if(session) await env.OAUTH_KV.delete("session:"+session);
    return new Response(JSON.stringify({ok:true}),{headers:{...JSON_HEADERS,"set-cookie":"mn_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"}});
   }
   if(request.method==="POST" && p==="/api/drive/scan") {
    let all=[], pageToken=null, pages=0;
    do {
     const params=new URLSearchParams({pageSize:"1000",orderBy:"name",fields:"nextPageToken,files(id,name,mimeType,size,md5Checksum,createdTime,modifiedTime,webViewLink)",q:"trashed=false"});
     if(pageToken) params.set("pageToken",pageToken);
     const response=await api(env,session,"/drive/v3/files?"+params.toString());
     const data=await response.json(); if(!response.ok) return json({error:"drive_scan_failed",details:data.error?.message||"Google Drive error"},response.status);
     all=all.concat(data.files||[]); pageToken=data.nextPageToken||null; pages++;
    } while(pageToken && pages<20);
    const groups=new Map();
    for(const f of all) if(f.md5Checksum && f.size) { const k=f.md5Checksum+":"+f.size; if(!groups.has(k))groups.set(k,[]); groups.get(k).push(f); }
    const duplicateCandidates=[];
    for(const group of groups.values()) if(group.length>1) {
     group.sort((a,b)=>String(a.createdTime||"").localeCompare(String(b.createdTime||"")));
     duplicateCandidates.push(...group.slice(1).map(f=>({...f,reason:"duplicate"})));
    }
    const archivePattern=/\.(7z|zip|rar|z\d{2}|part\d+|r\d{2})\.(\d{3}|\d{2})$/i;
    const archiveParts=all.filter(f=>archivePattern.test(f.name||"")).map(f=>({...f,reason:"archive-part"}));
    const archiveIds=new Set(archiveParts.map(f=>f.id));
    for(let i=duplicateCandidates.length-1;i>=0;i--) if(archiveIds.has(duplicateCandidates[i].id)) duplicateCandidates.splice(i,1);
    const largeFiles=all.filter(f=>Number(f.size||0)>=100*1024*1024&&!archiveIds.has(f.id)).map(f=>({...f,reason:"large"}));
    const candidates={}; for(const f of duplicateCandidates)candidates[f.id]="duplicate"; for(const f of largeFiles)candidates[f.id]=candidates[f.id]||"large";
    const scanId=await randomToken();
    await env.OAUTH_KV.put("scan:"+session+":"+scanId,JSON.stringify({candidates}),{expirationTtl:7200});
    return json({scanId,totalFiles:all.length,duplicateCopies:duplicateCandidates.length,reclaimableBytes:duplicateCandidates.reduce((n,f)=>n+Number(f.size||0),0),duplicateCandidates:duplicateCandidates.slice(0,500),largeFiles:largeFiles.slice(0,200),archiveParts:archiveParts.slice(0,200),partial:!!pageToken});
   }

   if(request.method==="GET" && p==="/api/drive/files") return api(env,session,"/drive/v3/files?"+new URLSearchParams({pageSize:"100",orderBy:"name",fields:"files(id,name,mimeType,size,md5Checksum,trashed,webViewLink),nextPageToken",q:"trashed=false"}));
   if(request.method==="GET" && p==="/api/gmail/messages") return api(env,session,"/gmail/v1/users/me/messages?"+new URLSearchParams({maxResults:"10",q:"in:anywhere -in:trash"}));
   if(request.method==="GET" && p==="/api/gmail/message") {
    const id=u.searchParams.get("id"); if(!id||!/^[A-Za-z0-9_-]+$/.test(id)) return json({error:"invalid_id"},400);
    return api(env,session,"/gmail/v1/users/me/messages/"+id+"?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date");
   }
   if(request.method==="POST" && p==="/api/drive/trash") {
    const d=await request.json();
    if(d.confirm!==true||!Array.isArray(d.ids)||!d.ids.length||d.ids.length>20||typeof d.scanId!=="string") return json({error:"confirmation_required_or_invalid_ids"},400);
    const saved=await env.OAUTH_KV.get("scan:"+session+":"+d.scanId); if(!saved) return json({error:"scan_expired"},410);
    const allowed=JSON.parse(saved).candidates||{};
    if(d.ids.some(id=>typeof id!=="string"||!allowed[id])) return json({error:"file_not_in_scan"},403);
    const results=[];
    for(const id of [...new Set(d.ids)]) {
     const r=await api(env,session,"/drive/v3/files/"+encodeURIComponent(id)+"?supportsAllDrives=true",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({trashed:true})});
     let detail={}; try{detail=await r.json()}catch{}
     results.push({id,ok:r.ok,status:r.status,error:r.ok?null:(detail.error?.message||detail.error||"Google Drive API error"),reason:detail.error?.errors?.[0]?.reason||null});
    }
    return json({results});
   }
   if(request.method==="POST" && p==="/api/gmail/trash") return json({error:"gmail_cleanup_disabled"},403);
   if(request.method==="POST" && p==="/api/gmail/trash") {
    const d=await request.json(); if(!Array.isArray(d.ids)||!d.ids.length||d.ids.length>10) return json({error:"invalid_ids"},400);
    const results=[]; for(const id of d.ids){if(typeof id!=="string"||!/^[A-Za-z0-9_-]+$/.test(id)){results.push({id,ok:false});continue;} const r=await api(env,session,"/gmail/v1/users/me/messages/"+id+"/trash",{method:"POST"});results.push({id,ok:r.ok});}
    return json({results});
   }
   return json({error:"not_found"},404);
  } catch(e) { return json({error:"server_error",message:String(e.message||e)},500); }
 }
};
