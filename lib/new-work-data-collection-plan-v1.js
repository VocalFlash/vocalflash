// VocalFlash NEW Work Data Collection Plan V1
// Read-only. Converts a validated required-data extraction into the next safe step.
// It never creates work_items, writes work_data, or sends messages.

function asArray(v){return Array.isArray(v)?v:[];}
function indexFields(requiredData){
  const fields=asArray(requiredData?.fields);
  return new Map(fields.map(f=>[f.key,f]));
}

export function buildNewWorkDataCollectionPlan({intakePlan,extractionResult}={}){
  if(!intakePlan||intakePlan.ok!==true){
    return {ok:false,status:"INTAKE_PLAN_REQUIRED",creation_allowed:false,writes_performed:false};
  }

  if(intakePlan.status!=="WORKFLOW_IDENTIFIED"){
    return {
      ok:true,
      status:"NO_DATA_COLLECTION_FOR_CURRENT_INTAKE_STATUS",
      intake_status:intakePlan.status,
      creation_allowed:false,
      writes_performed:false
    };
  }

  const required=intakePlan.workflow?.required_data;
  if(!required?.configured){
    return {
      ok:true,
      status:"CREATION_POLICY_REQUIRED",
      creation_allowed:false,
      writes_performed:false,
      data_collection_required:false,
      required_fields:[],
      reason:"Nessun required_data configurato per il workflow; nessun dato mancante viene inventato."
    };
  }

  if(!extractionResult||extractionResult.ok!==true||!extractionResult.extraction){
    return {
      ok:false,
      status:"EXTRACTION_REQUIRED",
      creation_allowed:false,
      writes_performed:false,
      data_collection_required:false
    };
  }

  const fieldIndex=indexFields(extractionResult.required_data);
  const missing=asArray(extractionResult.extraction.missing).map(x=>({
    key:x.key,
    label:fieldIndex.get(x.key)?.label||x.key,
    status:"MISSING",
    candidate_value:null,
    evidence:x.evidence??null
  }));
  const uncertain=asArray(extractionResult.extraction.uncertain).map(x=>({
    key:x.key,
    label:fieldIndex.get(x.key)?.label||x.key,
    status:"UNCERTAIN",
    candidate_value:x.value??null,
    evidence:x.evidence??null
  }));

  if(missing.length===0&&uncertain.length===0&&extractionResult.extraction.complete===true){
    return {
      ok:true,
      status:"CREATION_POLICY_REQUIRED",
      creation_allowed:false,
      writes_performed:false,
      data_collection_required:false,
      required_fields:[],
      provided_fields:asArray(extractionResult.extraction.provided).map(x=>x.key),
      reason:"Tutti i required_data configurati risultano forniti; serve ancora la policy esplicita prima di creare un work_item."
    };
  }

  const requiredFields=[...missing,...uncertain];
  return {
    ok:true,
    status:"DATA_COLLECTION_REQUIRED",
    creation_allowed:false,
    writes_performed:false,
    data_collection_required:true,
    ask_together:true,
    required_fields:requiredFields,
    missing_fields:missing.map(x=>x.key),
    confirmation_fields:uncertain.map(x=>x.key),
    provided_fields:asArray(extractionResult.extraction.provided).map(x=>x.key),
    next_step_requires_policy:true,
    reason:"Raccogliere insieme i dati mancanti e confermare quelli incerti prima di qualsiasi creazione della pratica."
  };
}
