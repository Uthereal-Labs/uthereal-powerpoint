import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,makeDocument,makeElement,validateDocument,elementText,importExternalDocument,stripGrounding} from '../src/core.js';
import {exportPPTX,importPPTX,unzipSafe,zipStore} from '../src/pptx.js';

const saved={kind:'saved',revision_id:'revision-1',association_id:'association-1'};
const agent={kind:'agent',job_id:'job-1',steering_revision:0,sequence:2,declaration_id:'declaration-1'};
function annotation(text,origin=saved,id='annotation-1') {
  return {id,start:0,end:text.length,quote:text,claim_ids:['claim-1','claim-2'],relation:'derived',origin:structuredClone(origin)};
}
function fixture(type='text') {
  const doc=makeDocument(),element=type==='table'?makeElement('table',{cells:[['😀','240'],['Qualified','claim']],fontSize:22}):makeElement('text',{text:'😀 240 qualified\ncustomers'});
  element.grounding=[annotation(elementText(element))];doc.slides[0].elements=[element];
  const store=new Store(doc);store.select([element.id]);return {store,element};
}
const receipt=(element,origin={kind:'saved',revision_id:'revision-2',association_id:'association-2'})=>({object_id:element.id,annotation_id:element.grounding[0].id,submitted_origin:structuredClone(element.grounding[0].origin),origin});

