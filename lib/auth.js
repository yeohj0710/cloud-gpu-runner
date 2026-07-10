const encoder = new TextEncoder();
export async function signature(secret) { const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode("work-memory-authorized")));return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join(""); }
export function readCookie(request,name){const cookie=request.headers.get("cookie")||"";const pair=cookie.split(";").map(v=>v.trim()).find(v=>v.startsWith(`${name}=`));return pair?decodeURIComponent(pair.slice(name.length+1)):"";}
export async function isAuthorized(request){const secret=process.env.SESSION_SECRET;if(!secret)return false;return readCookie(request,"wm_session")===await signature(secret);}
