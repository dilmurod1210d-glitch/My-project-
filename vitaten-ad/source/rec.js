const {chromium}=require('playwright');
(async()=>{const dir=process.argv[2];const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
await p.goto('file://'+dir+'/ad.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
const D=await p.evaluate(()=>DURATION);const fps=30;
for(let i=0;i<D*fps;i++){await p.evaluate(t=>render(t),i/fps);await p.screenshot({path:`${dir}/frames/f${String(i).padStart(4,'0')}.jpg`,type:'jpeg',quality:92});}
await b.close();})();