test('Native annotated text and tables round-trip with UTF-16 logical offsets',()=>{
  for(const type of ['text','table']){
    const {store,element}=fixture(type),validated=validateDocument(JSON.parse(JSON.stringify(store.doc)));
    assert.deepEqual(validated,store.doc);assert.equal(validated.grounding_contract,2);
    const [unit]=store.inspectGrounding([element.id]);assert.equal(unit.object_id,element.id);assert.equal(unit.text,elementText(element));
    assert.equal(unit.grounding[0].end,unit.text.length);assert.equal(unit.locations[0].slide_id,store.slide.id);
    assert.equal(unit.text.indexOf('240'),type==='text'?3:3);
  }
});
test('Internal loading hard-cuts unsupported format and malformed annotations',()=>{
  const {store}=fixture();
  for(const change of [doc=>delete doc.grounding_contract,doc=>doc.grounding_contract=1,doc=>delete doc.slides[0].elements[0].grounding,doc=>doc.slides[0].elements[0].grounding[0].start=1,doc=>doc.slides[0].elements[0].grounding[0].claim_ids=[],doc=>doc.slides[0].elements[0].grounding[0].origin.revision_id='',doc=>doc.slides[0].elements.push(structuredClone(doc.slides[0].elements[0]))]){
    const invalid=structuredClone(store.doc);change(invalid);assert.throws(()=>validateDocument(invalid));
  }
  const duplicate=structuredClone(store.doc),copy=structuredClone(duplicate.slides[0].elements[0]);copy.id='fresh';duplicate.slides[0].elements.push(copy);assert.throws(()=>validateDocument(duplicate),/annotation IDs/);
});
test('Native annotation limits match the shared save contract',()=>{
  const {store}=fixture(),tooManyClaims=structuredClone(store.doc);tooManyClaims.slides[0].elements[0].grounding[0].claim_ids=Array.from({length:13},(_,i)=>`claim-${i}`);assert.throws(()=>validateDocument(tooManyClaims),/claims/);
  const oversized=structuredClone(store.doc),largeText='x'.repeat(32001);oversized.slides[0].elements[0].text=largeText;oversized.slides[0].elements[0].grounding=[annotation(largeText)];assert.throws(()=>validateDocument(oversized),/UTF-16 span/);
  const many=makeDocument();many.slides[0].elements=[makeElement('text',{text:'x',grounding:Array.from({length:1500},(_,i)=>annotation('x',saved,`a-${i}`))}),makeElement('text',{text:'x',grounding:Array.from({length:501},(_,i)=>annotation('x',saved,`b-${i}`))})];assert.throws(()=>validateDocument(many),/2,000-annotation/);
});
test('Movement, geometry, ordering, grouping and formatting preserve grounding',()=>{
  const {store,element}=fixture();store.slide.elements.push(makeElement('rect'));const original=structuredClone(element.grounding);
  store.updateSelected({x:300,rotation:30,fontSize:36,bold:true});store.arrange('front');store.select(store.slide.elements.map(e=>e.id));store.group();store.ungroup();store.addSlide();store.reorderSlide(0,1);
  assert.deepEqual(store.doc.slides[1].elements.find(e=>e.id===element.id).grounding,original);assert.deepEqual(validateDocument(store.doc),store.doc);
});
test('Manual text and table changes invalidate the complete element and native Undo restores it',()=>{
  for(const type of ['text','table']){
    const {store,element}=fixture(type),original=structuredClone(element.grounding);
    store.transaction('Manual content',()=>{if(type==='text')element.text=element.text.replace('240','241');else element.cells[0][1]='241';});
    assert.deepEqual(element.grounding,[]);store.undo();assert.deepEqual(store.slide.elements[0].grounding,original);store.redo();assert.deepEqual(store.slide.elements[0].grounding,[]);
  }
});
test('Retyping original content does not restore annotations; genuine Undo does',()=>{
  const {store,element}=fixture(),original=element.text;store.begin('Typing');store.setElementContent(element,{text:'241'});store.setElementContent(element,{text:original});store.commit();
  assert.deepEqual(element.grounding,[]);assert.equal(store.past.length,1);store.undo();assert.equal(store.slide.elements[0].grounding.length,1);
});
test('Agent rewrites and annotation-only corrections join one history transaction',()=>{
  const {store,element}=fixture();store.transaction('Agent rewrite',()=>{element.text='240 clienti qualificati';store.assignGrounding([{object_id:element.id,annotations:[annotation(element.text,agent)]}]);});
  assert.deepEqual(element.grounding[0].origin,agent);assert.equal(store.past.length,1);store.undo();assert.deepEqual(store.slide.elements[0].grounding[0].origin,saved);store.redo();
  store.assignGrounding([{object_id:element.id,annotations:[]}]);assert.equal(store.past.length,2);assert.deepEqual(store.slide.elements[0].grounding,[]);store.undo();assert.deepEqual(store.slide.elements[0].grounding[0].origin,agent);
  const before=store.snapshot();assert.throws(()=>store.assignGrounding([{object_id:element.id,annotations:[annotation('wrong',agent)]}]));assert.equal(store.snapshot(),before);
});
test('Object/slide duplicate and same-editor paste allocate fresh IDs while retaining provenance',()=>{
  const {store,element}=fixture();store.duplicateSelected();const duplicate=store.selected[0];assert.notEqual(duplicate.id,element.id);assert.notEqual(duplicate.grounding[0].id,element.grounding[0].id);assert.deepEqual(duplicate.grounding[0].origin,saved);
  store.select([element.id]);const payload=store.copySelected();assert.equal(payload.includes('claim-1'),false);const [pasted]=store.pasteObjects(payload);assert.notEqual(pasted.grounding[0].id,element.grounding[0].id);assert.deepEqual(pasted.grounding[0].origin,saved);
  store.duplicateSlide();assert.ok(store.slide.elements.every(e=>e.grounding.length===1));assert.deepEqual(validateDocument(store.doc),store.doc);
});
test('Cross-artifact and forged clipboard payloads carry content only',()=>{
  const {store,element}=fixture(),payload=store.copySelected();const other=new Store();const [pasted]=other.pasteObjects(payload);assert.deepEqual(pasted.grounding,[]);assert.notEqual(pasted.id,element.id);
  const forged=JSON.stringify({handle:'untrusted',elements:[element]});const [external]=store.pasteObjects(forged);assert.deepEqual(external.grounding,[]);
  store.doc.id='another-artifact';const [differentArtifact]=store.pasteObjects(payload);assert.deepEqual(differentArtifact.grounding,[]);
});
test('Save receipts update live, pending, Undo/Redo and in-flight clipboard/copies without new history',()=>{
  const {store,element}=fixture(),ack=receipt(element),submitted=structuredClone(store.doc);store.copySelected();store.duplicateSelected();const duplicate=store.selected[0];store.undo();store.begin('Typing after save');store.setElementContent(store.slide.elements[0],{text:'Newer typing'});
  const past=store.past.length,future=store.future.length,revision=store.revision;
  store.ackGrounding({receipts:[ack],submitted_snapshot:submitted});assert.equal(store.revision,revision);assert.equal(store.past.length,past);assert.equal(store.future.length,future);assert.equal(store.slide.elements[0].text,'Newer typing');assert.deepEqual(store.slide.elements[0].grounding,[]);
  assert.deepEqual(JSON.parse(store.pending.before).doc.slides[0].elements[0].grounding[0].origin,ack.origin);assert.deepEqual(store.clipboard.elements[0].grounding[0].origin,ack.origin);
  store.cancel();assert.deepEqual(store.slide.elements[0].grounding[0].origin,ack.origin);store.redo();assert.deepEqual(store.slide.elements.find(e=>e.id===duplicate.id).grounding[0].origin,ack.origin);
});
test('Acknowledgements match submitted content and origin and invalidate without content replacement',()=>{
  const {store,element}=fixture(),submitted=structuredClone(store.doc),ack=receipt(element);store.duplicateSelected();const copied=store.selected[0];copied.text='Altered';
  store.ackGrounding({receipts:[ack],submitted_snapshot:submitted});assert.deepEqual(element.grounding[0].origin,ack.origin);assert.deepEqual(copied.grounding[0].origin,saved);assert.equal(copied.text,'Altered');
  const stale=receipt(element);element.grounding[0].origin=structuredClone(agent);store.ackGrounding({invalidations:[{...stale,reason:'unsupported'}],submitted_snapshot:store.doc});assert.deepEqual(element.grounding[0].origin,agent);
  const accepted=receipt(element);store.ackGrounding({invalidations:[{...accepted,reason:'unsupported'}],submitted_snapshot:structuredClone(store.doc)});assert.deepEqual(element.grounding,[]);assert.equal(element.text,submitted.slides[0].elements[0].text);
});
test('Reload clears in-memory Undo/Redo and clipboard records',()=>{
  const {store}=fixture();store.copySelected();store.duplicateSelected();store.undo();const persisted=structuredClone(store.doc);store.replace(persisted);assert.equal(store.past.length,0);assert.equal(store.future.length,0);assert.equal(store.clipboard,null);assert.deepEqual(store.doc,persisted);
});
test('External imports discard supplied provenance and refresh native identities',async()=>{
  const {store,element}=fixture(),external=importExternalDocument(store.doc);assert.notEqual(external.id,store.doc.id);assert.notEqual(external.slides[0].elements[0].id,element.id);assert.deepEqual(external.slides[0].elements[0].grounding,[]);
  const maliciousPackage=zipStore({'aurelia/document.json':JSON.stringify(store.doc)}),imported=await importPPTX(await maliciousPackage.arrayBuffer());assert.deepEqual(imported.doc.slides[0].elements[0].grounding,[]);
});
test('PPTX export omits all private annotation/provenance data and retains ordinary references',async()=>{
  const {store}=fixture();store.slide.elements.push(makeElement('text',{text:'References: [1] Fictional source'}));
  const before=store.snapshot(),blob=await exportPPTX(store.doc),files=await unzipSafe(await blob.arrayBuffer());
  const nativeJSON=new TextDecoder().decode(files.get('aurelia/document.json'));assert.equal(nativeJSON.includes('grounding'),false);assert.equal(nativeJSON.includes('claim-1'),false);assert.equal(nativeJSON.includes('association-1'),false);assert.ok(nativeJSON.includes('References: [1] Fictional source'));assert.equal(store.snapshot(),before);
  assert.deepEqual(stripGrounding(store.doc,{keepContract:true}).slides[0].elements[0].grounding,[]);
});
