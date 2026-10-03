import {
  normalizeRequiredFields,
  validateRequiredDataExtraction,
  extractNewWorkRequiredData
} from "../lib/new-work-required-data-extractor-v1.js";

function assert(x,msg){if(!x)throw new Error(msg);}
function fakeClient(result){return {chat:{completions:{create:async()=>({choices:[{message:{content:JSON.stringify(result)}}],usage:{prompt_tokens:10,completion_tokens:10,total_tokens:20}})}}};}

const keyed=normalizeRequiredFields({zone:{label:"Zona"},photo:{label:"Foto"}});
assert(keyed.ok&&keyed.shape==="keyed_object"&&keyed.fields.length===2,"keyed object");
assert(keyed.fields[0].key==="zone"&&keyed.fields[1].key==="photo","keyed keys");

const fieldsArray=normalizeRequiredFields({fields:[{key:"address",label:"Indirizzo"},{key:"availability",label:"Disponibilità"}]});
assert(fieldsArray.ok&&fieldsArray.shape==="fields_array"&&fieldsArray.fields.length===2,"fields array");

const plainArray=normalizeRequiredFields(["budget",{key:"area",label:"Zona"}]);
assert(plainArray.ok&&plainArray.shape==="array"&&plainArray.fields.length===2,"plain array");

const duplicate=normalizeRequiredFields({fields:[{key:"zone"},{key:"zone"}]});
assert(!duplicate.ok&&duplicate.reason==="REQUIRED_FIELD_DUPLICATE","duplicate blocked");

let r=await extractNewWorkRequiredData({
  normalizedText:"Sono in zona centro. La foto te la mando domani.",
  workflow:{id:"11111111-1111-4111-8111-111111111111",workflow_key:"repair",name:"Riparazione",required_data:{zone:{label:"Zona"},photo:{label:"Foto"}}},
  client:fakeClient({fields:[
    {key:"zone",status:"PROVIDED",value:"centro",evidence:"zona centro",confidence:.99},
    {key:"photo",status:"MISSING",value:null,evidence:null,confidence:.99}
  ],reason:"Zona presente; foto promessa ma non ancora fornita."})
});
assert(r.ok&&r.status==="REQUIRED_DATA_INCOMPLETE"&&r.writes_performed===false,"future promise status");
assert(r.extraction.provided.length===1&&r.extraction.missing.length===1,"future promise split");
assert(r.extraction.missing[0].key==="photo","future photo missing");

r=await extractNewWorkRequiredData({
  normalizedText:"Forse riesco nel pomeriggio, non so ancora l'orario.",
  workflow:{id:"22222222-2222-4222-8222-222222222222",workflow_key:"appointment",name:"Appuntamento",required_data:{fields:[{key:"availability",label:"Disponibilità"}]}},
  client:fakeClient({fields:[{key:"availability",status:"UNCERTAIN",value:null,evidence:null,confidence:.82}],reason:"Disponibilità non sufficientemente determinata."})
});
assert(r.status==="REQUIRED_DATA_INCOMPLETE"&&r.extraction.uncertain.length===1&&!r.extraction.complete,"uncertain incomplete");

r=await extractNewWorkRequiredData({
  normalizedText:"Vorrei un preventivo.",
  workflow:{id:"33333333-3333-4333-8333-333333333333",workflow_key:"quote",name:"Preventivo",required_data:{}},
  client:fakeClient({fields:[],reason:"unused"})
});
assert(r.ok&&r.status==="NO_REQUIRED_DATA_CONFIGURED"&&r.model_called===false,"no config no model");

let threw=false;
try{
  validateRequiredDataExtraction({fields:[{key:"photo",status:"MISSING",value:"qualcosa",evidence:null,confidence:.5}],reason:"bad"},normalizeRequiredFields({photo:{label:"Foto"}}));
}catch{threw=true;}
assert(threw,"missing cannot carry value");

console.log("NEW_WORK_REQUIRED_DATA_EXTRACTOR_V1_PASS");
