import test from "node:test";
import assert from "node:assert/strict";
import {buildNewWorkIntakePlan} from "./new-work-intake-plan-v1.js";

const workflows = [
  {id:"wf-repair", workflow_key:"repair", name:"Riparazione", required_data:[]},
  {id:"wf-inspection", workflow_key:"inspection", name:"Sopralluogo", required_data:[]}
];

test("single classification identifies one workflow but does not authorize creation", () => {
  const plan = buildNewWorkIntakePlan({
    classifierResult:{
      decision:"CLASSIFIED_SINGLE",
      routes:[{workflow_id:"wf-repair",work_type:"riparazione"}],
      candidate_workflow_ids:[],
      reason:"Richiesta di riparazione."
    },
    workflows
  });
  assert.equal(plan.status,"WORKFLOW_IDENTIFIED");
  assert.equal(plan.creation_allowed,false);
  assert.equal(plan.writes_performed,false);
  assert.equal(plan.workflow.id,"wf-repair");
});

test("simultaneous multi-workflow classification stays in review and cannot auto-split", () => {
  const plan = buildNewWorkIntakePlan({
    classifierResult:{
      decision:"CLASSIFIED_MULTI",
      routes:[
        {workflow_id:"wf-repair",work_type:"riparazione"},
        {workflow_id:"wf-inspection",work_type:"sopralluogo"}
      ],
      candidate_workflow_ids:[],
      reason:"Due processi simultanei."
    },
    workflows
  });
  assert.equal(plan.status,"MULTI_WORKFLOW_REVIEW");
  assert.equal(plan.creation_allowed,false);
  assert.equal(plan.writes_performed,false);
  assert.equal(plan.auto_split_allowed,false);
  assert.equal(plan.routes.length,2);
});

test("ambiguous classification requests clarification and cannot create a work item", () => {
  const plan = buildNewWorkIntakePlan({
    classifierResult:{
      decision:"AMBIGUOUS",
      routes:[],
      candidate_workflow_ids:["wf-repair","wf-inspection"],
      clarification_question:"Si tratta di una riparazione o di un sopralluogo?",
      reason:"Due alternative."
    },
    workflows
  });
  assert.equal(plan.status,"CLARIFICATION_REQUIRED");
  assert.equal(plan.creation_allowed,false);
  assert.equal(plan.writes_performed,false);
});

test("unclassified request is routed to review without inventing a workflow", () => {
  const plan = buildNewWorkIntakePlan({
    classifierResult:{
      decision:"UNCLASSIFIED",
      routes:[],
      candidate_workflow_ids:[],
      reason:"Nessun workflow adatto."
    },
    workflows
  });
  assert.equal(plan.status,"UNCLASSIFIED_REVIEW");
  assert.equal(plan.creation_allowed,false);
  assert.equal(plan.writes_performed,false);
  assert.deepEqual(plan.routes,[]);
});


test("fails closed when workflow required_data has an unsupported object shape", () => {
  const plan = buildNewWorkIntakePlan({
    classifierResult:{
      decision:"CLASSIFIED_SINGLE",
      routes:[{workflow_id:"wf-repair",work_type:"riparazione"}],
      candidate_workflow_ids:[],
      reason:"Richiesta di riparazione."
    },
    workflows:[{
      id:"wf-repair",workflow_key:"repair",name:"Riparazione",
      required_data:{address:"Indirizzo",issue:{label:"Problema"}}
    }]
  });
  assert.equal(plan.ok,false);
  assert.equal(plan.status,"CONFIG_REQUIRED");
  assert.equal(plan.creation_allowed,false);
  assert.equal(plan.writes_performed,false);
  assert.equal(plan.data_extraction_required,false);
  assert.equal(plan.workflow.required_data.reason,"REQUIRED_DATA_OBJECT_SHAPE_UNSUPPORTED");
});

test("exposes only normalized required-field definitions to downstream extraction", () => {
  const plan = buildNewWorkIntakePlan({
    classifierResult:{
      decision:"CLASSIFIED_SINGLE",
      routes:[{workflow_id:"wf-repair",work_type:"riparazione"}],
      candidate_workflow_ids:[],
      reason:"Richiesta di riparazione."
    },
    workflows:[{
      id:"wf-repair",workflow_key:"repair",name:"Riparazione",
      required_data:{fields:[{key:"address",label:"Indirizzo",type:"string"}]}
    }]
  });
  assert.equal(plan.status,"WORKFLOW_IDENTIFIED");
  assert.equal(plan.data_extraction_required,true);
  assert.deepEqual(plan.workflow.required_data.fields,[{
    key:"address",label:"Indirizzo",description:null,type:"string"
  }]);
});

test("fails closed when a required-data field definition is malformed", () => {
  const plan = buildNewWorkIntakePlan({
    classifierResult:{
      decision:"CLASSIFIED_SINGLE",
      routes:[{workflow_id:"wf-repair",work_type:"riparazione"}],
      candidate_workflow_ids:[],
      reason:"Richiesta di riparazione."
    },
    workflows:[{
      id:"wf-repair",workflow_key:"repair",name:"Riparazione",
      required_data:{fields:[{label:"Senza chiave"}]}
    }]
  });
  assert.equal(plan.ok,false);
  assert.equal(plan.status,"CONFIG_REQUIRED");
  assert.equal(plan.creation_allowed,false);
  assert.equal(plan.writes_performed,false);
  assert.equal(plan.workflow.required_data.reason,"REQUIRED_FIELD_KEY_INVALID");
});


test("fails closed when classifier workflow key does not match the active workflow ID", () => {
  const plan = buildNewWorkIntakePlan({
    classifierResult:{
      decision:"CLASSIFIED_SINGLE",
      routes:[{workflow_id:"wf-repair",workflow_key:"inspection",work_type:"riparazione"}],
      candidate_workflow_ids:[],
      reason:"Richiesta di riparazione."
    },
    workflows
  });
  assert.equal(plan.ok,false);
  assert.equal(plan.status,"WORKFLOW_NOT_AVAILABLE");
  assert.equal(plan.creation_allowed,false);
  assert.equal(plan.writes_performed,false);
  assert.equal(plan.reason,"WORKFLOW_KEY_MISMATCH");
});
