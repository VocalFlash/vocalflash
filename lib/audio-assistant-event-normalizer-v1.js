const CONTENT_TYPES = new Set(["text", "audio_transcription", "audio_transcription_batch"]);

function requiredString(value, field, max = 12000) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`AUDIO_EVENT_INVALID:${field}`);
  }
  const normalized = value.trim();
  if (normalized.length > max) throw new TypeError(`AUDIO_EVENT_TOO_LONG:${field}`);
  return normalized;
}

function optionalString(value, field, max = 256) {
  if (value == null || value === "") return null;
  return requiredString(value, field, max);
}

function optionalTimestamp(value, field) {
  const timestamp = optionalString(value, field, 64);
  if (timestamp === null) return null;
  if (!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$/.test(timestamp) ||
      !Number.isFinite(Date.parse(timestamp))) {
    throw new TypeError(`AUDIO_EVENT_INVALID_TIMESTAMP:${field}`);
  }
  return timestamp;
}

/**
 * Pure, side-effect-free validation/normalization for the proposed audio event
 * contract. It does not call the API, persist data, transcribe media, or send replies.
 */
export function normalizeAudioAssistantEvent(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("AUDIO_EVENT_INVALID:input");
  }

  const externalAccountId = requiredString(input.external_account_id, "external_account_id", 256);
  const senderWaId = requiredString(input.sender_wa_id, "sender_wa_id", 64);
  const externalMessageId = requiredString(input.external_message_id, "external_message_id", 256);
  const contentType = requiredString(input.content_type ?? "text", "content_type", 32);
  if (!CONTENT_TYPES.has(contentType)) throw new TypeError("AUDIO_EVENT_INVALID:content_type");

  const occurredAt = optionalTimestamp(input.occurred_at, "occurred_at");
  const sourcePayload = input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
    ? input.payload
    : {};

  let normalizedText;
  let payload = {};

  if (contentType === "text") {
    normalizedText = requiredString(input.normalized_text, "normalized_text");
    payload.source = "whatsapp_text";
  } else if (contentType === "audio_transcription") {
    normalizedText = requiredString(input.normalized_text, "normalized_text");
    const status = requiredString(sourcePayload.transcription_status, "payload.transcription_status", 32);
    if (status !== "succeeded") throw new TypeError("AUDIO_EVENT_TRANSCRIPTION_NOT_READY");
    payload.source = "whatsapp_audio_transcription";
    payload.transcription_status = "succeeded";
    payload.transcription_language = optionalString(sourcePayload.transcription_language, "payload.transcription_language", 32);
    payload.transcription_provider = optionalString(sourcePayload.transcription_provider, "payload.transcription_provider", 128);
    payload.transcription_version = optionalString(sourcePayload.transcription_version, "payload.transcription_version", 128);
  } else {
    const batch = sourcePayload.audio_batch;
    if (!batch || typeof batch !== "object" || Array.isArray(batch)) {
      throw new TypeError("AUDIO_EVENT_INVALID:payload.audio_batch");
    }
    const batchId = requiredString(batch.batch_id, "payload.audio_batch.batch_id", 256);
    const finalizationReason = requiredString(batch.finalization_reason, "payload.audio_batch.finalization_reason", 64);
    const allowedReasons = new Set(["quiet_window", "explicit_finish", "manual_summary", "timeout"]);
    if (!allowedReasons.has(finalizationReason)) throw new TypeError("AUDIO_EVENT_INVALID:finalization_reason");
    if (!Array.isArray(batch.segments) || batch.segments.length === 0) {
      throw new TypeError("AUDIO_EVENT_INVALID:payload.audio_batch.segments");
    }

    const segments = batch.segments.map((segment, index) => {
      if (!segment || typeof segment !== "object" || Array.isArray(segment)) {
        throw new TypeError(`AUDIO_EVENT_INVALID:segment_${index}`);
      }
      const sourceMessageId = requiredString(segment.source_message_id, `segment_${index}.source_message_id`, 256);
      const transcript = requiredString(segment.transcript, `segment_${index}.transcript`);
      const status = requiredString(segment.transcription_status, `segment_${index}.transcription_status`, 32);
      if (status !== "succeeded") {
        throw new TypeError("AUDIO_EVENT_BATCH_INCOMPLETE");
      }
      return {
        source_message_id: sourceMessageId,
        transcript,
        occurred_at: optionalTimestamp(segment.occurred_at, `segment_${index}.occurred_at`),
        transcription_status: "succeeded"
      };
    });

    const sourceMessageIds = segments.map(segment => segment.source_message_id);
    if (new Set(sourceMessageIds).size !== sourceMessageIds.length) {
      throw new TypeError("AUDIO_EVENT_DUPLICATE_SOURCE_MESSAGE");
    }
    const declaredIds = batch.source_message_ids;
    if (declaredIds !== undefined && (
      !Array.isArray(declaredIds) ||
      declaredIds.length !== sourceMessageIds.length ||
      declaredIds.some((id, index) => id !== sourceMessageIds[index])
    )) {
      throw new TypeError("AUDIO_EVENT_SOURCE_ORDER_MISMATCH");
    }

    normalizedText = segments.map((segment, index) => `[Vocale ${index + 1}]\\n${segment.transcript}`).join("\\n\\n");
    if (normalizedText.length > 12000) throw new TypeError("AUDIO_EVENT_TOO_LONG:normalized_text");
    payload = {
      source: "whatsapp_audio_transcription_batch",
      audio_batch: {
        batch_id: batchId,
        source_message_ids: sourceMessageIds,
        finalization_reason: finalizationReason,
        segments
      }
    };
  }

  return {
    external_account_id: externalAccountId,
    sender_wa_id: senderWaId,
    external_message_id: externalMessageId,
    occurred_at: occurredAt,
    content_type: contentType,
    normalized_text: normalizedText,
    payload
  };
}
