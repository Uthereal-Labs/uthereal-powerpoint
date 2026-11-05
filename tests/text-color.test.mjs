import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Store,makeDocument,makeElement,setTextColor,textColorRuns,validateDocument,layouts,configureLayoutMeasurement,setPresentationStyle,copySlide} from '../src/core.js';
import {drawText2D,wrapTextLines} from '../src/renderer.js';
import {exportPPTX,unzipSafe} from '../src/pptx.js';

test('selected-word colors survive native reopen and undo/redo without changing plain text',()=>{
  const store=new Store(),element=makeElement('text',{text:'Treat responsibility as an operating discipline'});
  store.add(element);store.transaction('Color selected text',()=>setTextColor(element,'#DC2626',6,20));
  assert.equal(element.text,'Treat responsibility as an operating discipline');
  assert.deepEqual(textColorRuns(element),[{text:'Treat ',fill:'@ink'},{text:'responsibility',fill:'#DC2626'},{text:' as an operating discipline',fill:'@ink'}]);
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(store.doc))),store.doc);
  store.undo();assert.equal(store.selected[0].textColors,undefined);
  store.redo();assert.deepEqual(store.selected[0].textColors,[{start:6,end:20,fill:'#DC2626'}]);
});

test('overlapping colors split ranges, and typing shifts or inherits the surviving colors',()=>{
  const store=new Store(),element=makeElement('text',{text:'one two three'});store.add(element);
  setTextColor(element,'#DC2626',4,13);setTextColor(element,'#2563EB',8,13);
  store.setElementContent(element,{text:'one bright two three'});
  assert.deepEqual(textColorRuns(element),[{text:'one ',fill:'@ink'},{text:'bright two ',fill:'#DC2626'},{text:'three',fill:'#2563EB'}]);
  store.setElementContent(element,{text:'one three'});
  assert.deepEqual(textColorRuns(element),[{text:'one ',fill:'@ink'},{text:'three',fill:'#2563EB'}]);
  setTextColor(element,'#000000');assert.equal(element.textColors,undefined);assert.equal(element.fill,'#000000');
});

test('exact editing bounds preserve the identity of colored repeated words',()=>{
  const store=new Store(),element=makeElement('text',{text:'hello hello'});store.add(element);setTextColor(element,'#DC2626',6,11);
  store.setElementContent(element,{text:'hello'},store.doc,{start:0,end:6});
  assert.deepEqual(textColorRuns(element),[{text:'hello',fill:'#DC2626'}]);
  store.setElementContent(element,{text:'hello hello'},store.doc,{start:0,end:0});
  assert.equal(element.textColors.at(-1).end,11);
});

test('malformed, overlapping or out-of-bounds persisted color ranges are rejected',()=>{
  const doc=makeDocument(),element=makeElement('text',{text:'Short text'});doc.slides[0].elements=[element];
  for(const spans of [[{start:-1,end:2,fill:'#000000'}],[{start:0,end:99,fill:'#000000'}],[{start:0,end:5,fill:'red'}],[{start:0,end:5,fill:'#000000'},{start:4,end:6,fill:'#FFFFFF'}]]){
    element.textColors=spans;assert.throws(()=>validateDocument(doc),/text color span/);
  }
});

test('selecting all managed text colors its range without replacing the layout-owned base color',()=>{
  configureLayoutMeasurement(()=>1);
  const doc=makeDocument(),component=layouts.create(doc,doc.slides[0].id,{type:'process',title:'Plan',steps:[{title:'Discover'},{title:'Build'}]});
  const store=new Store(doc),element=store.slide.elements.find(item=>item.id===component.steps[0].title_id),base=element.fill;
  store.transaction('Color selected text',()=>setTextColor(element,'#2563EB',0,element.text.length));
  assert.equal(element.fill,base);
  assert.deepEqual(textColorRuns(element),[{text:'Discover',fill:'#2563EB'}]);
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(store.doc))),store.doc);
});

