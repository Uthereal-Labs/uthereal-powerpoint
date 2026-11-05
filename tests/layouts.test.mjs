import test from 'node:test';
import assert from 'node:assert/strict';
import {layouts,configureLayoutMeasurement,fontFamilyFor,Store,makeDocument,validateDocument,copySlide,importExternalDocument,stripGrounding,makeElement} from '../src/core.js';
import {wrapText,fontCSS} from '../src/renderer.js';
import {exportPPTX,unzipSafe} from '../src/pptx.js';
// Deterministic glyph metrics exercise the production wrapping algorithm, including newlines.
configureLayoutMeasurement((element,width)=>{
 const glyph=element.fontSize*(element.fontFamily==='Georgia'?.65:.5);
 return wrapText({measureText:text=>({width:[...text].length*glyph})},element.text,width).length;
});
const fixture=(count=3)=>{const doc=makeDocument();doc.slides[0].elements=[];const component=layouts.create(doc,doc.slides[0].id,{type:'process',title:'How it works',steps:Array.from({length:count},(_,index)=>({id:`step-${index}`,title:`Step ${index+1}`,body:'A clear next action.'})),emphasis_step_id:'step-1'});return {doc,component,slide:doc.slides[0]};};
const element=(slide,id)=>slide.elements.find(item=>item.id===id);
test('process creates readable equal panels for 2–6 steps without duplicate text',()=>{
 for(const count of [2,3,4,5,6]){const {doc,component,slide}=fixture(count);assert.equal(component.steps.length,count);assert.equal(layouts.inspect(doc)[0].overflow,false);const panels=component.steps.map(step=>element(slide,step.panel_id));assert.equal(new Set(panels.map(panel=>panel.w)).size,1);assert.equal(new Set(panels.map(panel=>panel.h)).size,1);assert.ok(panels.at(-1).x+panels.at(-1).w<=1208.001);assert.equal(slide.elements.filter(item=>item.text==='A clear next action.').length,count);assert.ok(component.steps.every(step=>element(slide,step.title_id).fontSize>=18));assert.deepEqual(validateDocument(doc),doc);}
});
test('manual text reflows live, preserves identity/evidence, and undo/cancel restores content and geometry',()=>{
 const {doc,component,slide}=fixture(),store=new Store(doc),step=component.steps[0],title=element(slide,step.title_id),panel=element(slide,step.panel_id);
 title.grounding=[{id:'annotation',anchor:{scope:'object'},claim_ids:['claim'],relation:'supports',origin:{kind:'saved',revision_id:'revision',association_id:'association'}}];
 const before=JSON.stringify(store.doc),originalHeight=panel.h,ids=slide.elements.map(item=>item.id);
 store.begin('Edit text');store.setElementContent(title,{text:'A heading that wraps over several lines and needs a taller panel'});assert.ok(panel.h>originalHeight);assert.equal(store.past.length,0);store.commit();assert.equal(store.past.length,1);assert.deepEqual(store.slide.elements.map(item=>item.id),ids);assert.equal(element(store.slide,step.title_id).grounding[0].id,'annotation');store.undo();assert.equal(JSON.stringify(store.doc),before);store.redo();assert.ok(element(store.slide,step.panel_id).h>originalHeight);
 const restored=JSON.stringify(store.doc);store.begin('Edit text');store.setElementContent(element(store.slide,step.title_id),{text:'Short'});store.cancel();assert.equal(JSON.stringify(store.doc),restored);
});
test('content count, ordering and emphasis change without replacing surviving slots',()=>{
 const {doc,component,slide}=fixture(4),retained=structuredClone(component.steps[2]);layouts.update(doc,component.id,{steps:[{id:retained.id,title:'Changed'},{id:component.steps[0].id},{id:'new-step',title:'New',body:'Added content'}],emphasis_step_id:retained.id});assert.deepEqual(component.steps[0],retained);assert.equal(element(slide,retained.title_id).text,'Changed');assert.equal(element(slide,retained.number_id).text,'1');assert.equal(element(slide,retained.panel_id).fill,'@dark');assert.equal(component.steps.length,3);assert.equal(slide.elements.filter(item=>item.type==='roundRect').length,3);assert.equal(new Set(slide.elements.map(item=>item.id)).size,slide.elements.length);assert.doesNotThrow(()=>validateDocument(doc));
});
test('impossible text and narrow frames report overflow and retain every character',()=>{
 const {doc,component,slide}=fixture(6),text='Very long meaningful description '.repeat(100);layouts.update(doc,component.id,{steps:component.steps.map((step,index)=>({id:step.id,...(index===0?{body:text}:{})}))});assert.equal(layouts.inspect(doc)[0].overflow,true);assert.equal(layouts.normalize(doc)[0].kind,'layout_overflow');assert.equal(element(slide,component.steps[0].body_id).text,text);assert.equal(element(slide,component.steps[0].body_id).fontSize,18);assert.ok(element(slide,component.steps[0].panel_id).h>layouts.inspect(doc)[0].effective_frame.h);
});
test('theme roles remeasure while explicit fonts retain their choice',()=>{
 const {doc,component,slide}=fixture(6),store=new Store(doc),title=element(slide,component.steps[0].title_id);title.text='Wide title';store.transaction('Theme',()=>doc.theme='studio');const serifHeight=title.h;assert.equal(fontFamilyFor(title,doc.theme),'Georgia');store.transaction('Theme',()=>doc.theme='mono');assert.equal(fontFamilyFor(title,doc.theme),'Arial');assert.ok(title.h<serifHeight);store.select([title.id]);store.updateSelected({fontFamily:'Verdana'});assert.equal(title.fontRole,undefined);store.transaction('Theme',()=>doc.theme='forest');assert.equal(fontFamilyFor(title,doc.theme),'Verdana');assert.match(fontCSS(title,doc.theme),/Verdana/);assert.equal(fontFamilyFor(makeElement('text',{fontFamily:'Times New Roman'}),'forest'),'Times New Roman');
});
test('managed geometry and deletion require explicit detach; detach preserves content and supports undo',()=>{
 const {doc,component,slide}=fixture(),store=new Store(doc),id=component.steps[0].title_id;store.select([id]);assert.throws(()=>store.updateSelected({x:1}),/Detach/);assert.throws(()=>store.deleteSelected(),/Detach/);const before=structuredClone(slide.elements);store.transaction('Detach',()=>layouts.detach(doc,component.id));assert.equal(slide.components,undefined);assert.deepEqual(slide.elements.map(item=>item.text),before.map(item=>item.text));store.updateSelected({x:1});assert.equal(element(slide,id).x,1);store.undo();store.undo();assert.equal(store.slide.components[0].id,component.id);assert.equal(element(store.slide,id).text,before.find(item=>item.id===id).text);
});
test('duplicate slide, full selection and clipboard copies retain independent adaptive membership',()=>{
 const {doc,component}=fixture(),store=new Store(doc);store.duplicateSlide();const copied=store.slide.components[0];assert.notEqual(copied.id,component.id);assert.notEqual(copied.steps[0].title_id,component.steps[0].title_id);layouts.update(doc,copied.id,{steps:copied.steps.map((step,index)=>({id:step.id,...(index===0?{title:'Independent'}:{})}))});assert.notEqual(element(doc.slides[0],component.steps[0].title_id).text,'Independent');store.select(store.slide.elements.map(item=>item.id));store.duplicateSelected();assert.equal(store.slide.components.length,2);assert.doesNotThrow(()=>validateDocument(doc));store.copySelected();store.pasteObjects();assert.equal(store.slide.components.length,3);assert.doesNotThrow(()=>validateDocument(doc));
});
test('copying all visible members carries hidden layout slots, while a partial copy stays freeform',()=>{
 const {doc,component,slide}=fixture(2),store=new Store(doc);
 layouts.update(doc,component.id,{steps:component.steps.map(step=>({id:step.id,body:''}))});
 const visible=slide.elements.filter(element=>!element.hidden).map(element=>element.id);
 assert.ok(visible.length<slide.elements.length);
 store.select(visible);const packet=JSON.parse(store.copySelected());
 assert.equal(packet.components.length,1);assert.equal(packet.elements.length,slide.elements.length);
 store.pasteObjects();assert.equal(store.slide.components.length,2);
 store.select(visible);store.duplicateSelected();assert.equal(store.slide.components.length,3);
 assert.doesNotThrow(()=>validateDocument(store.doc));
 const partial=fixture(2),partialStore=new Store(partial.doc);partialStore.select([partial.component.steps[0].title_id]);
 const fragment=JSON.parse(partialStore.copySelected());assert.equal(fragment.components.length,0);assert.equal(fragment.elements.length,1);
 partialStore.pasteObjects();partialStore.duplicateSelected();assert.equal(partialStore.slide.components.length,1);
 assert.doesNotThrow(()=>validateDocument(partialStore.doc));
});
test('save/reopen preserves adaptation and import remaps references without trusting grounding',()=>{
 const {doc,component,slide}=fixture(),saved=JSON.parse(JSON.stringify(stripGrounding(doc,{keepContract:true})));assert.deepEqual(validateDocument(saved).slides[0].components,slide.components);const imported=importExternalDocument(saved),copy=imported.slides[0].components[0];assert.notEqual(imported.id,doc.id);assert.notEqual(copy.id,component.id);assert.notEqual(copy.steps[0].id,component.steps[0].id);assert.ok(imported.slides[0].elements.some(item=>item.id===copy.title_id));layouts.update(imported,copy.id,{steps:copy.steps.map(step=>({id:step.id,body:'After reopen'}))});assert.equal(element(imported.slides[0],copy.steps[0].body_id).text,'After reopen');assert.ok(imported.slides[0].elements.every(item=>item.grounding.length===0));assert.doesNotThrow(()=>validateDocument({...doc,slides:[copySlide(slide)]}));
});
test('invalid step count, repeated slots, dangling references and component ID collisions are rejected',()=>{
 for(const count of [0,1,7])assert.throws(()=>fixture(count),/2–6/);
 for(const change of [doc=>doc.slides[0].components[0].steps[0].title_id='missing',doc=>doc.slides[0].components[0].steps[1].title_id=doc.slides[0].components[0].steps[0].title_id,doc=>doc.slides[0].components[0].id=doc.slides[0].id]){const {doc}=fixture();change(doc);assert.throws(()=>validateDocument(doc));}
});
test('PowerPoint keeps process text and geometry editable with resolved theme fonts',async()=>{
 const {doc}=fixture();const files=await unzipSafe(await (await exportPPTX(doc)).arrayBuffer()),decode=path=>new TextDecoder().decode(files.get(path));const xml=decode('ppt/slides/slide1.xml');assert.match(xml,/How it works/);assert.match(xml,/Step 1/);assert.match(xml,/<p:txBody>/);assert.match(xml,/Georgia/);assert.ok(!xml.includes('<p:pic>'));assert.match(decode('ppt/theme/theme1.xml'),/<a:majorFont><a:latin typeface="Georgia"/);assert.ok(files.has('ppt/slides/slide1.xml'));
});

