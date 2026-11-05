/** Semantic typography and spacing. Values are reference pixels at 1280 × 720. */
export const PRESENTATION_FONTS=Object.freeze(['Arial','Segoe UI','Georgia','Verdana','Trebuchet MS','Times New Roman','Courier New']);
export const STYLE_DEFAULTS=Object.freeze({titleSize:38,componentHeadingSize:24,bodySize:18,labelSize:22,valueSize:56,takeawaySize:32,lineHeight:1.2,marginX:72,marginTop:64,marginBottom:32,panelPadding:20,itemSpacing:24,titleContentSpacing:24});
export const STYLE_FIELDS=Object.freeze(['headingFont','bodyFont',...Object.keys(STYLE_DEFAULTS)].map(key=>Object.freeze({key,label:({headingFont:'Heading font',bodyFont:'Body font',titleSize:'Slide title',componentHeadingSize:'Component heading',bodySize:'Body text',labelSize:'Label',valueSize:'Value',takeawaySize:'Takeaway',lineHeight:'Line height',marginX:'Side margins',marginTop:'Top margin',marginBottom:'Bottom margin',panelPadding:'Panel padding',itemSpacing:'Item spacing',titleContentSpacing:'Title to content'})[key],type:key.endsWith('Font')?'font':'number',group:key.endsWith('Font')||key.endsWith('Size')||key==='lineHeight'?'typography':'spacing',...(key.endsWith('Font')?{}:{min:key.endsWith('Size')?18:key==='lineHeight'?.8:0,max:key.endsWith('Size')?600:key==='lineHeight'?3:1000,step:key==='lineHeight'?.05:1})})));
export const TEXT_ROLES=Object.freeze({title:{size:'titleSize',font:'headingFont',bold:true},componentHeading:{size:'componentHeadingSize',font:'headingFont',bold:true},body:{size:'bodySize',font:'bodyFont',bold:false},label:{size:'labelSize',font:'bodyFont',bold:true},value:{size:'valueSize',font:'headingFont',bold:true},takeaway:{size:'takeawaySize',font:'headingFont',bold:true}});
export const TYPOGRAPHY_FIELDS=Object.freeze(['fontFamily','fontSize','lineHeight','bold','italic','underline','align','valign']);
export function validatePresentationStyle(value,{partial=false}={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Presentation style must be an object.');
 const out={};
 for(const [key,item]of Object.entries(value)){
  const field=STYLE_FIELDS.find(field=>field.key===key);
  if(!field)throw new Error(`Unknown presentation style field: ${key}`);
  if(item===null&&partial){out[key]=null;continue;}
  if(field.type==='font'){if(!PRESENTATION_FONTS.includes(item))throw new Error(`Unsupported presentation font: ${item}`);}
  else if(typeof item!=='number'||!Number.isFinite(item)||item<field.min||item>field.max)throw new Error(`Invalid presentation style ${key}: expected ${field.min}–${field.max}.`);
  out[key]=item;
 }return out;
}
export function validateTypography(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Local typography must be an object.');
 const out={};
 for(const [key,item]of Object.entries(value)){
  if(!TYPOGRAPHY_FIELDS.includes(key))throw new Error(`Unknown local typography field: ${key}`);
  if(key==='fontFamily'&&(typeof item!=='string'||!item.length||item.length>100||!/^[a-zA-Z0-9 ,\-]+$/.test(item))||key==='fontSize'&&(!Number.isFinite(item)||item<18||item>600)||key==='lineHeight'&&(!Number.isFinite(item)||item<.8||item>3)||['bold','italic','underline'].includes(key)&&typeof item!=='boolean'||key==='align'&&!['left','center','right'].includes(item)||key==='valign'&&!['top','middle','bottom'].includes(item))throw new Error(`Invalid local typography ${key}.`);
  out[key]=item;
 }return out;
}
export function resolveStyle(document,themes){const theme=themes[document.theme]||themes.studio;return {headingFont:theme.headingFont,bodyFont:theme.bodyFont,...STYLE_DEFAULTS,...validatePresentationStyle(document.style||{})};}
export function resolveTypography(element,style){
 const role=TEXT_ROLES[element.textRole];if(!role)return {};
 return {fontFamily:style[role.font],fontSize:style[role.size],lineHeight:style.lineHeight,bold:role.bold,italic:false,underline:false,align:'left',valign:'top',...validateTypography(element.typography||{})};
}
/** Capture explicit edits before reflow. Content edits never replace local typography. */
export function captureTypography(element,props){
 if(!element.textRole)return;
 if(Object.hasOwn(props,'fontRole'))throw new Error('Managed typography uses semantic roles. Use fontFamily or reset to presentation style.');
 const patch=Object.fromEntries(TYPOGRAPHY_FIELDS.filter(key=>Object.hasOwn(props,key)).map(key=>[key,props[key]]));
 if(Object.keys(patch).length)element.typography={...(element.typography||{}),...validateTypography(patch)};
}
