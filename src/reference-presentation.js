import {makeElement, elementBounds, rectIntersects} from './core.js';
import {wrapText, fontCSS} from './renderer.js';

// This is a display/export projection. It must never be assigned to Store.doc.
export function composeReferencePresentation(doc, presentation, ctx) {
  if(presentation===null)return doc;
  if(!presentation||!Array.isArray(presentation.entries)||!Array.isArray(presentation.slides))
    throw new Error('Invalid reference presentation');
  const entries=new Map();
  for(const entry of presentation.entries){
    if(!Number.isInteger(entry.number)||entry.number<1||typeof entry.text!=='string'||!entry.text.trim()||entries.has(entry.number))
      throw new Error('Invalid reference entry');
    entries.set(entry.number,entry.text.trim());
  }
  const slideNumbers=new Map();
  for(const item of presentation.slides){
    if(typeof item.slide_id!=='string'||!doc.slides.some(slide=>slide.id===item.slide_id)||!Array.isArray(item.numbers)||slideNumbers.has(item.slide_id)||
      item.numbers.some(number=>!entries.has(number)))throw new Error('Invalid reference slide mapping');
    slideNumbers.set(item.slide_id,[...new Set(item.numbers)]);
  }
  const sx=doc.width/1280,sy=doc.height/720,band=48*sy,margin=48*sx,footerFont=16*sy;
  const slides=doc.slides.map(slide=>{
    const numbers=slideNumbers.get(slide.id)||[];
    if(!numbers.length)return slide;
    const zone={x:0,y:doc.height-band,w:doc.width,h:band};
    if(slide.elements.some(element=>!element.hidden&&rectIntersects(elementBounds(element),zone)))
      throw new Error(`Slide "${slide.name}" has content in the bottom 48 px reserved for Sources. Move it up before adding references.`);
    const footer=`Sources: ${numbers.map(number=>`[${number}]`).join(', ')}`;
    ctx.font=`${footerFont}px Arial`;
    if(ctx.measureText(footer).width>doc.width-2*margin)
      throw new Error(`Sources footer does not fit on slide "${slide.name}". Reduce the number of sources on this slide.`);
    const element=makeElement('text',{id:`virtual_source_footer_${slide.id}`,name:'Sources',text:footer,
      x:margin,y:doc.height-band+9*sy,w:doc.width-2*margin,h:band-12*sy,fontSize:footerFont,
      fill:'@muted',padding:0,locked:true});
    return {...slide,elements:[...slide.elements,element]};
  });
  if(!entries.size)return {...doc,slides};
  const headingSize=38*sy,bodySize=21*sy,lineHeight=1.3,top=72*sy,bottom=doc.height-60*sy;
  let current=null,cursor=top,pageIndex=0;
  const newPage=()=>{
    pageIndex++; current={id:`virtual_reference_slide_${pageIndex}`,name:pageIndex===1?'References':`References ${pageIndex}`,
      bg:'@bg',notes:'',transition:'none',duration:.45,elements:[]}; slides.push(current);
    current.elements.push(makeElement('text',{id:`virtual_reference_heading_${pageIndex}`,name:'References heading',
      x:margin,y:top,w:doc.width-2*margin,h:headingSize*1.3,text:pageIndex===1?'References':'References (continued)',
      fontSize:headingSize,bold:true,padding:0,locked:true,fill:'@ink'}));
    cursor=top+headingSize*1.8;
  };
  newPage();
  for(const [number,text] of entries){
    const reference=`[${number}] ${text}`,width=doc.width-2*margin;
    ctx.font=fontCSS({fontSize:bodySize,fontFamily:'Arial'});
    const lines=wrapText(ctx,reference,width);
    for(let offset=0;offset<lines.length;){
      const available=Math.floor((bottom-cursor)/(bodySize*lineHeight));
      if(available<1){newPage();continue;}
      const segment=lines.slice(offset,offset+available),height=segment.length*bodySize*lineHeight;
      current.elements.push(makeElement('text',{id:`virtual_reference_${number}_${offset}`,name:`Reference ${number}`,
        x:margin,y:cursor,w:width,h:height,text:segment.join('\n'),fontSize:bodySize,lineHeight,
        fill:'@ink',padding:0,locked:true}));
      cursor+=height;offset+=segment.length;
    }
    cursor+=12*sy;
  }
  return {...doc,slides};
}