test('draft content changes do not mutate the live store and preserve passage grounding immediately',()=>{
 const {doc,component,slide}=fixture(),store=new Store(doc),title=element(slide,component.steps[0].title_id);
 title.grounding=[{id:'passage',anchor:{scope:'passage',quote:'Step 1',start:0,end:6},claim_ids:['claim'],relation:'supports',origin:{kind:'saved',revision_id:'revision',association_id:'association'}}];
 const before=JSON.stringify(doc),draft=structuredClone(doc),draftTitle=element(draft.slides[0],title.id);
 store.setElementContent(draftTitle,{text:'Changed heading with several extra words',fontFamily:'Verdana'},draft);assert.equal(JSON.stringify(store.doc),before);assert.equal(draftTitle.fontRole,undefined);assert.deepEqual(draftTitle.grounding[0].anchor,{scope:'object'});
 layouts.update(draft,component.id,{steps:component.steps.map((step,index)=>({id:step.id,...(index===0?{title:'A third heading'}:{})}))});assert.equal(JSON.stringify(store.doc),before);assert.doesNotThrow(()=>validateDocument(draft));
});
const catalogCases=[
 ['comparison',{items:[{id:'left',title:'Build',body:'Control the experience and own the maintenance.'},{id:'right',title:'Buy',body:'Launch quickly with a recurring vendor commitment.'}]},'items','title_id'],
 ['key_figures',{figures:[{id:'growth',value:'42%',label:'Growth',context:'Compared with the previous period.'},{id:'time',value:'2×',label:'Faster',context:'For the measured workflow.'}]},'figures','context_id'],
 ['takeaway_evidence',{takeaway:'Choose a direction based on evidence.',points:[{id:'proof',text:'The strongest observation supports the recommendation.'},{id:'caveat',text:'The remaining uncertainty needs a measured follow-up.'}]},'points','text_id'],
];
test('catalog uses the same editable native slots, measured reflow and atomic undo lifecycle',()=>{
 for(const [type,input,collection,textSlot]of catalogCases){const doc=makeDocument();doc.slides[0].elements=[];const store=new Store(doc);let component;store.transaction('Create layout',()=>component=layouts.create(doc,store.active,{type,title:'A clear message',...input}));assert.equal(layouts.inspect(doc)[0].overflow,false,type);assert.deepEqual(validateDocument(doc),doc);const row=component[collection][0],id=row[textSlot],text=element(store.slide,id),before=JSON.stringify(doc);store.begin('Edit content');store.setElementContent(text,{text:'Additional important context '.repeat(120)});assert.equal(layouts.inspect(doc)[0].overflow,true,type);store.commit();assert.equal(component[collection][0][textSlot],id);store.undo();assert.equal(JSON.stringify(store.doc),before);store.redo();assert.equal(element(store.slide,id).text,'Additional important context '.repeat(120));}
});
test('figures support one to four values and comparison requires exactly two alternatives',()=>{
 for(const count of [1,4]){const doc=makeDocument(),component=layouts.create(doc,doc.slides[0].id,{type:'key_figures',figures:Array.from({length:count},(_,index)=>({value:`${index+1}×`,label:'Measured result',context:'A useful context.'}))});assert.equal(component.figures.length,count);assert.equal(layouts.inspect(doc)[0].overflow,false);}
 for(const [type,input]of [['comparison',{items:[{title:'Only one'}]}],['key_figures',{figures:Array.from({length:5},()=>({value:'5',label:'Too many'}))}],['takeaway_evidence',{takeaway:'Claim',points:Array.from({length:5},()=>({text:'Too many points'}))}]]){const doc=makeDocument(),store=new Store(doc),before=JSON.stringify(doc);assert.throws(()=>store.transaction('Invalid layout',()=>layouts.create(doc,store.active,{type,...input})));assert.equal(JSON.stringify(store.doc),before);}
});
test('all catalog memberships survive full copying and external import with fresh slot IDs',()=>{
 for(const [type,input,collection]of catalogCases){const doc=makeDocument();doc.slides[0].elements=[];const original=layouts.create(doc,doc.slides[0].id,{type,title:'A clear message',...input}),copy=copySlide(doc.slides[0]),copied=copy.components[0];assert.notEqual(copied.id,original.id);assert.notEqual(copied[collection][0].id,original[collection][0].id);assert.ok(layouts.elementIds(copied).every(id=>copy.elements.some(item=>item.id===id)));const imported=importExternalDocument(doc);assert.deepEqual(validateDocument(imported),imported);assert.equal(imported.slides[0].components[0].type,type);assert.notEqual(imported.slides[0].components[0].id,original.id);}
});
test('takeaway chart preserves original chart identity/content through reflow, theme, detach and undo',()=>{
 const doc=makeDocument(),slide=doc.slides[0];slide.elements=[];const chart=makeElement('chart',{chartType:'bar',labels:['A','B'],values:[1,2],highlight:0,showValues:true});slide.elements.push(chart);const store=new Store(doc);let component;store.transaction('Chart layout',()=>component=layouts.create(doc,slide.id,{type:'takeaway_evidence',title:'Evidence',takeaway:'The second category is larger.',chart_id:chart.id}));assert.equal(component.chart_id,chart.id);assert.equal(component.points.length,0);assert.equal(layouts.inspect(doc)[0].overflow,false);const before=structuredClone(chart);store.transaction('Theme',()=>doc.theme='slate');assert.deepEqual(chart,before);store.transaction('Takeaway',()=>layouts.update(doc,component.id,{takeaway:'A changed conclusion with the original chart.'}));assert.equal(chart.id,before.id);assert.deepEqual(chart.labels,before.labels);const imported=importExternalDocument(doc),copy=imported.slides[0].components[0];assert.notEqual(copy.chart_id,chart.id);assert.equal(element(imported.slides[0],copy.chart_id).type,'chart');store.transaction('Detach',()=>layouts.detach(doc,component.id));assert.equal(slide.elements.find(item=>item.id===chart.id),chart);assert.deepEqual(chart.values,[1,2]);store.undo();assert.equal(store.slide.components[0].chart_id,chart.id);
});
test('existing chart membership cannot be shared and small evidence frames report overflow',()=>{
 const doc=makeDocument(),slide=doc.slides[0],chart=makeElement('chart',{chartType:'bar',labels:['A'],values:[1]});slide.elements=[chart];const store=new Store(doc);let component;store.transaction('Create',()=>component=layouts.create(doc,slide.id,{type:'takeaway_evidence',takeaway:'Claim',chart_id:chart.id}));const before=JSON.stringify(doc);assert.throws(()=>store.transaction('Share chart',()=>layouts.create(doc,slide.id,{type:'takeaway_evidence',takeaway:'Other claim',chart_id:chart.id})),/available chart/);assert.equal(JSON.stringify(store.doc),before);store.transaction('Small frame',()=>layouts.update(store.doc,component.id,{frame:{x:72,y:190,w:400,h:200}}));assert.equal(layouts.inspect(store.doc)[0].overflow,true);
});
test('layout input rejects oversized text rather than silently truncating content',()=>{
 const doc=makeDocument(),store=new Store(doc),before=JSON.stringify(doc);assert.throws(()=>store.transaction('Too much text',()=>layouts.create(doc,store.active,{type:'comparison',items:[{title:'A',body:'x'.repeat(100001)},{title:'B'}]})),/100,000/);assert.equal(JSON.stringify(store.doc),before);
});
test('new standard slide templates use theme roles while explicit fonts in existing decks remain unchanged',()=>{
 const doc=makeDocument(),title=doc.slides[0].elements[0];assert.equal(title.fontRole,'heading');assert.equal(fontFamilyFor(title,'forest'),'Georgia');const old=makeElement('text',{fontFamily:'Verdana'});doc.slides[0].elements=[old];assert.equal(validateDocument(doc).slides[0].elements[0].fontRole,undefined);assert.equal(fontFamilyFor(old,'forest'),'Verdana');
});
test('native layout boundary rejects irrelevant fields and blank new rows while preserving inspected partial updates',()=>{
 const invalid=[
  {type:'process',steps:[{title:'A'},{title:'B'}],figures:[{value:'4',label:'Ignored'}]},
  {type:'process',steps:[{id:'empty'},{title:'B'}]},
  {type:'comparison',items:[{title:'  '},{title:'B'}]},
  {type:'key_figures',figures:[{id:'new-figure',value:'42%'}]},
  {type:'takeaway_evidence',takeaway:'Claim',points:[{id:'empty-point'}]},
  {type:'takeaway_evidence',points:[{text:'Proof'}]},
  {type:'comparison',items:[{title:'A',value:'Ignored'},{title:'B'}]},
 ];
 for(const input of invalid){const store=new Store(),before=JSON.stringify(store.doc);assert.throws(()=>store.transaction('Invalid fields',()=>layouts.create(store.doc,store.active,input)));assert.equal(JSON.stringify(store.doc),before);}
 const {doc,component}=fixture();const first=component.steps[0];layouts.update(doc,component.id,{steps:component.steps.map(step=>({id:step.id}))});assert.equal(component.steps[0].title_id,first.title_id);assert.throws(()=>layouts.update(doc,component.id,{figures:[{value:'1',label:'Wrong type'}]}),/content fields/);
});
test('managed property guard rejects overwritten styles but preserves editable typography and chart styling',()=>{
 const {doc,component,slide}=fixture(),store=new Store(doc),title=element(slide,component.steps[0].title_id);store.select([title.id]);const before=JSON.stringify(doc);
 for(const props of [{x:1},{padding:24},{fill:'#FF0000'},{hidden:true}]){assert.throws(()=>store.updateSelected(props),/Detach/);assert.throws(()=>store.setElementContent(title,props),/Detach/);assert.equal(JSON.stringify(doc),before);}
 store.updateSelected({bold:false,fontSize:28,fontFamily:'Verdana'});assert.equal(title.fontSize,28);assert.equal(title.fontRole,undefined);assert.equal(title.bold,false);
 const evidenceDoc=makeDocument(),chart=makeElement('chart',{chartType:'bar',labels:['A'],values:[1]});evidenceDoc.slides[0].elements=[chart];layouts.create(evidenceDoc,evidenceDoc.slides[0].id,{type:'takeaway_evidence',takeaway:'A chart supports the claim.',chart_id:chart.id});assert.doesNotThrow(()=>layouts.assertProperties(evidenceDoc.slides[0],[chart.id],{fill:'#FF0000'}));
});
test('locked members protect layout edits, detachment and sibling text reflow atomically',()=>{
 const {doc,component,slide}=fixture(),store=new Store(doc),title=element(slide,component.steps[0].title_id),panel=element(slide,component.steps[1].panel_id);panel.locked=true;const before=JSON.stringify(doc);
 assert.throws(()=>store.transaction('Edit locked layout',()=>layouts.update(store.doc,component.id,{steps:component.steps.map((step,index)=>({id:step.id,...(index===0?{title:'Changed'}:{})}))})),/Unlock/);assert.equal(JSON.stringify(store.doc),before);
 assert.throws(()=>store.transaction('Detach locked layout',()=>layouts.detach(store.doc,component.id)),/Unlock/);assert.equal(JSON.stringify(store.doc),before);
 const liveTitle=element(store.slide,title.id);assert.throws(()=>store.setElementContent(liveTitle,{text:'Change sibling'}),/Unlock/);assert.equal(JSON.stringify(store.doc),before);
 const chart=makeElement('chart',{locked:true,chartType:'bar',labels:['A'],values:[1]});store.slide.elements.push(chart);assert.throws(()=>store.transaction('Use locked chart',()=>layouts.create(store.doc,store.active,{type:'takeaway_evidence',takeaway:'Claim',chart_id:chart.id})),/Unlock/);
});
