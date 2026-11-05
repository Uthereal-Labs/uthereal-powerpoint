import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,makeDocument,makeElement,setTextColor,textColorRuns,validateDocument,layouts,configureLayoutMeasurement} from '../src/core.js';
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
  const painted=[],ctx={measureText:text=>({width:text.length*10}),fillText(text,x,y){painted.push({text,x,y,fill:this.fillStyle});},fillRect(){}};
  const element=makeElement('text',{text:'one two\r\n😀three',fill:'#000000',w:78,h:200,fontSize:20,padding:4});
  setTextColor(element,'#DC2626',4,7);setTextColor(element,'#2563EB',9,11);
  const lines=wrapTextLines(ctx,element.text,70);
  for(const line of lines)assert.equal(element.text.slice(line.start,line.start+line.text.length),line.text);
  drawText2D(ctx,element,'studio');
  assert.ok(painted.some(run=>run.text==='two'&&run.fill==='#DC2626'));
  assert.ok(painted.some(run=>run.text==='😀'&&run.fill==='#2563EB'));
  assert.ok(painted.every(run=>run.x>=4));
  painted.length=0;drawText2D(ctx,{...element,h:24},'studio',48);
  assert.ok(painted.some(run=>run.text==='😀'&&run.fill==='#2563EB'),'scrolled editing must paint colored lines beyond the original viewport');
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
