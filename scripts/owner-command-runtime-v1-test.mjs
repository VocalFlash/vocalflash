
import assert from "node:assert/strict";
import {processOwnerCommandMessage} from "../lib/owner-command-runtime-v1.js";

const baseInput={
  businessId:"b",
  memberId:"m",
  channelId:"c",
  originVerified:true,
  externalMessageId:"x",
  normalizedText:"nota",
  occurredAt:"2026-10-04T20:00:00+02:00",
  now:"2026-10-04T20:01:00+02:00"
};

const context={
  businessId:"b",
  originVerified:true,
  receivedAt:baseInput.occurredAt,
  now:baseInput.now,
  member:{
    id:"m",
    businessId:"b",
    verified:true,
    active:true,
    sharedAccount:false,
    permissions:["consult","add_note"],
    workItemIds:["w"]
  },
  workItems:[{
    id:"w",
    businessId:"b",
    label:"Rossi",
    writable:true
  }],
  policiesByWorkItem:{
    w:{
      consult:["auto"],
      add_note:["confirm"]
    }
  }
};

let proposals=0;
let writes=0;
let receivedCalls=0;

const deps={
  confirmationTtlSeconds:600,
  clock:()=>Date.parse("2026-10-04T20:00:00Z"),

  persistence:{
    recordReceived:async()=>{
      receivedCalls++;
      return {
        ok:true,
        status:"RECEIVED_RECORDED",
        event_id:"source",
        replayed:false
      };
    },

    recordProposal:async()=>{
      proposals++;
      return {
        ok:true,
        status:"PROPOSAL_RECORDED",
        proposal_event_id:"proposal",
        replayed:false
      };
    },

    commitNote:async()=>{
      writes++;
      return {
        ok:true,
        status:"NOTE_ADDED"
      };
    }
  },

  loadContext:async()=>({
    ok:true,
    context
  }),

  interpret:async()=>({
    result:{
      units:[{
        intent:"add_note",
        candidateIds:["w"],
        note:"25 persone",
        title:null,
        dueAt:null,
        assigneeId:null
      }]
    }
  })
};

// 1. Prima proposta: nessuna scrittura operativa.
const confirm=await processOwnerCommandMessage(baseInput,deps);

assert.equal(confirm.ok,true);
assert.equal(confirm.status,"CONFIRMATION_REQUIRED");
assert.equal(confirm.writes_performed,false);
assert.equal(confirm.proposal_event_id,"proposal");
assert.equal(proposals,1);
assert.equal(writes,0);
assert.equal(typeof confirm.proposal.expiresAt,"string");

// 2. Replay conflittuale del messaggio ricevuto.
const replayConflict=await processOwnerCommandMessage(baseInput,{
  ...deps,
  persistence:{
    ...deps.persistence,
    recordReceived:async()=>({
      ok:false,
      status:"REPLAY_CONFLICT",
      reason:"RECEIVED_REPLAY_MISMATCH"
    })
  }
});

assert.equal(replayConflict.ok,false);
assert.equal(replayConflict.stage,"received");
assert.equal(replayConflict.status,"REPLAY_CONFLICT");
assert.equal(writes,0);

// 3. Percorso di sola lettura.
const readContext={
  ...context,
  policiesByWorkItem:{
    w:{
      consult:["auto"],
      add_note:["auto"]
    }
  }
};

const read=await processOwnerCommandMessage({
  ...baseInput,
  normalizedText:"come siamo messi?"
},{
  ...deps,
  loadContext:async()=>({
    ok:true,
    context:readContext
  }),
  interpret:async()=>({
    result:{
      units:[{
        intent:"consult",
        candidateIds:["w"],
        note:null,
        title:null,
        dueAt:null,
        assigneeId:null
      }]
    }
  })
});

assert.equal(read.ok,true);
assert.equal(read.status,"READ_ONLY_READY");
assert.equal(read.reads.length,1);
assert.equal(read.writes_performed,false);

// 4. Conferma bloccata se manca la persistenza atomica.
const beforeConfirmationCalls=receivedCalls;

const blockedConfirmation=await processOwnerCommandMessage({
  ...baseInput,
  normalizedText:"Sì, confermo"
},deps);

assert.equal(blockedConfirmation.ok,false);
assert.equal(blockedConfirmation.status,"ATOMIC_CONFIRMATION_NOT_ENABLED");
assert.equal(blockedConfirmation.writes_performed,false);
assert.equal(receivedCalls,beforeConfirmationCalls);