test('wrapped canvas text uses the same color ranges and positions as its source',()=>{
  const painted=[],ctx={measureText:text=>({width:text.length*10}),fillText(text,x,y){painted.push({text,x,y,fill:this.fillStyle});},fillRect(){},save(){},restore(){},beginPath(){},rect(){},clip(){}};
  const element=makeElement('text',{text:'one two\r\n😀three',fill:'#000000',w:78,h:200,fontSize:20,padding:4});
  setTextColor(element,'#DC2626',4,7);setTextColor(element,'#2563EB',9,11);
  const lines=wrapTextLines(ctx,element.text,70);
  for(const line of lines)assert.equal(element.text.slice(line.start,line.start+line.text.length),line.text);
  drawText2D(ctx,element,'studio');
  assert.ok(painted.some(run=>run.text.includes('two')&&run.fill==='#DC2626'));
  assert.ok(painted.some(run=>run.text.includes('😀')&&run.fill==='#2563EB'));
  assert.ok(painted.every(run=>run.x>=4));
  assert.ok(painted.every(run=>lines.some(line=>line.text===run.text)),'color changes repaint the complete shaped line rather than separately shaping substrings');
  painted.length=0;drawText2D(ctx,{...element,h:24},'studio',48);
  assert.ok(painted.some(run=>run.text.includes('😀')&&run.fill==='#2563EB'),'scrolled editing must paint colored lines beyond the original viewport');
  painted.length=0;drawText2D(ctx,{...element,text:'Invisible',textColors:[{start:0,end:9,fill:'none'}]},'studio');assert.equal(painted.length,0,'none is an invisible text color in canvas as well as SVG and PPTX');
});

test('editable PowerPoint export preserves differently colored words across paragraphs',async()=>{
  const doc=makeDocument(),element=makeElement('text',{text:'Plain red\nBlue plain',fill:'#000000'});doc.slides[0].elements=[element];
  setTextColor(element,'#DC2626',6,9);setTextColor(element,'#2563EB',10,14);
  const files=await unzipSafe(await (await exportPPTX(doc)).arrayBuffer());
  const xml=new TextDecoder().decode(files.get('ppt/slides/slide1.xml'));
  const runs=[...xml.matchAll(/<a:r>([\s\S]*?)<\/a:r>/g)].map(match=>match[1]);
  assert.ok(runs.some(run=>run.includes('val="DC2626"')&&run.includes('>red</a:t>')));
  assert.ok(runs.some(run=>run.includes('val="2563EB"')&&run.includes('>Blue</a:t>')));
  assert.ok(runs.some(run=>run.includes('val="000000"')&&run.includes('>Plain </a:t>')));
});


test('whole-box colors use managed local typography across reflow, themes, reopen, detach and undo',async()=>{
  configureLayoutMeasurement(()=>1);
  for(const input of [
    {type:'process',steps:[{title:'Discover'},{title:'Build'}]},
    {type:'comparison',items:[{title:'Build'},{title:'Buy'}]},
    {type:'key_figures',figures:[{value:'42',label:'Results'}]},
    {type:'takeaway_evidence',takeaway:'Main message',points:[{text:'Evidence'}]}
  ]){
    const doc=makeDocument(),component=layouts.create(doc,doc.slides[0].id,input),store=new Store(doc);
    const element=store.slide.elements.find(item=>item.textRole&&item.text.length),originalFill=element.fill;
    element.grounding=[{id:'source',anchor:{scope:'object'},claim_ids:['claim'],relation:'supports',origin:{kind:'saved',revision_id:'revision',association_id:'association'}}];
    store.colorText([element.id],'#2563EB',{start:0,end:1});
    const before=store.past.length;store.colorText([element.id],'#DC2626');
    assert.equal(store.past.length,before+1);assert.equal(element.fill,'#DC2626');assert.equal(element.typography.fill,'#DC2626');assert.equal(element.textColors,undefined);
    assert.equal(element.grounding[0].id,'source');
    setPresentationStyle(doc,{bodySize:24});doc.theme='slate';layouts.normalize(doc);
    assert.equal(element.fill,'#DC2626');
    store.replace(validateDocument(JSON.parse(JSON.stringify(doc))));
    let reopened=store.slide.elements.find(item=>item.id===element.id);assert.equal(reopened.fill,'#DC2626');assert.equal(reopened.typography.fill,'#DC2626');
    store.select([reopened.id]);store.resetSelectedTypography();assert.equal(reopened.fill,originalFill);assert.equal(reopened.typography,undefined);assert.equal(reopened.textColors,undefined);
    store.undo();reopened=store.slide.elements.find(item=>item.id===element.id);assert.equal(reopened.typography.fill,'#DC2626');
    store.colorText([reopened.id],'#2563EB',{start:0,end:1});
    const copied=copySlide(store.slide);assert.deepEqual(copied.elements.find(item=>item.text===reopened.text&&item.textRole===reopened.textRole).textColors,reopened.textColors);
    const files=await unzipSafe(await (await exportPPTX(store.doc)).arrayBuffer());
    assert.match(new TextDecoder().decode(files.get('ppt/slides/slide1.xml')),/val="2563EB"/);
    layouts.detach(store.doc,component.id);assert.equal(reopened.fill,'#DC2626');assert.equal(reopened.typography,undefined);assert.ok(reopened.textColors);
  }
});

