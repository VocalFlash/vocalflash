import test from "node:test";
import assert from "node:assert/strict";
import {normalizeAudioAssistantEvent} from "./audio-assistant-event-normalizer-v1.js";

const base = {
  external_account_id: "account-1",
  sender_wa_id: "sender-1",
  external_message_id: "message-1",
  occurred_at: "2026-10-24T10:00:00Z"
};

test("normalizes ordinary text without mutating the input", () => {
  const input = {...base, normalized_text: "  Il rubinetto perde  "};
  const before = structuredClone(input);
  const result = normalizeAudioAssistantEvent(input);
  assert.equal(result.normalized_text, "Il rubinetto perde");
  assert.equal(result.content_type, "text");
  assert.equal(result.payload.source, "whatsapp_text");
  assert.deepEqual(input, before);
});

test("accepts an audio transcript only after successful transcription", () => {
  const result = normalizeAudioAssistantEvent({
    ...base,
    content_type: "audio_transcription",
    normalized_text: "Il rubinetto perde da ieri",
    payload: {transcription_status: "succeeded", transcription_language: "it-IT", transcription_provider: "whisper"}
  });
  assert.equal(result.payload.source, "whatsapp_audio_transcription");
  assert.equal(result.payload.transcription_status, "succeeded");
  assert.equal(result.payload.transcription_language, "it-IT");
});

test("fails closed on empty transcript or unsuccessful ASR", () => {
  assert.throws(() => normalizeAudioAssistantEvent({
    ...base, content_type: "audio_transcription", normalized_text: " ",
    payload: {transcription_status: "succeeded"}
  }), /AUDIO_EVENT_INVALID:normalized_text/);
  assert.throws(() => normalizeAudioAssistantEvent({
    ...base, content_type: "audio_transcription", normalized_text: "test",
    payload: {transcription_status: "failed"}
  }), /AUDIO_EVENT_TRANSCRIPTION_NOT_READY/);
});

test("normalizes a complete batch and preserves source segment order", () => {
  const result = normalizeAudioAssistantEvent({
    ...base,
    content_type: "audio_transcription_batch",
    normalized_text: "Vocale 1: perde acqua\nVocale 2: disponibile domani",
    payload: {audio_batch: {
      batch_id: "batch-1",
      source_message_ids: ["message-a", "message-b"],
      finalization_reason: "quiet_window",
      segments: [
        {source_message_id: "message-a", transcript: "perde acqua", transcription_status: "succeeded"},
        {source_message_id: "message-b", transcript: "disponibile domani", transcription_status: "succeeded"}
      ]
    }}
  });
  assert.deepEqual(result.payload.audio_batch.source_message_ids, ["message-a", "message-b"]);
  assert.equal(result.payload.audio_batch.segments.length, 2);
  assert.equal(result.payload.source, "whatsapp_audio_transcription_batch");
});

test("rejects incomplete batches, duplicate source IDs, and inconsistent order", () => {
  const make = (segments, source_message_ids) => ({
    ...base,
    content_type: "audio_transcription_batch",
    normalized_text: "trascrizioni",
    payload: {audio_batch: {
      batch_id: "batch-1", finalization_reason: "quiet_window", segments, source_message_ids
    }}
  });
  assert.throws(() => normalizeAudioAssistantEvent(make([
    {source_message_id: "m1", transcript: "uno", transcription_status: "succeeded"},
    {source_message_id: "m2", transcript: "due", transcription_status: "failed"}
  ])), /AUDIO_EVENT_BATCH_INCOMPLETE/);
  assert.throws(() => normalizeAudioAssistantEvent(make([
    {source_message_id: "m1", transcript: "uno", transcription_status: "succeeded"},
    {source_message_id: "m1", transcript: "due", transcription_status: "succeeded"}
  ])), /AUDIO_EVENT_DUPLICATE_SOURCE_MESSAGE/);
  assert.throws(() => normalizeAudioAssistantEvent(make([
    {source_message_id: "m1", transcript: "uno", transcription_status: "succeeded"},
    {source_message_id: "m2", transcript: "due", transcription_status: "succeeded"}
  ], ["m2", "m1"])), /AUDIO_EVENT_SOURCE_ORDER_MISMATCH/);
});

test("rejects unsupported event types and missing identifiers", () => {
  assert.throws(() => normalizeAudioAssistantEvent({...base, external_message_id: "", normalized_text: "test"}), /AUDIO_EVENT_INVALID:external_message_id/);
  assert.throws(() => normalizeAudioAssistantEvent({...base, content_type: "audio", normalized_text: "test"}), /AUDIO_EVENT_INVALID:content_type/);
});
test("drops unrecognized payload fields such as media URLs and secrets", () => {
  const result = normalizeAudioAssistantEvent({
    ...base,
    content_type: "audio_transcription",
    normalized_text: "Il rubinetto perde",
    payload: {
      transcription_status: "succeeded",
      transcription_provider: "whisper",
      media_url: "https://media.example/temporary",
      token: "must-not-leak",
      arbitrary_private_field: "private"
    }
  });
  assert.equal("media_url" in result.payload, false);
  assert.equal("token" in result.payload, false);
  assert.equal("arbitrary_private_field" in result.payload, false);
  assert.equal(result.payload.transcription_provider, "whisper");
});
test("rejects malformed timestamps instead of persisting ambiguous event times", () => {
  assert.throws(() => normalizeAudioAssistantEvent({
    ...base, occurred_at: "yesterday", normalized_text: "test"
  }), /AUDIO_EVENT_INVALID_TIMESTAMP:occurred_at/);
  assert.throws(() => normalizeAudioAssistantEvent({
    ...base, occurred_at: "2026-02-30T10:00:00Z", normalized_text: "test"
  }), /AUDIO_EVENT_INVALID_TIMESTAMP:occurred_at/);
  assert.throws(() => normalizeAudioAssistantEvent({
    ...base,
    content_type: "audio_transcription_batch",
    normalized_text: "ignored",
    payload: {audio_batch: {
      batch_id: "batch-1", finalization_reason: "quiet_window",
      segments: [{source_message_id: "m1", transcript: "uno", transcription_status: "succeeded", occurred_at: "not-a-date"}]
    }}
  }), /AUDIO_EVENT_INVALID_TIMESTAMP:segment_0.occurred_at/);
});

test("derives batch normalized text deterministically from ordered segments", () => {
  const result = normalizeAudioAssistantEvent({
    ...base,
    content_type: "audio_transcription_batch",
    normalized_text: "caller-supplied text must not override segments",
    payload: {audio_batch: {
      batch_id: "batch-1", finalization_reason: "quiet_window",
      segments: [
        {source_message_id: "m1", transcript: "perde acqua", transcription_status: "succeeded"},
        {source_message_id: "m2", transcript: "domani mattina", transcription_status: "succeeded"}
      ]
    }}
  });
  assert.equal(result.normalized_text, "[Vocale 1]\nperde acqua\n\n[Vocale 2]\ndomani mattina");
});
