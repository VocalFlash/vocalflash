import {buildWorkConsultation} from "../lib/owner-command-consult-v1.js";

const work={id:"work-1",title:"Ristrutturazione Rossi",summary:"Pratica aperta"};
const data=[
  {work_item_id:"work-1",field_key:"indirizzo",field_label:"Indirizzo",value:"Via Etnea 10",data_status:"confirmed",sensitivity_level:"standard"},
  {work_item_id:"work-1",field_key:"foto",field_label:"Foto",value:"ricevuta",data_status:"collected",sensitivity_level:"standard"}
];

const noRules=buildWorkConsultation({
  workItem:work,
  workflow:{required_data:{}},
  workData:data
});
if(noRules.status!=="AVAILABLE_FACTS_ONLY")throw new Error("C01_NO_RULES_STATUS");
if(noRules.completeness.evaluable!==false)throw new Error("C01_NO_RULES_EVALUATED");
if(noRules.completeness.missing.length!==0)throw new Error("C01_NO_RULES_INVENTED_MISSING");

const configured=buildWorkConsultation({
  workItem:work,
  workflow:{required_data:{fields:[
    {key:"indirizzo",label:"Indirizzo"},
    {key:"foto",label:"Foto"},
    {key:"disponibilita",label:"Disponibilità"}
  ]}},
  workData:data
});
if(configured.status!=="COMPLETENESS_EVALUATED")throw new Error("C01_CONFIGURED_STATUS");
if(configured.completeness.missing.length!==1||configured.completeness.missing[0].key!=="disponibilita")throw new Error("C01_CONFIGURED_MISSING_WRONG");

console.log("OWNER_COMMAND_C01_CONSULT_PASS 2/2");