// 5. Verifica passaggio normalizedText al resolver.
let resolvedText=null;
let confirmationRecorded=false;
let atomicCommit=false;

const confirmationDeps={
  persistence:{
    resolvePendingProposal:async(input)=>{
      resolvedText=input.normalizedText;
      return {
        ok:true,
        status:"PENDING_PROPOSAL",
        proposal_event_id:"proposal-confirm"
      };
    },

    recordConfirmation:async(input)=>{
      confirmationRecorded=true;
      assert.equal(input.normalizedText,"Sì, confermo");
      assert.equal(input.proposalEventId,"proposal-confirm");
      return {
        ok:true,
        status:"CONFIRMATION_RECORDED",
        confirmation_event_id:"confirmation-event"
      };
    },

    commitConfirmedProposal:async(input)=>{
      atomicCommit=true;
      assert.equal(input.confirmationEventId,"confirmation-event");
      assert.equal(input.proposalEventId,"proposal-confirm");
      return {
        ok:true,
        status:"CONFIRMATION_COMMITTED",
        writes_performed:true,
        result:{committed:true}
      };
    }
  }
};

const confirmationResult=await processOwnerCommandMessage({
  ...baseInput,
  normalizedText:"Sì, confermo"
},confirmationDeps);

assert.equal(resolvedText,"Sì, confermo");
assert.equal(confirmationRecorded,true);
assert.equal(atomicCommit,true);
assert.equal(confirmationResult.ok,true);
assert.equal(confirmationResult.status,"CONFIRMATION_COMMITTED");
assert.equal(confirmationResult.effect_applied,true);

// 6. Replay proposta: la scadenza originale deve essere conservata.
let replayProposalCalls=0;
let originalExpiry=null;
let replayReceivedCalls=0;

const replayDeps={
  ...deps,
  clock:()=>{
    // Simula il passaggio del tempo tra il primo messaggio e il replay.
    return replayProposalCalls===0
      ? Date.parse("2026-10-04T20:00:00Z")
      : Date.parse("2026-10-04T21:00:00Z");
  },

  persistence:{
    ...deps.persistence,

    recordReceived:async()=>{
      replayReceivedCalls++;
      return {
        ok:true,
        status:"RECEIVED_RECORDED",
        event_id:"source-replay",
        replayed:replayReceivedCalls>1
      };
    },

    recordProposal:async(input)=>{
      replayProposalCalls++;

      if(replayProposalCalls===1){
        originalExpiry=input.payload.expires_at;

        return {
          ok:true,
          status:"PROPOSAL_RECORDED",
          proposal_event_id:"proposal-replay",
          replayed:false
        };
      }

      return {
        ok:true,
        status:"PROPOSAL_EXISTS",
        proposal_event_id:"proposal-replay",
        replay_verified:true,
        replayed:true,
        persisted_payload:{
          intent:input.payload.intent,
          note:input.payload.note,
          title:input.payload.title,
          due_at:input.payload.due_at,
          assignee_id:input.payload.assignee_id,
          expires_at:originalExpiry
        }
      };
    }
  }
};

const firstReplayProposal=await processOwnerCommandMessage({
  ...baseInput,
  externalMessageId:"replay-x"
},replayDeps);

assert.equal(firstReplayProposal.status,"CONFIRMATION_REQUIRED");

const firstExpiry=firstReplayProposal.proposal.expiresAt;

const secondReplayProposal=await processOwnerCommandMessage({
  ...baseInput,
  externalMessageId:"replay-x"
},replayDeps);

assert.equal(secondReplayProposal.ok,true);
assert.equal(secondReplayProposal.status,"CONFIRMATION_REQUIRED");
assert.equal(secondReplayProposal.replayed,true);
assert.equal(secondReplayProposal.proposal_event_id,"proposal-replay");
assert.equal(secondReplayProposal.proposal.expiresAt,firstExpiry);
assert.equal(secondReplayProposal.proposal.expiresAt,originalExpiry);
assert.notEqual(
  secondReplayProposal.proposal.expiresAt,
  new Date(Date.parse("2026-10-04T21:00:00Z")+600000).toISOString()
);

console.log("OWNER_COMMAND_RUNTIME_V1_PASS");
