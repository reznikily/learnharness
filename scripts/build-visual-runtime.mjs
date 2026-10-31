import {build} from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import fs from 'node:fs';
const bundle=await build({entryPoints:['components/visual-runtime/entry.tsx'],bundle:true,write:false,minify:true,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},tsconfig:'tsconfig.json'});
const css=await postcss([tailwind()]).process(fs.readFileSync('app/globals.css','utf8'),{from:'app/globals.css'});
// Font data is local and embedded so sandbox/headless/downloads share the same document.
let style=css.css+'\n'+fs.readFileSync('node_modules/katex/dist/katex.min.css','utf8');
style=style.replace(/url\(["']?([^)'"\s]+)["']?\)/g,(whole,url)=>{const file=url.startsWith('/fonts/')?'public'+url:url.startsWith('fonts/')?'node_modules/katex/dist/'+url:null;if(!file||!fs.existsSync(file))return whole;return `url(data:font/${file.split(".").pop()};base64,${fs.readFileSync(file).toString('base64')})`;});
style+='\nhtml,body{margin:0;padding:0;background:transparent!important;min-height:0}body{color:var(--foreground)}#root{width:100%;overflow-wrap:anywhere}svg text{fill:currentColor;stroke:none}';
fs.mkdirSync('src/generated',{recursive:true});fs.writeFileSync('src/generated/visual-runtime.json',JSON.stringify({script:bundle.outputFiles[0].text,css:style}));
