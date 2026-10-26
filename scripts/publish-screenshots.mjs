// Assemble documentation from actual QA screenshots (no simulated or retouched game imagery).
import { resolve } from 'node:path';
import { mkdir, access } from 'node:fs/promises';
const before=process.argv[2] || 'work/before', after=process.argv[3] || 'work/after';
const fontCache=resolve('work/font-cache');await mkdir(fontCache,{recursive:true});process.env.XDG_CACHE_HOME=fontCache;
const {default:sharp}=await import('sharp');
await mkdir('docs/screenshots',{recursive:true});
const images=[[`${after}/14-end.png`,'match-end.jpg'],['work/overhaul/menu-high.png','night-menu.jpg'],['work/overhaul/aim-high.png','night-match.jpg'],['work/overhaul/setup-high.png','kit-select.jpg'],['work/overhaul/replay-low.png','night-replay.jpg'],['work/after-responsive-final/390x844-hud.png','phone.jpg'],['work/board-close.png','ribbon-detail.jpg'],['work/arena-final/stadium-overview.png','stadium-overview.jpg']];
for(const [source,name]of images){await access(source);await sharp(source).jpeg({quality:88,mozjpeg:true}).toFile(`docs/screenshots/${name}`);}
const W=640,H=360,head=48,gap=10,items=[];
const title=Buffer.from(`<svg width="${W*2+gap}" height="${head}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0a1526"/><g fill="#d4e3ef" font-family="sans-serif" font-weight="700" font-size="16"><text x="16" y="30">BEFORE / Supplied source</text><text x="${W+gap+16}" y="30" fill="#ffcb81">AFTER / Meridian Arena</text></g></svg>`);
items.push({input:title,left:0,top:0});
const freshAfter=process.argv[3]?{}:{'01-menu':'work/overhaul/menu-low.png','04-aim':'work/arena-final/aim-final.png','08-goal':'work/overhaul/net-impact.png'};
for(const [row,name]of ['01-menu','04-aim','08-goal'].entries())for(const [col,dir]of [before,after].entries())items.push({input:await sharp(col===1?(freshAfter[name] || `${dir}/${name}.png`):`${dir}/${name}.png`).resize(W,H).png().toBuffer(),left:col*(W+gap),top:head+row*(H+gap)});
await sharp({create:{width:W*2+gap,height:head+H*3+gap*2,channels:3,background:'#050b17'}}).composite(items).jpeg({quality:88,mozjpeg:true}).toFile('docs/visual-overhaul.jpg');
console.log('Published genuine QA captures to docs/screenshots and docs/visual-overhaul.jpg');
