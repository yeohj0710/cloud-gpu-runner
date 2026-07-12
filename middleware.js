import { isAuthorized } from "./lib/auth.js";
export default async function middleware(request){const url=new URL(request.url);if(url.pathname==="/login"||url.pathname==="/login.html"||url.pathname==="/api/login"||url.pathname==="/api/worker-callback"||url.pathname==="/api/cleanup")return;if(await isAuthorized(request))return;return Response.redirect(new URL("/login.html",request.url),307);}
export const config={matcher:["/","/index.html","/ncp","/ncp.html","/storage","/storage.html","/ncp-storage","/ncp-storage.html","/jobs","/jobs.html","/api/:path*"]};
