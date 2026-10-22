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
  const clarification=units.find(unit=>String(unit?.next_action||"").startsWith("CLARIFY_"));
  if(clarification){
    const question=clarificationQuestion(clarification);
    return question
      ? question
      : "Per indirizzare correttamente la richiesta, puoi darmi qualche dettaglio in più?";
  }

  const status=clean(newWork?.status,80);
  if(status==="WORK_ITEM_CREATED"){
    return "Grazie, ho registrato la richiesta. Se hai altri dettagli utili, puoi scriverli qui.";
  }
  if(status==="WORK_ITEM_EXISTS"||(status==="WORK_ITEM_CREATED"&&newWork?.replayed===true)){
    return "Ho già registrato questa richiesta e non ne creo una duplicata.";
  }
  if(status==="DATA_COLLECTION_REQUIRED"){
    const fields=asArray(newWork?.data_collection_plan?.required_fields)
      .map(field=>clean(field?.label||field?.key,80))
      .filter(Boolean);
    if(fields.length){
      return "Per completare la richiesta, mi servono queste informazioni: "
        +fields.join(", ")+". Puoi indicarmele in un unico messaggio?";
    }
    return "Per completare la richiesta, puoi fornirmi qualche dettaglio in più?";
  }
  if(status==="CONFIRMATION_REQUIRED"||status==="HANDOFF_REQUIRED"||status==="CONFIG_REQUIRED"){
    return "Ho ricevuto la richiesta, ma non ho ancora confermato l'apertura della pratica. È necessaria una verifica prima di procedere.";
  }

  const matched=units.find(unit=>unit?.next_action==="LINK_EXISTING_WORK");
  if(matched){
    return "Ho collegato il messaggio alla richiesta già aperta. Se riguarda un problema diverso, dimmelo.";
  }
  if(units.length&&units.every(unit=>unit?.next_action==="NO_NEW_WORK")){
    return "Ho ricevuto il messaggio. Se vuoi segnalare un nuovo problema, descrivilo qui.";
  }
  return "Ho ricevuto il tuo messaggio. La richiesta non è ancora confermata come pratica.";
}
