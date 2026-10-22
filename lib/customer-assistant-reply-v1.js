// Deterministic customer-facing replies for the guarded WhatsApp pipeline.
// Never claim a work item exists unless the coordinator confirms creation or replay.
function asArray(value){return Array.isArray(value)?value:[];}
function routingUnits(routing){
  if(Array.isArray(routing?.units))return routing.units;
  if(Array.isArray(routing?.decision_payload?.units))return routing.decision_payload.units;
  return [];
}
function clean(value,max=240){
  return typeof value==="string"?value.trim().slice(0,max):"";
}
function clarificationQuestion(unit){
  return clean(unit?.resolver?.clarification_question)
    ||clean(unit?.intake_gate?.clarification_question)
    ||clean(unit?.classifier?.clarification_question);
}

export function buildCustomerAssistantReply({routing,newWork}={}){
  const units=routingUnits(routing);
  const matched=units.find(unit=>unit?.next_action==="LINK_EXISTING_WORK");
  const clarification=units.find(unit=>String(unit?.next_action||"").startsWith("CLARIFY_"));
  if(clarification){
    const question=clarificationQuestion(clarification);
    return question
      ? question
      : "Per indirizzare correttamente la richiesta, puoi darmi qualche dettaglio in più?";
  }

  const status=clean(newWork?.status,80);
  if(status==="WORK_ITEM_EXISTS"||(status==="WORK_ITEM_CREATED"&&newWork?.replayed===true)){
    return "Ho già registrato questa richiesta e non ne creo una duplicata.";
  }
  if(status==="WORK_ITEM_CREATED"){
    return "Grazie, ho registrato la richiesta. Se hai altri dettagli utili, puoi scriverli qui.";
  }
  if(status==="DATA_COLLECTION_REQUIRED"){
    const requiredFields=asArray(newWork?.data_collection_plan?.required_fields);
    const missing=requiredFields
      .filter(field=>field?.status==="MISSING")
      .map(field=>clean(field?.label||field?.key,80))
      .filter(Boolean);
    const uncertain=requiredFields
      .filter(field=>field?.status==="UNCERTAIN")
      .map(field=>{
        const label=clean(field?.label||field?.key,80);
        const candidate=clean(typeof field?.candidate_value==="string"?field.candidate_value:"",100);
        if(!label)return "";
        return candidate
          ? "conferma "+label+" (ho capito «"+candidate+"»)"
          : "conferma "+label;
      })
      .filter(Boolean);
    const fields=[...missing,...uncertain];
    if(fields.length){
      return "Per completare la richiesta, mi servono queste informazioni: "
        +fields.join("; ")+". Puoi rispondere in un unico messaggio?";
    }
    return "Per completare la richiesta, puoi fornirmi qualche dettaglio in più?";
  }
  if(status==="DENIED"){
    return "Ho ricevuto la richiesta, ma non posso aprire automaticamente questa pratica. La richiesta resta in attesa di verifica da parte del titolare.";
  }
  if(status==="CONFIRMATION_REQUIRED"){
    return "Ho ricevuto la richiesta. Prima di aprire la pratica serve una conferma esplicita; al momento non è stata registrata alcuna apertura.";
  }
  if(status==="HANDOFF_REQUIRED"||status==="CONFIG_REQUIRED"){
    return "Ho ricevuto la richiesta, ma non ho ancora confermato l'apertura della pratica. È necessaria una verifica prima di procedere.";
  }
  if(status==="MULTI_NEW_REVIEW"||status==="MULTI_WORKFLOW_REVIEW"||status==="EVENT_REVIEW_REQUIRED"){
    return "Ho individuato più aspetti o tipologie di intervento e non ho aperto una pratica. Puoi indicarmi quale problema vuoi gestire per primo?";
  }
  if(status==="UNCLASSIFIED_REVIEW"||status==="WORKFLOW_NOT_AVAILABLE"||status==="INVALID_CLASSIFIER_RESULT"){
    return "Ho ricevuto la richiesta, ma non riesco ancora ad associarla con sicurezza a un tipo di pratica disponibile. Non ho aperto alcuna pratica; la richiesta richiede una verifica."; 
  }
  if(status==="NO_NEW_WORK_TO_PROCESS"&&!matched){
    return "Ho ricevuto il messaggio. Non ho aperto una nuova pratica; se vuoi segnalare un problema nuovo, descrivilo qui.";
  }

  if(matched){
    return "Il messaggio sembra riferirsi a una richiesta già aperta. Se riguarda un problema diverso, dimmelo; non ho registrato una nuova pratica.";
  }
  if(units.length&&units.every(unit=>unit?.next_action==="NO_NEW_WORK")){
    return "Ho ricevuto il messaggio. Se vuoi segnalare un nuovo problema, descrivilo qui.";
  }
  return "Ho ricevuto il tuo messaggio. La richiesta non è ancora confermata come pratica.";
}
