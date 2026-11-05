import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {layouts,configureLayoutMeasurement,makeDocument,makeElement,validateDocument,Store,THEMES,setPresentationStyle,resolvePresentationStyle,fontFamilyFor,STYLE_FIELDS} from '../src/core.js';
import {wrapText,flattenScene,fontCSS} from '../src/renderer.js';
import {exportPPTX,unzipSafe} from '../src/pptx.js';
import {componentTextInset,measureComponentText} from '../src/components.js';
import {composeReferencePresentation} from '../src/reference-presentation.js';
configureLayoutMeasurement((element,width)=>wrapText({measureText:text=>({width:Array.from(text).length*element.fontSize*(element.fontFamily==='Georgia'?.6:.5)})},element.text,width).length);
const specs={process:{steps:[{title:'Discover',body:'Understand the customer.'},{title:'Deliver',body:'Ship a measured improvement.'}]},comparison:{items:[{title:'Build',body:'Own the workflow.'},{title:'Buy',body:'Adopt an existing workflow.'}]},key_figures:{figures:[{value:'42%',label:'Growth',context:'Measured this quarter.'},{value:'2×',label:'Speed',context:'For this workflow.'}]},takeaway_evidence:{takeaway:'Evidence supports a clear decision.',points:[{text:'Customer adoption grew.'},{text:'Retention improved.'}]}};
function deck(type='process',options={}){const doc=makeDocument();Object.assign(doc,options);doc.slides[0].elements=[];const component=layouts.create(doc,doc.slides[0].id,{type,title:'A clear message',...specs[type]});return {doc,component,slide:doc.slides[0]};}
const element=(slide,id)=>slide.elements.find(element=>element.id===id);

test('all four components share measured areas, semantic styles and source reservation across nine themes',()=>{
 for(const theme of Object.keys(THEMES))for(const type of Object.keys(specs)){
  const {doc,component,slide}=deck(type,{theme});
  const initial=layouts.inspect(doc)[0];assert.equal(initial.overflow,false,`${theme}/${type}`);assert.equal(component.frame,null);
  assert.equal(initial.area.footer.y,doc.height*.93);assert.ok(initial.area.frame.y>initial.area.title.y+initial.area.title.h);
  for(const text of slide.elements.filter(e=>e.type==='text'))assert.ok(text.fontSize>=18);
  const ids=slide.elements.map(e=>e.id),text=slide.elements.filter(e=>e.type==='text').map(e=>e.text);
  setPresentationStyle(doc,{headingFont:'Verdana',bodyFont:'Segoe UI',titleSize:44,componentHeadingSize:26,bodySize:20,panelPadding:24,itemSpacing:20,lineHeight:1.3});
  assert.equal(layouts.inspect(doc)[0].overflow,false,`${theme}/${type}/custom`);assert.deepEqual(slide.elements.map(e=>e.id),ids);assert.deepEqual(slide.elements.filter(e=>e.type==='text').map(e=>e.text),text);
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(doc))),doc);
 }
});

test('absent and wrapping titles use measured space for automatic and custom outer regions',()=>{
 for(const dimensions of [{width:1280,height:720},{width:1600,height:1000},{width:1080,height:1080}])for(const type of Object.keys(specs)){
  const {doc,component}=deck(type,dimensions),custom={x:90,y:70,w:doc.width-180,h:doc.height*.93-100};
  for(const frame of [null,custom]){
   layouts.update(doc,component.id,{frame,title:''});const empty=layouts.inspect(doc)[0];assert.equal(empty.area.title,null);assert.equal(empty.area.frame.y,empty.effective_frame.y);
   layouts.update(doc,component.id,{title:'A measured message'});const short=layouts.inspect(doc)[0];
   layouts.update(doc,component.id,{title:'A long title with several meaningful clauses that wraps onto additional lines across the available width '.repeat(3)});const long=layouts.inspect(doc)[0];
   assert.ok(long.area.frame.y>short.area.frame.y,`${type}/wrapped`);assert.ok(long.area.frame.h<short.area.frame.h);assert.deepEqual(long.effective_frame,empty.effective_frame);assert.equal(long.area.title.y,long.effective_frame.y);
  }
 }
});

