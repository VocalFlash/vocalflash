import test from "node:test";
import assert from "node:assert/strict";
import {dispatchAssistantWhatsappMessage} from "./assistant-whatsapp-dispatch-v1.js";

const input = {
  externalAccountId: "phone-1",
  senderWaId: "sender-1",
  externalMessageId: "message-1",
  normalizedText: "Ho una perdita",
  contentType: "text"
};

test("dispatches only verified owner origin to owner handler", async () => {
  let customerCalled = false;
  let ownerInput = null;
  const result = await dispatchAssistantWhatsappMessage(input, {
    originResolver: {
      resolve: async () => ({
        ok: true, origin: "owner", businessId: "b1",
        channelId: "c1", memberId: "m1", identityVerified: true
      })
    },
    processCustomer: async () => { customerCalled = true; return {ok:true}; },
    processOwner: async value => { ownerInput = value; return {ok:true, writes_performed:false}; }
  });
  assert.equal(result.ok, true);
  assert.equal(result.stage, "owner");
  assert.equal(ownerInput.originVerified, true);
  assert.equal(ownerInput.memberId, "m1");
  assert.equal(customerCalled, false);
});

test("fails closed before invoking owner handler when identity is unverified", async () => {
  let ownerCalled = false;
  let customerCalled = false;
  const result = await dispatchAssistantWhatsappMessage(input, {
    originResolver: {
      resolve: async () => ({
        ok: true, origin: "owner", businessId: "b1",
        channelId: "c1", memberId: "m1", identityVerified: false
      })
    },
    processCustomer: async () => { customerCalled = true; return {ok:true}; },
    processOwner: async () => { ownerCalled = true; return {ok:true}; }
  });
  assert.equal(ownerCalled, false);
  assert.equal(customerCalled, false);
  assert.equal(result.ok, false);
  assert.equal(result.stage, "origin");
  assert.equal(result.route.reason, "OWNER_IDENTITY_NOT_VERIFIED");
});

test("routes non-owner origin to customer handler without invoking owner handler", async () => {
  let ownerCalled = false;
  const result = await dispatchAssistantWhatsappMessage(input, {
    originResolver: {resolve: async () => ({ok:true, origin:"customer", businessId:"b1"})},
    processCustomer: async value => ({ok:true, assistant_message:"Ricevuto", sameInput:value===input}),
    processOwner: async () => { ownerCalled = true; return {ok:true}; }
  });
  assert.equal(result.ok, true);
  assert.equal(result.stage, "customer");
  assert.equal(result.customer.sameInput, true);
  assert.equal(ownerCalled, false);
});

test("fails closed when origin resolution is denied", async () => {
  let called = false;
  const result = await dispatchAssistantWhatsappMessage(input, {
    originResolver: {resolve: async () => ({ok:false, status:"DENIED", origin:"unknown"})},
    processCustomer: async () => { called = true; return {ok:true}; },
    processOwner: async () => { called = true; return {ok:true}; }
  });
  assert.equal(result.ok, false);
  assert.equal(result.stage, "origin");
  assert.equal(called, false);
});
