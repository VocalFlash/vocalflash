import OpenAI from "openai";
import { DECOMPOSER_V3_PROMPT, decomposerV3Schema, validateDecomposerV3 } from "../api/message-decomposer-dry-run-v3.js";

const MODEL="gpt-6-luna";
// sequential isolation run EV1
const START=0,COUNT=1;
const CASES=[
 {id:"EV1",sector:"artigiano",t:"Ho pagato il saldo del preventivo 42, grazie.",must:[/pagat|pagament|saldo/i,/42/]},
 {id:"EV2",sector:"fisioterapia",t:"Domani non riesco a venire all'appuntamento delle 18, devo annullare.",must:[/appuntament|sedut/i,/annull|non.*ven/i]},
 {id:"EV3",sector:"artigiano",t:"La perdita si è risolta, non serve più venire per l'intervento di domani.",must:[/risolt/i,/non.*serve|annull|intervent/i]},
 {id:"EV4",sector:"edilizia",t:"Ecco la foto della crepa che mi avevate chiesto per il sopralluogo.",must:[/foto/i,/crepa|sopralluog/i]},
 {id:"EV5",sector:"legale",t:"Ho firmato e vi allego il documento relativo alla pratica Rossi.",must:[/firmat/i,/document|Rossi/i]},
 {id:"EV6",sector:"immobiliare",t:"Per la visita di via Umberto saremo in tre invece che in due.",must:[/via Umberto/i,/tre|3/i]},
 {id:"EV7",sector:"ristorazione",t:"Per la prenotazione Rossi di sabato passiamo da 6 a 8 persone.",must:[/Rossi|prenot/i,/8|otto/i]},
 {id:"EV8",sector:"mediazione_finanziaria",t:"Vi ho appena inviato le ultime due buste paga per il mutuo che stiamo seguendo.",must:[/buste paga/i,/mutuo/i]},
 {id:"EV9",sector:"agente_commerciale",t:"Farmacia Aurora ha confermato la visita di venerdì alle 10; il listino l'ho già inviato.",must:[/Aurora/i,/venerd|10|visita/i]},
 {id:"EV10",sector:"servizi_generici",t:"Ho ricevuto il documento che aspettavo, grazie. Potete considerare chiusa la pratica Rossi.",must:[/chius|chiusa|chiud/i,/Rossi/i]},
 {id:"EV11",sector:"estetica",t:"Confermo che dopo il trattamento va tutto bene, non serve fissare il controllo.",must:[/tutto bene|bene|nessun/i,/non.*serve|controll/i]},
 {id:"EV12",sector:"edilizia",t:"Il materiale è arrivato oggi in cantiere; potete procedere come concordato domani mattina.",must:[/material/i,/proced|domani/i]}
];

const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
const selected=CASES.slice(START,START+COUNT);
let fail=0,totalTokens=0,totalMs=0;
for(const tc of selected){
 const s=Date.now();
 try{
  const c=await client.chat.completions.create({
   model:MODEL,reasoning_effort:"low",
   messages:[{role:"system",content:DECOMPOSER_V3_PROMPT},{role:"user",content:JSON.stringify({message:tc.t})}],
   response_format:{type:"json_schema",json_schema:decomposerV3Schema()}
  });
  totalMs+=Date.now()-s; totalTokens+=c.usage?.total_tokens||0;
  const o=validateDecomposerV3(JSON.parse(c.choices[0].message.content));
  const routing=o.units.map(u=>u.routing_text).join(" ");
  const preserved=tc.must.every(re=>re.test(routing));
  const ok=o.mode==="SINGLE"&&o.units.length===1&&preserved;
  console.log("VF_V3_EXISTING_EVENT_EVAL",JSON.stringify({id:tc.id,sector:tc.sector,mode:o.mode,units:o.units.length,preserved,ok}));
  if(!ok)fail++;
 }catch(e){console.error("VF_V3_EXISTING_EVENT_ERROR",tc.id,e.message);fail++;}
}
console.log("VF_V3_EXISTING_EVENT_BATCH",JSON.stringify({start:START,cases:selected.length,fail,totalTokens,totalMs}));
if(fail)process.exit(1);
