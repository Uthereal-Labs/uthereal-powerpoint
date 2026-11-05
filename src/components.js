/** Shared measured components. These return placement data, never duplicated content. */
// Advance widths omit glyph overhang (for example Georgia bold “A”). Reserve ink
// room inside each native text box, shared by measurement, renderer and export.
export const componentTextInset=element=>Math.max(2,Math.ceil(element.fontSize*.15));
export function measureComponentText(element,width,measureText,theme){
 if(!element.text?.trim())return 0;
 const inset=componentTextInset(element),lines=measureText(element,Math.max(1,width-2*inset),theme);
 if(!Number.isInteger(lines)||lines<1)throw new Error('Layout text measurement is unavailable.');
 // Tight authored line spacing may overlap lines, but the last line still needs
 // a complete glyph cell rather than being clipped to the line advance.
 const lineAdvance=element.fontSize*element.lineHeight,inkHeight=Math.max(lineAdvance,element.fontSize*1.2);
 return (lines-1)*lineAdvance+inkHeight+2*inset+4;
}
export function measurePanel(ids,elements,width,{padding,spacing,leading=0},measure){
 const inner=Math.max(1,width-padding*2),heights=ids.map(id=>measure(elements.get(id),inner)),visible=heights.filter(Boolean).length;
 return {inner,heights,height:padding*2+leading+heights.reduce((sum,h)=>sum+h,0)+Math.max(0,visible-1)*spacing};
}
export function placePanelText(ids,metrics,x,y,padding,spacing,place,extra={}){
 let top=y+padding;
 ids.forEach((id,index)=>{const height=metrics.heights[index];place(id,{x:x+padding,y:top,w:metrics.inner,h:Math.max(1,height),hidden:!height,...extra});if(height)top+=height+spacing;});
}
export function measureEvidencePoint(element,width,{indent,spacing},measure){return {height:measure(element,Math.max(1,width-indent)),indent,spacing};}