test('deck edits, local overrides, reset and detach each preserve their intended style lifecycle',()=>{
 const {doc,component,slide}=deck(),store=new Store(doc),title=element(slide,component.steps[0].title_id),body=element(slide,component.steps[0].body_id);
 store.setPresentationStyle({headingFont:'Verdana',bodySize:23});assert.equal(store.past.length,1);assert.equal(title.fontFamily,'Verdana');assert.equal(body.fontSize,23);
 store.select([body.id]);store.updateSelected({fontSize:31,fontFamily:'Georgia',italic:true});store.setElementContent(body,{text:'A revised observation.'});
 store.setPresentationStyle({bodySize:26,bodyFont:'Segoe UI'});assert.equal(body.fontSize,31);assert.equal(body.fontFamily,'Georgia');assert.equal(body.italic,true);
 const before=JSON.stringify(doc);store.resetSelectedTypography();assert.equal(body.fontSize,26);assert.equal(body.fontFamily,'Segoe UI');assert.equal(body.italic,false);store.undo();assert.equal(JSON.stringify(store.doc),before);store.redo();
 store.transaction('Theme',()=>store.doc.theme='graphite');assert.equal(resolvePresentationStyle(store.doc).headingFont,'Verdana');
 const currentBody=element(store.slide,body.id);store.transaction('Detach',()=>layouts.detach(store.doc,component.id));const appearance=structuredClone(currentBody);
 assert.equal(currentBody.textRole,undefined);assert.equal(currentBody.fontRole,undefined);store.setPresentationStyle({bodyFont:'Courier New',bodySize:40});assert.deepEqual(currentBody,appearance);
 store.undo();store.undo();assert.equal(store.slide.components[0].id,component.id);
 store.setPresentationStyle({bodySize:null});assert.equal(store.doc.style.bodySize,undefined);store.setPresentationStyle({}, {reset:true});assert.equal(store.doc.style,undefined);
});

test('invalid style updates roll back, while valid unfit styles retain content and expose component fit reasons',()=>{
 const {doc,component,slide}=deck(),store=new Store(doc),before=JSON.stringify(doc);
 for(const patch of [{bodySize:17},{headingFont:'Imaginary Font'},{marginX:-1},{lineHeight:4},{unknown:4}]){assert.throws(()=>store.setPresentationStyle(patch));assert.equal(JSON.stringify(store.doc),before);}
 const messages=store.setPresentationStyle({componentHeadingSize:300,bodySize:180}).diagnostics;assert.equal(messages[0].component_id,component.id);assert.ok(messages[0].fit.some(item=>item.reason==='panel_height'));assert.equal(element(slide,component.steps[0].title_id).text,'Discover');assert.equal(element(store.slide,component.steps[0].title_id).fontSize,300);
 assert.throws(()=>store.setElementContent(element(store.slide,component.steps[0].title_id),{fontRole:'body'}),/semantic roles/);
 assert.ok(STYLE_FIELDS.every(field=>field.key&&field.group&&field.label));
});

test('theme-bound freeform fonts use deck overrides across rendering and editable PPTX; explicit fonts remain fixed',async()=>{
 const doc=makeDocument(),slide=doc.slides[0];slide.elements=[makeElement('text',{text:'Role heading',fontRole:'heading'}),makeElement('text',{text:'Role body',fontRole:'body'}),makeElement('text',{text:'Explicit',fontFamily:'Georgia'})];
 setPresentationStyle(doc,{headingFont:'Verdana',bodyFont:'Segoe UI'});
 const leaves=flattenScene(slide.elements,doc.theme,doc.style);assert.deepEqual(leaves.map(e=>e.fontFamily),['Verdana','Segoe UI','Georgia']);assert.equal(fontFamilyFor(slide.elements[0],doc.theme,doc.style),'Verdana');assert.match(fontCSS(slide.elements[0],doc.theme,doc.style),/Verdana/);
 const files=await unzipSafe(await (await exportPPTX(doc)).arrayBuffer()),xml=new TextDecoder().decode(files.get('ppt/slides/slide1.xml')),theme=new TextDecoder().decode(files.get('ppt/theme/theme1.xml'));
 for(const font of ['Verdana','Segoe UI','Georgia'])assert.ok(xml.includes(`typeface="${font}"`));assert.ok(theme.includes('typeface="Verdana"'));assert.ok(theme.includes('typeface="Segoe UI"'));
});

