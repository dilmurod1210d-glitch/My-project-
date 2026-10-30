const {chromium}=require('playwright');
(async()=>{const dir=process.argv[2];const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
await p.goto('file://'+dir+'/ad169.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
const D=await p.evaluate(()=>DURATION);const fps=30;
for(let i=0;i<D*fps;i++){await p.evaluate(t=>render(t),i/fps);await p.screenshot({path:`${dir}/frames169/f${String(i).padStart(4,'0')}.jpg`,type:'jpeg',quality:92});}
await b.close();})();
