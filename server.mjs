import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes, timingSafeEqual} from 'node:crypto';
import {Composio} from '@composio/core';
const client=new Composio({apiKey:process.env.COMPOSIO_API_KEY});
const visitors=new Map(),ips=new Map();let globalCalls=0;
const MAX=Number(process.env.MAX_API_CALLS||300);
const allowed=new Set(['github','gmail','slack','notion','linear']);
const page="<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Configure, then connect</title><style>\n*{box-sizing:border-box}body{margin:0;background:#f4efec;color:#251f21;font:16px/1.6 system-ui,sans-serif}main{max-width:900px;margin:24px auto;background:white;border-radius:20px;padding:32px}h1{font:38px/1.1 Georgia,serif;margin:0 0 14px}h2{font:25px Georgia,serif}small{color:#585254}label{display:block;margin:12px 0}select{padding:12px;width:100%;font:inherit;background:white;border:1px solid #ddd;border-radius:6px}button{padding:14px 22px;font:600 15px system-ui;border:0;border-radius:5px;background:#251f21;color:white;cursor:pointer;margin:6px 6px 6px 0}button:disabled{opacity:.4;cursor:wait}.secondary{background:#f4efec;color:#251f21}.flow{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0}.flow span{padding:12px;border:1px solid #73a89a;border-radius:8px;font-size:13px;font-weight:600}.note{background:#f4efec;border-radius:10px;padding:16px}.status{color:#527d70;font-weight:600}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4efec;padding:18px;border-radius:8px;font:13px/1.5 monospace;max-height:500px;overflow:auto}.error{color:#b42030;font-weight:600}section{margin:32px 0}a{color:#527d70}#loading{color:#585254}@media(max-width:600px){main{margin:0;border-radius:0;padding:24px}h1{font-size:31px}.flow{flex-direction:column}.flow span:after{content:' \u2193';float:right}}\n</style><main><small>Live demo \u00b7 @composio/core 0.22.0 \u00b7 public APIs only</small><h1>Configure, then connect</h1><div class=\"flow\"><span>1. Configure policy</span><span>2. PATCH session</span><span>3. Public auth link</span><span>4. Verify account</span><span>5. Constrained discovery</span></div><div class=\"note\">This is a real Composio session demo, not a simulation. It never executes tools, calls a model or sends messages. Connecting creates a disposable connection in the demo project. Do not use sensitive accounts. State expires after 2 hours and can reset when the free server restarts.</div><div id=\"loading\">Loading visitor...</div><div class=\"error\" id=\"error\" role=\"alert\"></div>\n<section><h2>1. Configure before connecting</h2><label>Toolkit<select id=\"toolkit\"><option value=\"github\">GitHub</option><option value=\"gmail\">Gmail</option><option value=\"slack\">Slack</option><option value=\"notion\">Notion</option><option value=\"linear\">Linear</option></select></label><label>Session permission<select id=\"mode\"><option value=\"read\">Read-only tools (readOnlyHint)</option><option value=\"all\">All action tags (no execution in this demo)</option></select></label><p><small>Session access is separate from provider consent. Broad OAuth scopes do not expand this session policy. Provider scopes/custom OAuth app credentials are configured through auth configs, not this policy selector.</small></p><button id=\"configure\">Apply session policy</button><div class=\"status\" id=\"policy-status\">Not applied</div></section>\n<section><h2>2. Connect with the public auth link</h2><p>The link is created only after the policy PATCH succeeds. It opens hosted Composio authentication. No internal token APIs are called.</p><button id=\"connect\" disabled>Connect account</button><div class=\"status\" id=\"connection-status\">Not connected</div></section>\n<section><h2>3. Inspect constrained discovery</h2><p>After changing the selector, click Apply again to patch the live session. No reconnect is needed for policy-only changes. The button below only searches tools; it cannot execute them.</p><button id=\"discover\" disabled>Search tools under this policy</button><button class=\"secondary\" id=\"refresh\">Refresh state</button><pre id=\"result\">No discovery request yet.</pre></section>\n<section><h2>Accepted session configuration</h2><pre id=\"config\">No session yet.</pre><h2>Actual API flow</h2><pre id=\"events\">No API calls yet.</pre></section><p><small>Safety limits: max 25 actions per visitor, 8 visitors per IP, 300 Composio calls per server process. No model key, no execution route. Free hosting can cold-start.</small></p><p><a href=\"https://docs.composio.dev/docs/configuring-sessions\" target=\"_blank\" rel=\"noreferrer\">Public session policy docs</a> \u00b7 <a href=\"https://docs.composio.dev/docs/manually-authenticating\" target=\"_blank\" rel=\"noreferrer\">Public authentication docs</a></p></main><script>\nlet state,working=false;const el=id=>document.getElementById(id);\nfunction render(s){state=s;el('loading').textContent='Isolated visitor ready';el('policy-status').textContent=s.version?'Accepted version '+s.version:'Not applied';el('connection-status').textContent=s.connection;el('connect').disabled=!s.version||s.connection==='ACTIVE';el('discover').disabled=!s.version;el('config').textContent=JSON.stringify(s.config,null,2);el('events').textContent=s.events.join('\\n\\n')||'No API calls yet.';if(s.toolkit){el('toolkit').value=s.toolkit;el('mode').value=s.mode;el('toolkit').disabled=s.connection!=='NONE';}}\nasync function req(path,data){el('error').textContent='';const r=await fetch(path,{method:data?'POST':'GET',headers:data?{'content-type':'application/json','x-csrf-token':state.csrf}:{},body:data?JSON.stringify(data):undefined});const d=await r.json();if(!r.ok)throw Error(d.error||'Request failed');return d;}\nasync function action(fn){if(working)return;working=true;el('loading').textContent='Calling public Composio API...';try{await fn();}catch(e){el('error').textContent=e.message;}finally{working=false;el('loading').textContent='Isolated visitor ready';}}\nel('configure').onclick=()=>action(async()=>render(await req('/api/configure',{toolkit:el('toolkit').value,mode:el('mode').value})));\nel('connect').onclick=()=>action(async()=>{const d=await req('/api/connect',{});if(d.redirectUrl)location.assign(d.redirectUrl);else render(d);});\nel('discover').onclick=()=>action(async()=>{const d=await req('/api/discover',{});render(d.state);el('result').textContent=JSON.stringify(d.result,null,2);});\nel('refresh').onclick=()=>action(async()=>render(await req('/api/state')));\nreq('/api/state').then(render).catch(e=>{el('error').textContent=e.message;el('loading').textContent='Visitor unavailable.';});\n</script></html>\n";
function reply(res,status,data){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));}
function ck(req){const c=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('visitor='));return c?.slice(8);}
function same(a,b){return typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
async function api(fn){if(globalCalls>=MAX)throw new Error('Demo API cap reached. No more requests allowed.');globalCalls++;return await fn();}
function view(v){return {toolkit:v.toolkit,mode:v.mode,version:v.session?.configVersion,config:v.session?.config||null,connection:v.verified?'ACTIVE':v.account?'PENDING':'NONE',events:v.events,csrf:v.csrf};}
async function body(req){let buf='';for await(const x of req){buf+=x;if(buf.length>4096)throw new Error('Request too large');}return JSON.parse(buf||'{}');}
const server=http.createServer(async(req,res)=>{try{
 const base=process.env.APP_URL||`https://${req.headers.host}`;const u=new URL(req.url,base);
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 if(req.method==='GET'&&u.pathname==='/health'){return reply(res,200,{ok:true});}
 let id=ck(req),v=id&&visitors.get(id);
 if(!v&&u.pathname==='/'){
 const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress);const seen=ips.get(ip)||0;if(seen>=8)return reply(res,429,{error:'Visitor limit reached.'});ips.set(ip,seen+1);
 id=randomBytes(24).toString('hex');v={id,userId:`public_demo_${id}`,csrf:randomBytes(24).toString('hex'),created:Date.now(),calls:0,toolkit:null,mode:'read',session:null,account:null,request:null,verified:false,events:[]};visitors.set(id,v);
 res.setHeader('Set-Cookie',`visitor=${id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=7200`);
 }
 if(req.method==='GET'&&u.pathname==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});return res.end(page);}
 if(!v||Date.now()-v.created>7200000)return reply(res,401,{error:'Visitor expired. Reopen the home page.'});
 if(req.method==='POST'){
 if(req.headers.origin!==base||!same(req.headers['x-csrf-token'],v.csrf))return reply(res,403,{error:'Request origin/token rejected.'});
 if(++v.calls>25)return reply(res,429,{error:'Visitor demo limit reached.'});
 if(v.busy)return reply(res,409,{error:'A request is already in progress.'});v.busy=true;
 }
 const log=text=>{v.events.push(text);v.events=v.events.slice(-20);};
 try{
 if(req.method==='GET'&&u.pathname==='/api/state')return reply(res,200,view(v));
 if(req.method==='POST'&&u.pathname==='/api/configure'){
 const b=await body(req);if(!allowed.has(b.toolkit)||!['read','all'].includes(b.mode))return reply(res,400,{error:'Invalid policy'});
 if(v.account&&v.toolkit!==b.toolkit)return reply(res,409,{error:'This visitor is bound to the toolkit chosen before auth. Start a fresh browser session to change it.'});
 if(!v.session){v.session=await api(()=>client.sessions.create(v.userId,{toolkits:{enable:[]},manageConnections:{enable:false},sandbox:{enable:false}}));log('POST /tool_router/session: created deny-all session');}
 const policy={toolkits:{enable:[b.toolkit]},tools:{},tags:b.mode==='read'?{enable:['readOnlyHint']}:{enable:['readOnlyHint','createHint','updateHint','destructiveHint']},manageConnections:{enable:false},sandbox:{enable:false},expectedConfigVersion:v.session.configVersion};
 await api(()=>v.session.update(policy));v.toolkit=b.toolkit;v.mode=b.mode;log(`PATCH session accepted: ${b.toolkit}, ${b.mode==='read'?'read-only tags':'all action tags'}, version ${v.session.configVersion}`);return reply(res,200,view(v));
 }
 if(req.method==='POST'&&u.pathname==='/api/connect'){
 if(!v.session||!v.toolkit)return reply(res,409,{error:'Apply configuration first.'});if(v.verified)return reply(res,200,{already:true,...view(v)});
 if(v.request&&Date.now()-v.request.created<900000)return reply(res,200,{redirectUrl:v.request.redirectUrl});
 const nonce=randomBytes(24).toString('hex');const request=await api(()=>v.session.authorize(v.toolkit,{callbackUrl:`${base}/callback?request=${nonce}`}));
 if(!request.redirectUrl||!new URL(request.redirectUrl).protocol.startsWith('https'))throw new Error('No secure auth redirect returned');
 v.account=request.id;v.request={nonce,created:Date.now(),redirectUrl:request.redirectUrl};log('POST session /link: public hosted auth link created');return reply(res,200,{redirectUrl:request.redirectUrl});
 }
 if(req.method==='GET'&&u.pathname==='/callback'){
 if(!v.request||Date.now()-v.request.created>900000||!same(u.searchParams.get('request'),v.request.nonce))return reply(res,403,{error:'Invalid/expired callback'});
 if(u.searchParams.get('status')!=='success'){log('Auth not completed; no session continuation.');res.writeHead(303,{location:'/'});return res.end();}
 const account=await api(()=>client.connectedAccounts.get(v.account));
 const own=await api(()=>client.connectedAccounts.list({userIds:[v.userId],toolkitSlugs:[v.toolkit],statuses:['ACTIVE']}));
 const active=account.status==='ACTIVE'&&own.items.some(a=>a.id===v.account);if(!active)throw new Error('Connection is not ACTIVE for this visitor/toolkit');
 v.verified=true;v.request=null;log('Verified account ACTIVE, ID, toolkit and visitor ownership.');res.writeHead(303,{location:'/'});return res.end();
 }
 if(req.method==='POST'&&u.pathname==='/api/discover'){
 if(!v.session)return reply(res,409,{error:'Apply configuration first.'});
 const data=await api(()=>v.session.search({query:`Find tools to ${v.mode==='read'?'read and search':'create and update'} ${v.toolkit} data`,toolkits:[v.toolkit]}));log('Public session.search executed under accepted session policy. No tools executed.');return reply(res,200,{result:data,state:view(v)});
 }
 return reply(res,404,{error:'Not found'});
 }finally{if(req.method==='POST')v.busy=false;}
 }catch(e){console.error('Request failed:',e.name, e.status||'');return reply(res,e.status===409?409:502,{error:e.status===409?'Session changed concurrently. Reload and retry.':(e.message?.includes('cap reached')?e.message:'Composio request failed. Nothing marked connected. See server logs for status only.')});}});
server.listen(Number(process.env.PORT||3000),'0.0.0.0');
setInterval(()=>{for(const[id,v]of visitors)if(Date.now()-v.created>7200000)visitors.delete(id);},600000).unref();
