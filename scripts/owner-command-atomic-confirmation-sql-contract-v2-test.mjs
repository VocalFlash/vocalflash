import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const sqlPath=path.join(process.cwd(),"docs","proposed-migrations","20261027090000_owner_command_atomic_confirmation_v2.sql");
const sql=fs.readFileSync(sqlPath,"utf8");

test("proposed SQL keeps atomic confirmation outside the recovered live migration inventory",()=>{
  assert.ok(sql.includes("vf_resolve_pending_owner_command_proposal_v2"));
  assert.ok(sql.includes("vf_commit_owner_command_confirmation_v2"));
  assert.equal(fs.readdirSync(path.join(process.cwd(),"supabase","migrations")).filter(n=>/^\d{14}_[a-z0-9_]+\.sql$/.test(n)).length,15);
});

test("proposed SQL requires explicit expiry and locks proposal plus confirmation",()=>{
  assert.ok(sql.includes("PROPOSAL_EXPIRY_REQUIRED"));
  assert.match(sql,/where id=p_proposal_event_id[\s\S]*?for update/i);
  assert.match(sql,/where id=p_confirmation_event_id[\s\S]*?for update/i);
  assert.ok(sql.includes("now() > v_expiry"));
  assert.ok(sql.includes("CONFIRMATION_EXPIRED_OR_OUT_OF_ORDER"));
});

test("proposed SQL binds exact proposal, validates affirmative text, and rejects conflicting replay",()=>{
  assert.ok(sql.includes("CONFIRMATION_PROPOSAL_MISMATCH"));
  assert.ok(sql.includes("EXPLICIT_CONFIRMATION_REQUIRED"));
  assert.ok(sql.includes("REPLAY_CONFLICT"));
  assert.ok(sql.includes("CONFIRMATION_OR_PROPOSAL_ALREADY_CONSUMED"));
  assert.ok(sql.includes("CONFIRMATION_BINDING_MISMATCH"));
  assert.ok(sql.includes("v_existing.normalized_text is distinct from p_normalized_text"));
  assert.ok(sql.includes("owner_command_source_event_id"));
});

test("proposed SQL commits supported effects and consumes both events in one transaction scope",()=>{
  assert.ok(sql.includes("vf_commit_owner_note_v1"));
  assert.ok(sql.includes("vf_commit_owner_schedule_action_v1"));
  assert.ok(sql.includes("'confirmation_consumed_at',now()"));
  assert.ok(sql.includes("'consumed_at',now()"));
  assert.ok(sql.includes("'confirmation_result',v_result"));
  assert.ok(sql.includes("'commit_result',v_result"));
});

test("proposed SQL limits RPC execution to service_role",()=>{
  assert.match(sql,/revoke all on function public\.vf_record_owner_command_confirmation_v1\(uuid,uuid,uuid,text,uuid,text,timestamptz,jsonb\) from public, anon, authenticated/i);
  assert.match(sql,/grant execute on function public\.vf_record_owner_command_confirmation_v1\(uuid,uuid,uuid,text,uuid,text,timestamptz,jsonb\) to service_role/i);
  assert.match(sql,/revoke all on function public\.vf_resolve_pending_owner_command_proposal_v2\(uuid,uuid,uuid,text,text\) from public, anon, authenticated/i);
  assert.match(sql,/revoke all on function public\.vf_commit_owner_command_confirmation_v2\(uuid,uuid,uuid,uuid,uuid\) from public, anon, authenticated/i);
  assert.match(sql,/grant execute on function public\.vf_resolve_pending_owner_command_proposal_v2\(uuid,uuid,uuid,text,text\) to service_role/i);
  assert.match(sql,/grant execute on function public\.vf_commit_owner_command_confirmation_v2\(uuid,uuid,uuid,uuid,uuid\) to service_role/i);
});
