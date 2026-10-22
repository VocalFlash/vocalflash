import test from "node:test";
import assert from "node:assert/strict";
import {isExplicitOwnerConfirmation} from "./owner-command-confirmation-v1.js";

test("accepts only the supported explicit confirmation phrases after normalization", () => {
  for (const phrase of ["confermo", "Confermo.", "SI CONFERMO", "sì confermo!", "ok confermo", "confermo, ok"]) {
    assert.equal(isExplicitOwnerConfirmation(phrase), true, phrase);
  }
});

test("does not treat vague affirmatives or longer unrelated sentences as confirmation", () => {
  for (const phrase of ["sì", "ok", "va bene", "confermo la ricezione", "sì, confermo domani", "non confermo", "confermo ma cambia l'orario"]) {
    assert.equal(isExplicitOwnerConfirmation(phrase), false, phrase);
  }
});

test("confirmation phrase detection does not authorize or execute an action", async () => {
  const {processOwnerCommandMessage} = await import("./owner-command-runtime-v1.js");
  let called = false;
  const result = await processOwnerCommandMessage(
    {originVerified:true, normalizedText:"confermo.", businessId:"b1", memberId:"m1"},
    {
      persistence:{recordReceived:async()=>{called=true;}},
      loadContext:async()=>{called=true;},
      interpret:async()=>{called=true;}
    }
  );
  assert.equal(result.status, "ATOMIC_CONFIRMATION_NOT_ENABLED");
  assert.equal(result.writes_performed, false);
  assert.equal(called, false);
});
