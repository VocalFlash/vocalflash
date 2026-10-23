import test from "node:test";
import assert from "node:assert/strict";
import {normalizeRequiredFields, validateRequiredDataExtraction} from "./new-work-required-data-extractor-v1.js";

test("accepts the documented array shape", () => {
  const result = normalizeRequiredFields([
    {key: "address", label: "Indirizzo", type: "string"}
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.configured, true);
  assert.equal(result.fields[0].key, "address");
});

test("accepts the documented fields-array shape", () => {
  const result = normalizeRequiredFields({
    fields: [{key: "issue", label: "Problema"}]
  });
  assert.equal(result.ok, true);
  assert.equal(result.configured, true);
  assert.equal(result.fields[0].key, "issue");
});

test("treats an empty object as no configured required data", () => {
  const result = normalizeRequiredFields({});
  assert.equal(result.ok, true);
  assert.equal(result.configured, false);
});

test("fails closed on arbitrary keyed objects instead of guessing fields", () => {
  const result = normalizeRequiredFields({
    address: "Indirizzo",
    issue: {label: "Problema"}
  });
  assert.equal(result.ok, false);
  assert.equal(result.configured, false);
  assert.equal(result.reason, "REQUIRED_DATA_OBJECT_SHAPE_UNSUPPORTED");
  assert.deepEqual(result.fields, []);
});

test("fails closed on malformed fields-array entries", () => {
  const result = normalizeRequiredFields({fields: [{label: "Senza chiave"}]});
  assert.equal(result.ok, false);
  assert.equal(result.reason, "REQUIRED_FIELD_KEY_INVALID");
});

function extractionFixture(confidence=0.75){
  return {
    fields:[{
      key:"address",
      status:"PROVIDED",
      value:"Via Etnea 10",
      evidence:"Il cliente ha detto: Via Etnea 10",
      confidence
    }],
    reason:"Indirizzo esplicitamente indicato"
  };
}

const normalizedFixture={fields:[{key:"address",label:"Indirizzo"}]};

test("accepts finite confidence values at both boundaries",()=>{
  for(const confidence of [0,1]){
    const result=validateRequiredDataExtraction(extractionFixture(confidence),normalizedFixture);
    assert.equal(result.fields[0].confidence,confidence);
    assert.equal(result.complete,true);
  }
});

test("rejects missing, non-finite, or out-of-range confidence",()=>{
  for(const confidence of [undefined,NaN,Infinity,-0.01,1.01,"0.9"]){
    const result=extractionFixture(confidence);
    if(confidence===undefined)delete result.fields[0].confidence;
    assert.throws(
      ()=>validateRequiredDataExtraction(result,normalizedFixture),
      /EXTRACTION_CONFIDENCE_INVALID/
    );
  }
});

test("requires PROVIDED evidence to be a verbatim excerpt of the original message",()=>{
  const grounded=extractionFixture(0.9);
  grounded.fields[0].evidence="Via Etnea 10";
  const valid=validateRequiredDataExtraction(grounded,normalizedFixture,"Il cliente segnala una perdita in Via Etnea 10, domani.");
  assert.equal(valid.complete,true);

  const fabricated=extractionFixture(0.9);
  fabricated.fields[0].evidence="Via Etnea 10";
  assert.throws(
    ()=>validateRequiredDataExtraction(fabricated,normalizedFixture,"Il cliente segnala una perdita in via Tenea, domani."),
    /EXTRACTION_EVIDENCE_NOT_IN_SOURCE/
  );
});

test("normalizes Unicode and whitespace before matching source evidence",()=>{
  const result=extractionFixture(0.8);
  result.fields[0].evidence="VIA   ETNEA 10";
  const validated=validateRequiredDataExtraction(result,normalizedFixture,"Il cliente: via Etnea 10");
  assert.equal(validated.complete,true);
});

test("rejects a PROVIDED value that is not literally present even when its evidence is",()=>{
  const fabricated=extractionFixture(0.95);
  fabricated.fields[0].value="Via Etnea 999";
  fabricated.fields[0].evidence="Via Etnea 10";
  assert.throws(
    ()=>validateRequiredDataExtraction(fabricated,normalizedFixture,"Il cliente segnala una perdita in Via Etnea 10."),
    /EXTRACTION_VALUE_NOT_IN_SOURCE/
  );
});
