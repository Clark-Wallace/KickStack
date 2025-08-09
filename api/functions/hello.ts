import type { KickContext, KickEvent } from "./types";

export default async function handler(event: KickEvent, ctx: KickContext) {
  ctx.log("Hello function called", { user: ctx.user?.sub });
  
  return {
    ok: true,
    message: "Hello from KickStack Edge Function!",
    user: ctx.user,
    timestamp: new Date().toISOString(),
    received: event.body
  };
}