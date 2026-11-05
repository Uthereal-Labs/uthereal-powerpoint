import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDocument,makeElement,validateDocument} from '../src/core.js';
import {expandElement,tableGeometry} from '../src/renderer.js';
import {exportPPTX,unzipSafe} from '../src/pptx.js';

test('resolved table geometry matches rendered cells and retains their row and column identity',()=>{
  const table=makeElement('table',{x:72,y:178,w:1136,h:375,cells:[['Heading','Value'],['Label','12']],columnWidths:[3,1],columnAlign:['left','right']});
  const geometry=tableGeometry(table),leaves=expandElement(table);
  assert.deepEqual(geometry,{rowCount:2,columnCount:2,columnWidths:[852,284],columnOffsets:[0,852],rowHeight:187.5,paddingX:14,paddingY:8});
  for(const leaf of leaves.filter(element=>element.type==='text')){
    const {tableId,row,column}=leaf.tableCell;
    assert.equal(tableId,table.id);
    assert.equal(leaf.x,table.x+geometry.columnOffsets[column]+geometry.paddingX);
    assert.equal(leaf.y,table.y+row*geometry.rowHeight+geometry.paddingY);
    assert.equal(leaf.w,geometry.columnWidths[column]-2*geometry.paddingX);
    assert.equal(leaf.h,geometry.rowHeight-2*geometry.paddingY);
  }
  assert.equal(leaves[3].align,'right');
});

test('recorded Numina cell geometry gains the requested width after real native validation and reopen',()=>{
  // Only the failing cell and table metrics are recorded; the other cells are synthetic.
  const cells=Array.from({length:8},(_,row)=>[row===7?'KdV controllability (Medium-Hard)':`Row ${row}`,'1','2','3']);
  const deck=makeDocument(),table=makeElement('table',{x:72,y:178,w:1136,h:375,fontSize:18,cells});
  deck.slides[0].elements=[table];
  const before=expandElement(table).find(element=>element.tableCell?.row===7&&element.tableCell.column===0);
  assert.deepEqual([before.x,before.y,before.w,before.h,before.fontSize],[86,514.125,256,30.875,18]);
  for(const columnWidths of [[5,2,2.5,2.5],[6,1.8,2.6,2.6],[8,1,1.8,1.8]]){
    table.columnWidths=columnWidths;
    const reopened=validateDocument(JSON.parse(JSON.stringify(deck))).slides[0].elements[0];
    const cell=expandElement(reopened).find(element=>element.tableCell?.row===7&&element.tableCell.column===0);
    assert.deepEqual(reopened.columnWidths,columnWidths);
    assert.deepEqual(reopened.cells,cells);
    assert.equal(cell.text,before.text);
    assert.ok(cell.w>before.w);
    assert.equal(cell.h,before.h);
  }
});

test('weighted cell geometry and authored table text agree with editable PowerPoint export',async()=>{
  const deck=makeDocument(),table=makeElement('table',{x:72,y:178,w:1136,h:375,fontSize:18,cells:[['Problem','Result'],['KdV controllability (Medium-Hard)','17']],columnWidths:[3,1],highlightRows:[1],banded:false});
  deck.slides[0].elements=[table];
  const reopened=validateDocument(JSON.parse(JSON.stringify(deck)));
  const leaves=expandElement(reopened.slides[0].elements[0]);
  const files=await unzipSafe(await (await exportPPTX(reopened)).arrayBuffer());
  const slide=new TextDecoder().decode(files.get('ppt/slides/slide1.xml'));
  const exportedShapes=[...slide.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)].map(match=>match[1]);
  assert.equal(exportedShapes.length,leaves.length);
  for(const [index,leaf] of leaves.entries()){
    const xml=exportedShapes[index];
    assert.ok(xml.includes(`<a:off x="${Math.round(leaf.x*9525)}" y="${Math.round(leaf.y*9525)}"/>`));
    assert.ok(xml.includes(`<a:ext cx="${Math.round(leaf.w*9525)}" cy="${Math.round(leaf.h*9525)}"/>`));
    if(leaf.type==='text')assert.ok(xml.includes(leaf.text));
  }
});

test('formatter pixel widths above 1000 retain their proportions through native validation',()=>{
  for(const columnWidths of [[2000,500],[Number.MAX_VALUE,Number.MAX_VALUE/4]]){
    const deck=makeDocument();
    deck.width=3000;
    deck.slides[0].elements=[makeElement('table',{x:72,y:178,w:2500,h:100,cells:[['Wide label','Value']],columnWidths})];
    const table=validateDocument(deck).slides[0].elements[0];
    assert.deepEqual(table.columnWidths,[1000,250]);
    assert.deepEqual(tableGeometry(table).columnWidths,[2000,500]);
    assert.deepEqual(expandElement(table).filter(element=>element.type==='text').map(element=>element.w),[1972,472]);
    assert.deepEqual(validateDocument(JSON.parse(JSON.stringify({...deck,slides:[{...deck.slides[0],elements:[table]}]}))).slides[0].elements[0],table);
  }
});

test('native chart labels retain the readable floor without a hosting build patch',()=>{
  const chart=makeElement('chart',{chartType:'bar',w:520,h:300,labels:['North','West'],values:[4,7]});
  const labels=expandElement(chart).filter(element=>element.type==='text');
  assert.ok(labels.length);
  assert.ok(labels.every(element=>element.fontSize>=18));
  assert.ok(labels.every(element=>element.x>=chart.x&&element.x+element.w<=chart.x+chart.w));
});
