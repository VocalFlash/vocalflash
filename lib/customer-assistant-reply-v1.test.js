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

test("asks for missing fields and explicit confirmation of uncertain values", () => {
  const reply = buildCustomerAssistantReply({
    newWork: {
      status:"DATA_COLLECTION_REQUIRED",
      data_collection_plan:{required_fields:[
        {key:"address",label:"Indirizzo",status:"MISSING"},
        {key:"availability",label:"Disponibilità",status:"UNCERTAIN",candidate_value:"domani mattina"}
      ]}
    }
  });
  assert.match(reply,/Indirizzo/);
  assert.match(reply,/conferma Disponibilità/);
  assert.match(reply,/domani mattina/);
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

test("does not imply that a denied request was created", () => {
  assert.match(
    buildCustomerAssistantReply({newWork:{status:"DENIED"}}),
    /non posso aprire automaticamente/
  );
});

test("explains multi-request review without claiming creation", () => {
  assert.match(
    buildCustomerAssistantReply({newWork:{status:"MULTI_NEW_REVIEW"}}),
    /non ho aperto una pratica/
  );
});

test("explains multi-workflow classification without claiming a work item was created", () => {
  const reply = buildCustomerAssistantReply({newWork:{status:"MULTI_WORKFLOW_REVIEW"}});
  assert.match(reply,/più aspetti o tipologie di intervento/i);
  assert.match(reply,/non ho aperto una pratica/i);
});

test("explains unclassified requests without claiming creation", () => {
  const reply = buildCustomerAssistantReply({newWork:{status:"UNCLASSIFIED_REVIEW"}});
  assert.match(reply,/non riesco ancora ad associarla con sicurezza/i);
  assert.match(reply,/non ho aperto alcuna pratica/i);
});

test("does not imply confirmation was received when policy requires it", () => {
  assert.match(
    buildCustomerAssistantReply({newWork:{status:"CONFIRMATION_REQUIRED"}}),
    /non è stata registrata alcuna apertura/
  );
});

test("does not claim an existing request was linked unless linkage is confirmed", () => {
  const reply = buildCustomerAssistantReply({
    routing:{units:[{next_action:"LINK_EXISTING_WORK"}]},
    newWork:{status:"NO_NEW_WORK_TO_PROCESS"}
  });
  assert.match(reply,/sembra riferirsi a una richiesta già aperta/i);
  assert.match(reply,/non ho registrato una nuova pratica/i);
  assert.doesNotMatch(reply,/Ho collegato/i);
});