test('empty managed text can receive a whole-box color and reset both local and inline colors',()=>{
  configureLayoutMeasurement(()=>1);
  const doc=makeDocument(),component=layouts.create(doc,doc.slides[0].id,{type:'process',steps:[{title:'One'},{title:'Two'}]}),store=new Store(doc);
  const element=store.slide.elements.find(item=>item.id===component.steps[0].body_id);
  assert.equal(element.text,'');store.colorText([element.id],'#DC2626');assert.equal(element.typography.fill,'#DC2626');
  store.setElementContent(element,{text:'Now visible'});assert.equal(element.fill,'#DC2626');
  store.colorText([element.id],'#2563EB',{start:0,end:3});store.select([element.id]);store.resetSelectedTypography();
  assert.equal(element.fill,'@ink');assert.equal(element.textColors,undefined);assert.equal(element.typography,undefined);
  const before=JSON.stringify(store.doc);
  assert.throws(()=>store.colorText([element.id],'#000000',{}),/range/);
  assert.throws(()=>store.colorText([element.id],'#000000',{start:0,end:99}),/range/);
  assert.throws(()=>store.setElementContent(element,{textColors:[{start:0,end:99,fill:'#000000'}]}),/span/);
  assert.throws(()=>store.setElementContent(element,{fill:'red'}),/color/);
  assert.equal(JSON.stringify(store.doc),before);
});


test('opening a format-one presentation migrates colored ranges without editing, content or identity loss',()=>{
  configureLayoutMeasurement(()=>1);
  const old=JSON.parse(readFileSync(new URL('./fixtures/presentation-v1.json',import.meta.url),'utf8'));
  const original=old.slides[0].elements.find(item=>item.type==='text'&&item.text.length>2);
  original.textColors=[{start:0,end:2,fill:'#2563EB'}];
  const before=JSON.stringify(old),store=new Store(old),converted=store.slide.elements.find(item=>item.id===original.id);
  assert.equal(store.doc.version,2);assert.equal(converted.text,original.text);assert.deepEqual(converted.textColors,original.textColors);
  assert.deepEqual(converted.grounding,original.grounding);assert.equal(store.past.length,0);assert.equal(store.revision,0);
  assert.equal(JSON.stringify(old),before);assert.deepEqual(validateDocument(store.doc),store.doc);
});

// Selecting the current layout color is still an explicit author choice.
test('inline overrides survive a layout default color change',()=>{
  configureLayoutMeasurement(()=>1);
  const doc=makeDocument(),component=layouts.create(doc,doc.slides[0].id,{type:'process',steps:[{title:'Discover'},{title:'Build'}]});
  const store=new Store(doc),id=component.steps[0].title_id,element=store.slide.elements.find(item=>item.id===id),fill=element.fill;
  store.colorText([id],fill,{start:0,end:element.text.length});
  store.transaction('Emphasize step',()=>layouts.update(store.doc,component.id,{emphasis_step_id:component.steps[0].id}));
  assert.notEqual(element.fill,fill);
  assert.deepEqual(textColorRuns(element),[{text:'Discover',fill}]);
});
