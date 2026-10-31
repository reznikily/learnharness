/** Reuse the app's loaded font faces inside an opaque-origin frame. */
let cached: Promise<string> | undefined;
export function visualFonts(): Promise<string> {
 return cached ??= (async()=>{
  const faces:string[]=[];
  for(const sheet of Array.from(document.styleSheets)){
   let rules:CSSRuleList;try{rules=sheet.cssRules;}catch{continue;}
   for(const rule of Array.from(rules))if(rule instanceof CSSFontFaceRule){
    let css=rule.cssText;
    for(const match of css.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)){
     const url=new URL(match[1]!,sheet.href ?? location.href);if(url.origin!==location.origin)continue;
     const response=await fetch(url);if(!response.ok)continue;
     const blob=await response.blob();const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});
     css=css.replace(match[0],`url("${data}")`);
    }
    faces.push(css);
   }
  }
  return faces.join('\n');
 })().catch(()=>{cached=undefined;return '';});
}
