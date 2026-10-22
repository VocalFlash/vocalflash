import test from "node:test";
import assert from "node:assert/strict";
import {processOwnerCommandMessage} from "./owner-command-runtime-v1.js";

test("denies owner commands when sender identity is not verified", async () => {
  let called = false;
  const result = await processOwnerCommandMessage(
    {originVerified:false, normalizedText:"aggiungi una nota"},
    {
      persistence:{recordReceived:async()=>{called=true;}},
      loadContext:async()=>{called=true;},
      interpret:async()=>{called=true;}
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.stage, "identity");
  assert.equal(result.status, "DENIED");
  assert.equal(result.writes_performed, false);
  assert.equal(called, false);
});

test("keeps explicit owner confirmation fail-closed until atomic confirmation is implemented", async () => {
  let called = false;
  const result = await processOwnerCommandMessage(
    {originVerified:true, normalizedText:"sì confermo", businessId:"b1", memberId:"m1"},
    {
      persistence:{recordReceived:async()=>{called=true;}},
      loadContext:async()=>{called=true;},
      interpret:async()=>{called=true;}
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.stage, "confirmation");
  assert.equal(result.status, "ATOMIC_CONFIRMATION_NOT_ENABLED");
  assert.equal(result.writes_performed, false);
  assert.equal(called, false);
});

test("does not treat a vague affirmative as explicit confirmation", async () => {
  let called = false;
  const result = await processOwnerCommandMessage(
    {originVerified:true, normalizedText:"sì", businessId:"b1", memberId:"m1"},
    {
      persistence:{recordReceived:async()=>{called=true;return {ok:true,event_id:"e1"};}},
      loadContext:async()=>({ok:false,status:"CONTEXT_NOT_READY"}),
      interpret:async()=>{called=true;}
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.stage, "context");
  assert.equal(result.status, "CONTEXT_NOT_READY");
  assert.equal(called, false);
});
