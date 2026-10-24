-- VocalFlash staging-only pilot seed.
-- Guarded to the exact synthetic staging business. Never run against production.
-- Idempotent: preserves existing vocabulary rows and upserts the workflow/policy.
-- The active canonical terms are synthetic test context; extended metadata remains draft
-- and is intentionally ignored by the model context until a domain owner reviews it.
DO $$
DECLARE
  v_business_id uuid;
  v_business_count integer;
  v_workflow_id uuid;
  v_policy_rows integer;
  v_term record;
BEGIN
  SELECT count(*)::integer
    INTO v_business_count
    FROM public.businesses
   WHERE name = 'VocalFlash — STAGING TEST'
     AND is_active = true;

  IF v_business_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one active VocalFlash staging business; found %', v_business_count;
  END IF;

  SELECT id
    INTO v_business_id
    FROM public.businesses
   WHERE name = 'VocalFlash — STAGING TEST'
     AND is_active = true;

  UPDATE public.businesses
     SET sector_key = 'plumbing_maintenance',
         sector_label = 'Idraulica e manutenzione (STAGING)',
         updated_at = now()
   WHERE id = v_business_id;

  -- Retire only the explicitly named generic test fixture; do not delete its history.
  UPDATE public.workflows
     SET is_active = false,
         updated_at = now()
   WHERE business_id = v_business_id
     AND workflow_key = 'generic_request_test'
     AND is_active = true;

  INSERT INTO public.workflows (
    business_id, workflow_key, name, version, description, required_data,
    states_config, actions_config, assistant_instructions, is_active, updated_at
  )
  VALUES (
    v_business_id,
    'maintenance_request',
    'Richiesta intervento idraulico/manutenzione — STAGING',
    1,
    'Workflow pilota sintetico per richieste di assistenza idraulica/manutenzione. Non implica diagnosi tecnica né assegnazione automatica.',
    jsonb_build_object(
      'fields', jsonb_build_array(
        jsonb_build_object(
          'key', 'problem_description',
          'label', 'Problema riscontrato',
          'description', 'Descrivi il sintomo o il lavoro richiesto usando solo informazioni esplicite del cliente. Non dedurre la causa tecnica.',
          'type', 'string'
        ),
        jsonb_build_object(
          'key', 'service_location',
          'label', 'Indirizzo o zona dell’intervento',
          'description', 'Raccogli l’indirizzo o la zona dichiarata. Non completare indirizzi o numeri civici mancanti.',
          'type', 'string'
        ),
        jsonb_build_object(
          'key', 'availability_window',
          'label', 'Disponibilità per l’intervento',
          'description', 'Raccogli il giorno o la fascia oraria dichiarata dal cliente. Se manca, chiedi quando è disponibile.',
          'type', 'string'
        )
      )
    ),
    jsonb_build_object(
      'initial_state', 'intake',
      'states', jsonb_build_array('intake', 'awaiting_customer_data', 'ready_for_owner_review', 'created', 'closed'),
      'runtime_enforced', false,
      'note', 'Descrittivo: il runtime attuale non persiste ancora il contesto multi-turno.'
    ),
    jsonb_build_object(
      'create_work_item', jsonb_build_object(
        'enabled', false,
        'requires_complete_required_data', true,
        'requires_explicit_owner_confirmation', true,
        'runtime_enforced', false,
        'note', 'La creazione resta bloccata finché la conferma atomica del titolare non supera i release gate.'
      )
    ),
    jsonb_build_object(
      'collection_rules', jsonb_build_array(
        'Classificare solo richieste esplicite e operative; una parola tecnica da sola non è un intento.',
        'Chiedere i campi obbligatori mancanti o incerti senza inventare valori.',
        'Preservare la formulazione originale del cliente e distinguere sintomo riferito da causa accertata.',
        'Non creare la pratica su classificazione ambigua o multi-workflow.',
        'Non dichiarare la pratica aperta prima di una conferma persistita.',
        'Foto e messaggi media-only non sono supportati da questo workflow finché il percorso media non è completo.'
      ),
      'runtime_enforcement_note', 'Le regole effettivamente applicate oggi sono i campi required_data, i controlli di estrazione e la policy. Gli altri campi di configurazione sono descrittivi.'
    ),
    true,
    now()
  )
  ON CONFLICT (business_id, workflow_key, version)
  DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    required_data = EXCLUDED.required_data,
    states_config = EXCLUDED.states_config,
    actions_config = EXCLUDED.actions_config,
    assistant_instructions = EXCLUDED.assistant_instructions,
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_workflow_id;

  UPDATE public.assistant_policies
     SET autonomy_mode = 'confirm',
         sensitivity_level = 'standard',
         config = jsonb_build_object(
           'policy_version', 'v1-staging',
           'creation_conditions', jsonb_build_array(
             'Esattamente un workflow attivo e coerente con la richiesta.',
             'Tutti i campi obbligatori devono essere PROVIDED con evidenza letterale nel messaggio sorgente.',
             'Qualsiasi campo MISSING o UNCERTAIN blocca la creazione e richiede chiarimento.',
             'Classificazione ambigua o multi-workflow richiede revisione umana e non crea pratiche.',
             'Il messaggio deve esprimere una richiesta operativa; la terminologia non costituisce prova di intento.',
             'La policy effettiva deve essere rivalutata al commit.'
           ),
           'data_collection', jsonb_build_object(
             'ask_missing_fields', true,
             'ask_uncertain_fields', true,
             'preserve_customer_wording', true,
             'infer_technical_cause', false
           ),
           'owner_confirmation', jsonb_build_object(
             'required', true,
             'runtime_enabled', false,
             'release_gate', 'ATOMIC_CONFIRMATION_NOT_ENABLED'
           ),
           'effective_behavior', 'CONFIRMATION_REQUIRED; no work item is created by this policy until the atomic owner-confirmation path is implemented and verified.',
           'configuration_note', 'The current policy evaluator enforces autonomy_mode. Other keys document the intended policy and are not independently enforced by the runtime.'
         ),
         is_active = true,
         updated_at = now()
   WHERE business_id = v_business_id
     AND workflow_id = v_workflow_id
     AND scope = 'workflow'
     AND policy_key = 'create_work_item';

  GET DIAGNOSTICS v_policy_rows = ROW_COUNT;

  IF v_policy_rows = 0 THEN
    INSERT INTO public.assistant_policies (
      business_id, workflow_id, scope, policy_key, autonomy_mode,
      sensitivity_level, config, is_active, updated_at
    )
    VALUES (
      v_business_id, v_workflow_id, 'workflow', 'create_work_item', 'confirm',
      'standard',
      jsonb_build_object(
        'policy_version', 'v1-staging',
        'creation_conditions', jsonb_build_array(
          'Esattamente un workflow attivo e coerente con la richiesta.',
          'Tutti i campi obbligatori devono essere PROVIDED con evidenza letterale nel messaggio sorgente.',
          'Qualsiasi campo MISSING o UNCERTAIN blocca la creazione e richiede chiarimento.',
          'Classificazione ambigua o multi-workflow richiede revisione umana e non crea pratiche.',
          'Il messaggio deve esprimere una richiesta operativa; la terminologia non costituisce prova di intento.',
          'La policy effettiva deve essere rivalutata al commit.'
        ),
        'data_collection', jsonb_build_object(
          'ask_missing_fields', true,
          'ask_uncertain_fields', true,
          'preserve_customer_wording', true,
          'infer_technical_cause', false
        ),
        'owner_confirmation', jsonb_build_object(
          'required', true,
          'runtime_enabled', false,
          'release_gate', 'ATOMIC_CONFIRMATION_NOT_ENABLED'
        ),
        'effective_behavior', 'CONFIRMATION_REQUIRED; no work item is created by this policy until the atomic owner-confirmation path is implemented and verified.',
        'configuration_note', 'The current policy evaluator enforces autonomy_mode. Other keys document the intended policy and are not independently enforced by the runtime.'
      ),
      true,
      now()
    );
  END IF;

  FOR v_term IN
    SELECT *
      FROM (VALUES
        ('perdita d’acqua', 'perdita d’acqua', 'symptom',
         ARRAY['perdita', 'perde acqua']::text[],
         'Fuoriuscita d’acqua riferita dal cliente.',
         'È un sintomo riferito e non prova quale componente sia guasto.',
         ARRAY['C’è una perdita d’acqua sotto il lavandino.']::text[],
         ARRAY['infiltrazione']::text[]),
        ('scarico ostruito', 'scarico ostruito', 'symptom',
         ARRAY['scarico tappato', 'l’acqua non defluisce']::text[],
         'Difficoltà o impossibilità di deflusso riferita dal cliente.',
         'Non dedurre la causa o la posizione dell’ostruzione.',
         ARRAY['Lo scarico del bagno è ostruito.']::text[],
         ARRAY['perdita d’acqua']::text[]),
        ('sifone', 'sifone', 'component',
         ARRAY['sifone del lavandino']::text[],
         'Componente del sistema di scarico.',
         'Non assumere che sia la causa del problema se il cliente lo nomina soltanto.',
         ARRAY['Sento odore vicino al sifone.']::text[],
         ARRAY['colonna di scarico']::text[]),
        ('raccordo', 'raccordo', 'component',
         ARRAY['raccordo del tubo']::text[],
         'Elemento di collegamento tra componenti idraulici.',
         'Preservare modello e dimensioni se dichiarati; non dedurre una sostituzione.',
         ARRAY['Il raccordo perde acqua.']::text[],
         ARRAY['valvola']::text[]),
        ('valvola', 'valvola', 'component',
         ARRAY['valvola di chiusura']::text[],
         'Componente che regola o interrompe il passaggio del fluido.',
         'Non confondere la menzione della valvola con una diagnosi.',
         ARRAY['Non riesco a chiudere la valvola.']::text[],
         ARRAY['rubinetto']::text[]),
        ('rubinetto', 'rubinetto', 'component',
         ARRAY['miscelatore']::text[],
         'Dispositivo di erogazione dell’acqua.',
         'Un rubinetto che gocciola descrive un sintomo, non una causa certa.',
         ARRAY['Il rubinetto gocciola.']::text[],
         ARRAY['valvola']::text[]),
        ('guarnizione', 'guarnizione', 'component',
         ARRAY['guarnizione di tenuta']::text[],
         'Elemento usato per realizzare una tenuta tra superfici o componenti.',
         'Non inferire che debba essere sostituita senza valutazione del tecnico.',
         ARRAY['La guarnizione sembra consumata.']::text[],
         ARRAY['raccordo']::text[]),
        ('tubo flessibile', 'tubo flessibile', 'component',
         ARRAY['flessibile']::text[],
         'Condotto flessibile di collegamento.',
         'Non confonderlo con la tubazione fissa o con il raccordo.',
         ARRAY['Il tubo flessibile sotto il lavello perde.']::text[],
         ARRAY['raccordo', 'colonna di scarico']::text[]),
        ('colonna di scarico', 'colonna di scarico', 'system',
         ARRAY['colonna condominiale di scarico']::text[],
         'Tratto verticale dell’impianto di scarico dell’edificio.',
         'Non attribuire responsabilità condominiali o causa tecnica senza verifica.',
         ARRAY['L’acqua risale dalla colonna di scarico.']::text[],
         ARRAY['sifone', 'scarico ostruito']::text[]),
        ('pressione dell’acqua', 'pressione dell’acqua', 'symptom',
         ARRAY['pressione bassa', 'poca pressione']::text[],
         'Pressione dell’acqua descritta o percepita dal cliente.',
         'Non inferire la causa; chiedere se il problema riguarda uno o più punti di erogazione quando utile.',
         ARRAY['La pressione dell’acqua è molto bassa.']::text[],
         ARRAY['portata']::text[]),
        ('caldaia', 'caldaia', 'equipment',
         ARRAY['caldaia domestica']::text[],
         'Apparecchiatura per riscaldamento e/o acqua calda sanitaria.',
         'Raccogliere il messaggio d’errore esatto se disponibile; non diagnosticare il guasto.',
         ARRAY['La caldaia mostra il codice errore E01.']::text[],
         ARRAY['scaldabagno']::text[]),
        ('infiltrazione', 'infiltrazione', 'symptom',
         ARRAY['macchia di umidità']::text[],
         'Segnalazione di acqua o umidità che penetra in una struttura.',
         'La presenza di una macchia non identifica da sola origine o responsabilità.',
         ARRAY['C’è una macchia di umidità sul soffitto.']::text[],
         ARRAY['perdita d’acqua']::text[]),
        ('sopralluogo', 'sopralluogo', 'work_action',
         ARRAY['visita tecnica', 'controllo sul posto']::text[],
         'Richiesta di verifica presso il luogo indicato.',
         'Non equivale a un appuntamento confermato.',
         ARRAY['Vorrei fissare un sopralluogo.']::text[],
         ARRAY['appuntamento']::text[]),
        ('preventivo', 'preventivo', 'work_action',
         ARRAY['stima dei costi']::text[],
         'Richiesta di una stima economica per un lavoro.',
         'Non equivale ad approvazione del lavoro o del prezzo.',
         ARRAY['Vorrei un preventivo per sostituire il rubinetto.']::text[],
         ARRAY['approvazione del lavoro']::text[])
      ) AS seed(term, normalized_term, category, synonyms, definition, disambiguation, examples, confusable_with)
  LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM public.business_vocabulary
       WHERE business_id = v_business_id
         AND normalized_term = v_term.normalized_term
    ) THEN
      INSERT INTO public.business_vocabulary (
        business_id, term, normalized_term, category, source, metadata, is_active, updated_at
      )
      VALUES (
        v_business_id,
        v_term.term,
        v_term.normalized_term,
        v_term.category,
        'synthetic_staging_seed',
        jsonb_build_object(
          'review_status', 'draft',
          'source', 'synthetic_staging_seed',
          'version', '1.0-draft',
          'synonyms', to_jsonb(v_term.synonyms),
          'definition', v_term.definition,
          'disambiguation', v_term.disambiguation,
          'examples', to_jsonb(v_term.examples),
          'confusable_with', to_jsonb(v_term.confusable_with),
          'review_note', 'Synthetic staging seed only; extended metadata must not be treated as approved until reviewed by a domain owner.'
        ),
        true,
        now()
      );
    END IF;
  END LOOP;
END
$$;
