import test from "node:test";
import assert from "node:assert/strict";
import {buildCustomerAssistantReply} from "./customer-assistant-reply-v1.js";

test("uses a grounded clarification question when routing asks for one", () => {
  assert.equal(
    buildCustomerAssistantReply({
      routing: {units:[{next_action:"CLARIFY_WORKFLOW",classifier:{clarification_question:"In quale zona si trova il problema?"}}]}
    }),
    "In quale zona si trova il problema?"
  );
});

test("asks for configured missing fields without claiming a practice was opened", () => {
  const reply = buildCustomerAssistantReply({
    newWork: {
      status:"DATA_COLLECTION_REQUIRED",
      data_collection_plan:{required_fields:[{key:"address",label:"Indirizzo"},{key:"availability",label:"Disponibilità"}]}
    }
  });
  assert.match(reply,/Indirizzo, Disponibilità/);
  assert.doesNotMatch(reply,/ho registrato la richiesta/i);
});

test("only confirms creation when the coordinator reports WORK_ITEM_CREATED", () => {
  assert.match(buildCustomerAssistantReply({newWork:{status:"WORK_ITEM_CREATED"}}),/ho registrato la richiesta/i);
  assert.doesNotMatch(buildCustomerAssistantReply({newWork:{status:"CONFIG_REQUIRED"}}),/ho registrato la richiesta/i);
});

test("does not create a duplicate on replay", () => {
  assert.equal(
    buildCustomerAssistantReply({newWork:{status:"WORK_ITEM_EXISTS",replayed:true}}),
    "Ho già registrato questa richiesta e non ne creo una duplicata."
  );
});

test("acknowledges a replayed creation as already registered", () => {
  assert.equal(
    buildCustomerAssistantReply({newWork:{status:"WORK_ITEM_CREATED",replayed:true}}),
    "Ho già registrato questa richiesta e non ne creo una duplicata."
  );
});

test("fails safely when routing and coordinator return no actionable result", () => {
  assert.equal(
    buildCustomerAssistantReply({routing:{units:[]},newWork:{status:"COORDINATOR_ERROR"}}),
    "Ho ricevuto il tuo messaggio. La richiesta non è ancora confermata come pratica."
  );
});
