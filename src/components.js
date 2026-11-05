/** Shared measured components. These return placement data, never duplicated content. */
export function measureComponentText(element,width,measureText,theme){
 if(!element.text?.trim())return 0;
 const lines=measureText(element,Math.max(1,width),theme);
 if(!Number.isInteger(lines)||lines<1)throw new Error('Layout text measurement is unavailable.');
 return lines*element.fontSize*element.lineHeight+4;
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
