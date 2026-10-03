import {buildNewWorkDataCollectionPlan} from "../lib/new-work-data-collection-plan-v1.js";

function assert(x,msg){if(!x)throw new Error(msg);}

const intakeConfigured={ok:true,status:"WORKFLOW_IDENTIFIED",workflow:{required_data:{configured:true}}};
const intakeNoRequired={ok:true,status:"WORKFLOW_IDENTIFIED",workflow:{required_data:{configured:false}}};

let r=buildNewWorkDataCollectionPlan({intakePlan:intakeNoRequired});
assert(r.ok&&r.status==="CREATION_POLICY_REQUIRED","no required policy gate");
assert(r.data_collection_required===false&&r.creation_allowed===false,"no required no auto create");

r=buildNewWorkDataCollectionPlan({
  intakePlan:intakeConfigured,
  extractionResult:{
    ok:true,
    required_data:{fields:[{key:"zone",label:"Zona"},{key:"photo",label:"Foto"},{key:"availability",label:"Disponibilità"}]},
    extraction:{
      provided:[{key:"zone",status:"PROVIDED",value:"Recanati"}],
      missing:[{key:"photo",status:"MISSING",value:null,evidence:"Te la mando domani"}],
      uncertain:[{key:"availability",status:"UNCERTAIN",value:"martedì pomeriggio",evidence:"Forse martedì pomeriggio"}],
      complete:false
    }
  }
});
assert(r.status==="DATA_COLLECTION_REQUIRED","collection status");
assert(r.ask_together===true,"collect together");
assert(JSON.stringify(r.missing_fields)==='["photo"]',"missing preserved");
assert(JSON.stringify(r.confirmation_fields)==='["availability"]',"uncertain confirmation");
assert(r.required_fields.length===2,"two fields together");
assert(r.creation_allowed===false&&r.writes_performed===false,"collection no write");

r=buildNewWorkDataCollectionPlan({
  intakePlan:intakeConfigured,
  extractionResult:{
    ok:true,
    required_data:{fields:[{key:"area",label:"Zona"},{key:"budget",label:"Budget"}]},
    extraction:{provided:[{key:"area"},{key:"budget"}],missing:[],uncertain:[],complete:true}
  }
});
assert(r.status==="CREATION_POLICY_REQUIRED","complete still policy gate");
assert(r.data_collection_required===false,"complete no collection");
assert(r.creation_allowed===false,"complete no auto create");

r=buildNewWorkDataCollectionPlan({intakePlan:{ok:true,status:"CLARIFICATION_REQUIRED"}});
assert(r.ok&&r.status==="NO_DATA_COLLECTION_FOR_CURRENT_INTAKE_STATUS","ambiguous bypass collection");
assert(r.creation_allowed===false,"ambiguous no create");

r=buildNewWorkDataCollectionPlan({intakePlan:intakeConfigured});
assert(!r.ok&&r.status==="EXTRACTION_REQUIRED","missing extraction blocked");

console.log("NEW_WORK_DATA_COLLECTION_PLAN_V1_PASS");