test('v1 fixture converts once without input mutation, content loss or history, preserving explicit regions and local styles',()=>{
 const previous=JSON.parse(readFileSync(new URL('./fixtures/presentation-v1.json',import.meta.url))),before=JSON.stringify(previous);
 const converted=validateDocument(previous),again=validateDocument(converted);assert.equal(JSON.stringify(previous),before);assert.deepEqual(again,converted);assert.equal(converted.version,2);
 assert.deepEqual(converted.slides.map(s=>({id:s.id,notes:s.notes,text:s.elements.map(e=>({id:e.id,text:e.text,grounding:e.grounding}))})),previous.slides.map(s=>({id:s.id,notes:s.notes,text:s.elements.map(e=>({id:e.id,text:e.text,grounding:e.grounding}))})));
 const components=converted.slides.flatMap(s=>s.components||[]);assert.ok(components.length);assert.ok(components.some(c=>c.frame===null));
 const managed=converted.slides.flatMap(s=>s.elements).find(e=>e.text==='Confirm scope');assert.equal(managed.typography.fontSize,21);
 const store=new Store(previous);assert.equal(store.past.length,0);assert.equal(store.revision,0);assert.equal(store.doc.version,2);
 const custom=structuredClone(previous),slide=custom.slides.find(s=>s.components?.length),component=slide.components[0];component.frame={x:80,y:220,w:900,h:330};const title=element(slide,component.title_id);title.y=94;
 const migrated=validateDocument(custom),newComponent=migrated.slides.find(s=>s.id===slide.id).components[0];assert.deepEqual(newComponent.frame,{x:80,y:94,w:900,h:456});assert.equal(validateDocument(migrated).slides.find(s=>s.id===slide.id).components[0].frame.y,94);
 const corrupt=structuredClone(previous);corrupt.slides.find(s=>s.components?.length).components[0].steps[0].title_id='missing';assert.throws(()=>validateDocument(corrupt));assert.throws(()=>validateDocument({...previous,version:3}));
});

test('shared source-footer boundary agrees with generated reference projection at non-default dimensions',()=>{
 const {doc}=deck('comparison',{width:1600,height:1000});const area=layouts.area(doc),ctx={measureText:text=>({width:text.length*8})};
 const projected=composeReferencePresentation(doc,{entries:[{number:1,text:'Reference'}],slides:[{slide_id:doc.slides[0].id,numbers:[1]}]},ctx),footer=projected.slides[0].elements.at(-1);
 assert.ok(footer.y>=area.footer.y);assert.ok(footer.y+footer.h<=doc.height);assert.equal(doc.slides[0].elements.some(e=>e.name==='Sources'),false);
});


test('replacing a document emits load without a commit or undo entry; undo remains an edit restore',()=>{
 const previous=JSON.parse(readFileSync(new URL('./fixtures/presentation-v1.json',import.meta.url))),store=new Store(),events=[];
 store.onChange(kind=>events.push(kind));store.transaction('Existing edit',()=>store.doc.title='Edited');store.undo();events.length=0;
 store.replace(previous);assert.deepEqual(events,['load']);assert.equal(store.doc.version,2);assert.equal(store.past.length,0);assert.equal(store.future.length,0);assert.equal(store.pending,null);
 assert.deepEqual(previous,JSON.parse(readFileSync(new URL('./fixtures/presentation-v1.json',import.meta.url))));
 const baseline=JSON.stringify(store.doc);events.length=0;store.transaction('Authored edit',()=>store.doc.title='A new title');assert.deepEqual(events,['commit']);store.undo();assert.deepEqual(events,['commit','restore']);assert.equal(JSON.stringify(store.doc),baseline);
 events.length=0;const invalid=structuredClone(previous);invalid.version=99;assert.throws(()=>store.replace(invalid));assert.deepEqual(events,[]);assert.equal(JSON.stringify(store.doc),baseline);
});


test('managed glyph ink has measured inset space for every semantic text role',()=>{
 for(const type of Object.keys(specs)){
  const {doc,component,slide}=deck(type),widths=[];
  configureLayoutMeasurement((text,width)=>{widths.push({id:text.id,width});return wrapText({measureText:value=>({width:Array.from(value).length*text.fontSize*.6})},text.text,width).length;});
  layouts.update(doc,component.id,{title:'A recommendation that wraps across several lines '.repeat(5)});
  for(const text of slide.elements.filter(e=>e.type==='text'&&!e.hidden)){
   assert.equal(text.padding,componentTextInset(text));assert.ok(text.padding>0);
   const measured=widths.filter(item=>item.id===text.id).at(-1);assert.ok(measured);assert.equal(measured.width,Math.max(1,text.w-text.padding*2));
   const height=measureComponentText(text,text.w,(element,width)=>wrapText({measureText:value=>({width:Array.from(value).length*element.fontSize*.6})},element.text,width).length,doc.theme);
   // Number boxes share the tallest measured number across the process row.
   assert.ok(text.h+.0001>=height,`${type}/${text.textRole}`);
  }
 }
});


test('tight line height retains the final glyph cell inside the padded text box',()=>{
 const text={text:'A recommendation\nwith a descender',fontSize:38,lineHeight:.8};
 const height=measureComponentText(text,600,()=>2,'studio'),padding=componentTextInset(text);
 assert.equal(height,38*.8+38*1.2+2*padding+4);
 assert.ok(height>=2*padding+38*.8+38*1.2);
});
