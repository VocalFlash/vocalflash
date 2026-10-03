import {extractNewWorkRequiredData} from "../lib/new-work-required-data-extractor-v1.js";

if(!process.env.OPENAI_API_KEY)throw new Error("OPENAI_API_KEY_MISSING");
function assert(x,msg){if(!x)throw new Error(msg);}

const cases=[
  {
    id:"artisan_future_photo",
    workflow:{id:"11111111-1111-4111-8111-111111111111",workflow_key:"repair",name:"Intervento tecnico",required_data:{zone:{label:"Zona"},problem_since:{label:"Da quando"},photo:{label:"Foto"}}},
    text:"Sono a Recanati, la perdita è iniziata stamattina. La foto te la mando quando torno a casa.",
    expect:{PROVIDED:["zone","problem_since"],MISSING:["photo"],UNCERTAIN:[]}
  },
  {
    id:"real_estate_explicit",
    workflow:{id:"22222222-2222-4222-8222-222222222222",workflow_key:"property_search",name:"Ricerca immobile",required_data:{fields:[{key:"area",label:"Zona"},{key:"budget",label:"Budget"},{key:"property_type",label:"Tipologia immobile"}]}},
    text:"Cerco un appartamento a Catania, zona centro o Borgo, budget massimo 230 mila euro.",
    expect:{PROVIDED:["area","budget","property_type"],MISSING:[],UNCERTAIN:[]}
  },
  {
    id:"legal_missing_deadline",
    workflow:{id:"33333333-3333-4333-8333-333333333333",workflow_key:"legal_case",name:"Pratica legale",required_data:[{key:"counterparty",label:"Controparte"},{key:"deadline",label:"Scadenza"}]},
    text:"La controparte è la società Alfa Srl. Non ricordo quando scade il termine, devo controllare.",
    expect:{PROVIDED:["counterparty"],MISSING:[],UNCERTAIN:["deadline"]}
  },
  {
    id:"beauty_uncertain_availability",
    workflow:{id:"44444444-4444-4444-8444-444444444444",workflow_key:"beauty_booking",name:"Prenotazione trattamento",required_data:{service:{label:"Trattamento"},availability:{label:"Disponibilità"}}},
    text:"Vorrei fare la pulizia viso. Forse riesco martedì pomeriggio ma devo ancora vedere gli impegni.",
    expect:{PROVIDED:["service"],MISSING:[],UNCERTAIN:["availability"]}
  },
  {
    id:"pharma_commercial_missing_pharmacy",
    workflow:{id:"55555555-5555-4555-8555-555555555555",workflow_key:"pharma_sales_visit",name:"Visita commerciale farmacia",required_data:{pharmacy:{label:"Farmacia"},city:{label:"Città"},requested_product:{label:"Prodotto di interesse"}}},
    text:"Sono a Messina e vorrei informazioni sulla linea Dermalux. Ti confermo più tardi in quale farmacia ci vediamo.",
    expect:{PROVIDED:["city","requested_product"],MISSING:["pharmacy"],UNCERTAIN:[]}
  }
];

let passed=0;
for(const tc of cases){
  const r=await extractNewWorkRequiredData({normalizedText:tc.text,workflow:tc.workflow,openAiApiKey:process.env.OPENAI_API_KEY});
  assert(r.ok===true,tc.id+" not ok");
  assert(r.writes_performed===false,tc.id+" wrote data");
  const actual={
    PROVIDED:r.extraction.provided.map(x=>x.key).sort(),
    MISSING:r.extraction.missing.map(x=>x.key).sort(),
    UNCERTAIN:r.extraction.uncertain.map(x=>x.key).sort()
  };
  for(const status of ["PROVIDED","MISSING","UNCERTAIN"]){
    const exp=[...tc.expect[status]].sort();
    assert(JSON.stringify(actual[status])===JSON.stringify(exp),tc.id+" "+status+" expected="+JSON.stringify(exp)+" actual="+JSON.stringify(actual[status]));
  }
  passed++;
  console.log("NEW_DATA_AI_CASE_PASS",tc.id,JSON.stringify(actual));
}
console.log(`NEW_WORK_REQUIRED_DATA_EXTRACTOR_V1_AI_PASS ${passed}/${cases.length}`);
