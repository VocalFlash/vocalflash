import assert from "node:assert/strict";
import {buildWorkConsultation} from "../lib/owner-command-consult-v1.js";

const work={id:"work-1",title:"Ristrutturazione Rossi",summary:"Pratica aperta"};
const data=[
  {work_item_id:"work-1",field_key:"indirizzo",field_label:"Indirizzo",value:"Via Etnea 10",data_status:"confirmed",sensitivity_level:"standard"},
  {work_item_id:"work-1",field_key:"foto",field_label:"Foto",value:"ricevuta",data_status:"collected",sensitivity_level:"standard"}
];

const noRules=buildWorkConsultation({workItem:work,workflow:{required_data:{}},workData:data});
assert.equal(noRules.status,"AVAILABLE_FACTS_ONLY");
assert.equal(noRules.completeness.evaluable,false);
assert.equal(noRules.completeness.missing.length,0);

const configured=buildWorkConsultation({
  workItem:work,
  workflow:{required_data:{fields:[
    {key:"indirizzo",label:"Indirizzo"},
    {key:"foto",label:"Foto"},
    {key:"disponibilita",label:"Disponibilità"}
  ]}},
  workData:data
});
assert.equal(configured.status,"COMPLETENESS_EVALUATED");
assert.equal(configured.completeness.missing.length,1);
assert.equal(configured.completeness.missing[0].key,"disponibilita");
console.log("OWNER_COMMAND_C01_CONSULT_PASS 6/6");
