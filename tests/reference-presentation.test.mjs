import assert from 'node:assert/strict';
import test from 'node:test';
import {makeDocument,makeElement} from '../src/core.js';
import {composeReferencePresentation} from '../src/reference-presentation.js';
import {exportPPTX,importPPTX,unzipSafe} from '../src/pptx.js';

const ctx={font:'',measureText(text){return{width:String(text).length*11};}};
const fixture=()=>{
  const doc=makeDocument();
  doc.slides[0].elements=[];
  return doc;
};

test('reference footers and paginated slides stay outside the authored document',async()=>{
  const doc=fixture(),before=JSON.stringify(doc),slideId=doc.slides[0].id;
  const presentation={id_revision:'revision-7',entries:[{number:1,source_id:'private-id',text:'A long public citation '.repeat(200)}],slides:[{slide_id:slideId,numbers:[1,1]}]};
  const composed=composeReferencePresentation(doc,presentation,ctx);
  assert.equal(JSON.stringify(doc),before);
  assert.match(composed.slides[0].elements.at(-1).text,/^Sources: \[1\]$/);
  assert.ok(composed.slides.length>2);
  assert.ok(composed.slides.slice(1).every(slide=>slide.elements.every(element=>element.y+element.h<=doc.height)));
  const blob=await exportPPTX(composed),files=await unzipSafe(await blob.arrayBuffer());
  assert.deepEqual(JSON.parse(new TextDecoder().decode(files.get('aurelia/document.json'))).slides.length,composed.slides.length);
  assert.ok(new TextDecoder().decode(files.get('aurelia/document.json')).includes('Sources: [1]'));
  assert.ok(!new TextDecoder().decode(files.get('aurelia/document.json')).includes('private-id'));
  const imported=await importPPTX(await blob.arrayBuffer());
  assert.equal(imported.doc.slides.length,composed.slides.length);
  assert.equal(imported.doc.slides[0].elements.at(-1).text,'Sources: [1]');
  assert.match(new TextDecoder().decode(files.get('ppt/slides/slide1.xml')),/Sources: \[1\]/);
  assert.ok(!new TextDecoder().decode(files.get('ppt/slides/slide1.xml')).includes('private-id'));
});

test('reference footer rejects occupied space instead of overlapping authored content',()=>{
  const doc=fixture();
  doc.slides[0].elements.push(makeElement('text',{x:100,y:680,w:200,h:25,text:'Existing footer'}));
  assert.throws(()=>composeReferencePresentation(doc,{entries:[{number:1,text:'Citation'}],slides:[{slide_id:doc.slides[0].id,numbers:[1]}]},ctx),/bottom 48 px reserved/);
});
