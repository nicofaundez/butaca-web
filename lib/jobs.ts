import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabase } from "./supabase";
export async function beginJob(key: string, seconds: number) {
  const token = randomUUID();
  const { data, error } = await getSupabase().rpc("butaca_begin_job", { p_key: key, p_token: token, p_seconds: seconds });
  if (error) throw new Error(`Supabase bloqueo: ${error.code}`);
  return data === true ? token : null;
}
export async function endJob(key: string, token: string, success: boolean) {
  const { error } = await getSupabase().rpc("butaca_end_job", { p_key: key, p_token: token, p_success: success });
  if (error) throw new Error(`Supabase actualización: ${error.code}`);
}
export async function refreshState() {
  if (process.env.DEMO_MODE === "true") return { last_success: null, next_allowed: null, running: false, demo: true };
  const { data, error } = await getSupabase().from("butaca_jobs").select("last_success,lease_until,last_failed,next_allowed").eq("job_key", "news").maybeSingle();
  if (error) throw new Error(`Supabase estado: ${error.code}`);
  const next = data?.next_allowed && Number.isFinite(Date.parse(data.next_allowed)) ? data.next_allowed : null;
  return { last_success: data?.last_success ?? null, next_allowed: next, running: Boolean(data?.lease_until && Date.parse(data.lease_until) > Date.now()), failed: data?.last_failed ?? false, demo: false };
}
