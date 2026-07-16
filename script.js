const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.querySelector('#score'), targetElement = document.querySelector('#target');
const pointsElement = document.querySelector('#points'), accuracyElement = document.querySelector('#accuracy'), lostElement = document.querySelector('#lost');
const progressFill = document.querySelector('#progress-fill'), milestoneEl = document.querySelector('#milestone'), winScreen = document.querySelector('#win-screen');
const levelName = document.querySelector('#level-name'), levelKicker = document.querySelector('#level-kicker'), soundBtn = document.querySelector('#sound-btn');
const branding = new Image(); branding.src = 'input_file_0.png';

// Each course ends with a ramp that begins outside the protected pour zone and feeds into the can.
const levels = {
  easy: [
    {name:'First Drop',target:80,source:{x:115,y:92},can:{x:330,y:355,w:140,h:165},obstacles:[{x1:95,y1:150,x2:398,y2:346}]},
    {name:'Long Way Home',target:95,source:{x:105,y:90},can:{x:555,y:355,w:140,h:165},obstacles:[{x1:95,y1:145,x2:365,y2:280},{x1:362,y1:280,x2:625,y2:346}]},
    {name:'Back Across',target:105,source:{x:695,y:90},can:{x:110,y:355,w:140,h:165},obstacles:[{x1:705,y1:145,x2:460,y2:275},{x1:458,y1:275,x2:180,y2:346}]},
    {name:'Soft Landing',target:110,source:{x:110,y:90},can:{x:330,y:355,w:140,h:165},obstacles:[{x1:90,y1:150,x2:252,y2:250},{x1:250,y1:250,x2:398,y2:346}]}
  ],
  medium: [
    {name:'Two Turns',target:120,source:{x:100,y:90},can:{x:555,y:355,w:140,h:165},obstacles:[{x1:90,y1:145,x2:280,y2:245},{x1:278,y1:245,x2:450,y2:205},{x1:448,y1:205,x2:625,y2:346}]},
    {name:'Cross Current',target:130,source:{x:700,y:90},can:{x:110,y:355,w:140,h:165},obstacles:[{x1:710,y1:145,x2:535,y2:240},{x1:533,y1:240,x2:375,y2:205},{x1:373,y1:205,x2:180,y2:346}]},
    {name:'River Run',target:140,source:{x:100,y:90},can:{x:330,y:355,w:140,h:165},obstacles:[{x1:90,y1:145,x2:220,y2:225},{x1:218,y1:225,x2:252,y2:195},{x1:250,y1:195,x2:398,y2:346}]},
    {name:'Return Route',target:145,source:{x:700,y:90},can:{x:330,y:355,w:140,h:165},obstacles:[{x1:710,y1:145,x2:620,y2:230},{x1:618,y1:230,x2:552,y2:195},{x1:550,y1:195,x2:398,y2:346}]}
  ],
  hard: [
    {name:'Narrow Way',target:150,source:{x:100,y:90},can:{x:555,y:355,w:140,h:165},obstacles:[{x1:90,y1:145,x2:235,y2:235},{x1:233,y1:235,x2:360,y2:180},{x1:358,y1:180,x2:477,y2:245},{x1:475,y1:245,x2:625,y2:346}]},
    {name:'Four Corners',target:160,source:{x:700,y:90},can:{x:110,y:355,w:140,h:165},obstacles:[{x1:710,y1:145,x2:590,y2:225},{x1:588,y1:225,x2:475,y2:175},{x1:473,y1:175,x2:332,y2:250},{x1:330,y1:250,x2:180,y2:346}]},
    {name:'Winding Water',target:170,source:{x:100,y:90},can:{x:330,y:355,w:140,h:165},obstacles:[{x1:90,y1:145,x2:185,y2:215},{x1:183,y1:215,x2:245,y2:170},{x1:243,y1:170,x2:252,y2:230},{x1:250,y1:230,x2:398,y2:346}]},
    {name:'Final Flow',target:180,source:{x:700,y:90},can:{x:330,y:355,w:140,h:165},obstacles:[{x1:710,y1:145,x2:610,y2:215},{x1:608,y1:215,x2:570,y2:165},{x1:568,y1:165,x2:552,y2:225},{x1:550,y1:225,x2:398,y2:346}]}
  ]
};
let difficulty='easy', levelIndex=0, level=levels.easy[0], particles=[], confetti=[];
let collected=0, lost=0, milestones=[false,false,false], isPouring=false, pointerX=0, pointerY=0, gameWon=false, soundOn=true, audioCtx;

function randomLevel() {
  const fromLeft = Math.random() > .5, source={x:fromLeft?100:700,y:92}, can={x:fromLeft?560:100,y:355,w:140,h:165};
  const sign=fromLeft?1:-1, start=source.x, end=can.x+can.w/2;
  const p1={x:start+sign*(130+Math.random()*35),y:200+Math.random()*35}, p2={x:start+sign*(260+Math.random()*45),y:260+Math.random()*45}, p3={x:fromLeft?can.x-85:can.x+can.w+85,y:330+Math.random()*35};
  return {name:'Generated Course',target:135,source,can,obstacles:[{x1:start,y1:155,x2:p1.x,y2:p1.y},{x1:p1.x,y1:p1.y,x2:p2.x,y2:p2.y},{x1:p2.x,y1:p2.y,x2:p3.x,y2:p3.y},{x1:p3.x,y1:p3.y,x2:end,y2:340}]};
}
function tone(freq,duration=.08,type='sine',volume=.04) { if(!soundOn)return; audioCtx ||= new (window.AudioContext||window.webkitAudioContext)(); const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type=type;o.frequency.setValueAtTime(freq,audioCtx.currentTime);g.gain.setValueAtTime(volume,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration); }
function splash(){tone(310+Math.random()*90,.055,'sine',.018)} function celebrate(){[440,554,659].forEach((n,i)=>setTimeout(()=>tone(n,.17,'triangle',.065),i*110))}
function pointToSegment(p,s){const dx=s.x2-s.x1,dy=s.y2-s.y1,t=Math.max(0,Math.min(1,((p.x-s.x1)*dx+(p.y-s.y1)*dy)/(dx*dx+dy*dy)));return{x:s.x1+t*dx,y:s.y1+t*dy}}
function setLevel(nextDifficulty,nextIndex=0) { difficulty=nextDifficulty;levelIndex=nextIndex;level=difficulty==='procedural'?randomLevel():levels[difficulty][levelIndex];resetGame();document.querySelectorAll('.difficulty').forEach(b=>b.classList.toggle('active',b.dataset.difficulty===difficulty));levelName.textContent=difficulty==='procedural'?'Random · Generated Course':`${difficulty[0].toUpperCase()+difficulty.slice(1)} · ${level.name}`;levelKicker.textContent=difficulty==='procedural'?'A NEW COURSE EACH TIME':`LEVEL ${levelIndex+1} OF ${levels[difficulty].length}`; }
function resetGame(){particles=[];confetti=[];collected=0;lost=0;milestones=[false,false,false];gameWon=false;isPouring=false;winScreen.style.display='none';updateHud()}
function updateHud(){const ratio=Math.min(collected/level.target,1), attempts=collected+lost, accuracy=attempts?Math.round(collected/attempts*100):100;scoreElement.textContent=collected;targetElement.textContent=level.target;pointsElement.textContent=Math.max(0,collected*10-lost*3);accuracyElement.textContent=accuracy;lostElement.textContent=lost;progressFill.style.width=`${ratio*100}%`;document.querySelectorAll('.milestone-dot').forEach((dot,i)=>dot.classList.toggle('reached',milestones[i]));}
function showMilestone(text){milestoneEl.textContent=text;milestoneEl.classList.add('show');setTimeout(()=>milestoneEl.classList.remove('show'),1500)}
function collect(){collected++;const ratio=collected/level.target;[.25,.5,.75].forEach((mark,i)=>{if(!milestones[i]&&ratio>=mark){milestones[i]=true;showMilestone(['Great start!','Halfway there!','Almost full!'][i]);tone(520+i*100,.14,'triangle',.06)}});if(collected%4===0)splash();updateHud();if(collected>=level.target&&!gameWon)win()}
function lose(){lost++;if(lost%5===0)tone(150,.08,'sine',.025);updateHud()}
function win(){gameWon=true;isPouring=false;const attempts=collected+lost,accuracy=Math.round(collected/attempts*100),points=Math.max(0,collected*10-lost*3);document.querySelector('#win-message').textContent=`${points} points · ${accuracy}% of your water made it safely home.`;winScreen.style.display='flex';celebrate();for(let i=0;i<110;i++)confetti.push({x:400,y:210,vx:(Math.random()-.5)*14,vy:-Math.random()*12-3,size:3+Math.random()*5,color:['#ffc907','#2ea3dd','#fff','#ed6b5a'][i%4]})}
function updatePhysics(){if(isPouring&&!gameWon&&particles.length<340){for(let i=0;i<2;i++)particles.push({x:pointerX+(Math.random()-.5)*9,y:pointerY+(Math.random()-.5)*4,vx:(Math.random()-.5)*1.2,vy:Math.random()*1.5,r:4+Math.random()*1.8})}for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.vy=Math.min(p.vy+.22,10);p.x+=p.vx;p.y+=p.vy;for(const s of level.obstacles){const q=pointToSegment(p,s),dx=p.x-q.x,dy=p.y-q.y,d=Math.hypot(dx,dy);if(d&&d<p.r+3){const nx=dx/d,ny=dy/d,push=p.r+3-d;p.x+=nx*push;p.y+=ny*push;const dot=p.vx*nx+p.vy*ny;p.vx=(p.vx-1.72*dot*nx)*.72;p.vy=(p.vy-1.72*dot*ny)*.72}}const c=level.can;if(p.x>c.x+14&&p.x<c.x+c.w-14&&p.y>c.y+8&&p.y<c.y+c.h-8){particles.splice(i,1);collect();continue}if(p.y>620||p.x<-30||p.x>830){particles.splice(i,1);lose()}}confetti.forEach(c=>{c.x+=c.vx;c.y+=c.vy;c.vy+=.28});confetti=confetti.filter(c=>c.y<630)}
function rounded(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function drawCan(c){const{x,y,w,h}=c;ctx.save();ctx.fillStyle='#1d242d22';rounded(x+8,y+h-2,w,h*.08,12);ctx.fill();if(branding.complete&&branding.naturalWidth){ctx.drawImage(branding,280,0,180,205,x-9,y-9,w+18,h+18)}else{ctx.fillStyle='#ffc907';rounded(x,y+12,w,h-12,13);ctx.fill()}ctx.restore()}
function drawPourLine(c){const y=c.y-52,x=c.x-68,w=c.w+136;ctx.save();ctx.setLineDash([8,7]);ctx.strokeStyle='#f07754';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#f07754';ctx.font='800 9px "Nunito Sans"';ctx.textAlign='center';ctx.fillText('POUR UPSTREAM',c.x+c.w/2,y-9);ctx.restore()}
function draw(){ctx.clearRect(0,0,800,600);const sky=ctx.createLinearGradient(0,0,0,600);sky.addColorStop(0,'#dff3fa');sky.addColorStop(1,'#f8f3e6');ctx.fillStyle=sky;ctx.fillRect(0,0,800,600);ctx.fillStyle='#fff8';ctx.beginPath();ctx.arc(130,100,48,0,7);ctx.arc(175,105,34,0,7);ctx.fill();ctx.beginPath();ctx.arc(650,95,44,0,7);ctx.arc(697,100,28,0,7);ctx.fill();ctx.strokeStyle='#34434a';ctx.lineWidth=11;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();level.obstacles.forEach(s=>{ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2)});ctx.stroke();ctx.strokeStyle='#73858c';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#219ed9cc';particles.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill()});drawCan(level.can);drawPourLine(level.can);if(isPouring&&!gameWon){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(pointerX,pointerY,12,0,7);ctx.stroke()}confetti.forEach(c=>{ctx.fillStyle=c.color;ctx.fillRect(c.x,c.y,c.size,c.size)})}
function loop(){updatePhysics();draw();requestAnimationFrame(loop)}
function updatePointer(e){const r=canvas.getBoundingClientRect();pointerX=(e.clientX-r.left)*800/r.width;pointerY=(e.clientY-r.top)*600/r.height}
function isDirectPourZone(x,y){const c=level.can;return x>c.x-72&&x<c.x+c.w+72&&y<c.y+20}
canvas.addEventListener('pointerdown',e=>{e.preventDefault();updatePointer(e);if(isDirectPourZone(pointerX,pointerY)){showMilestone('Follow the course — pour upstream of the line');return}isPouring=true;canvas.setPointerCapture?.(e.pointerId);tone(240,.06,'sine',.025)});canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||isPouring){updatePointer(e);if(isPouring&&isDirectPourZone(pointerX,pointerY)){isPouring=false;showMilestone('Follow the course — pour upstream of the line')}}});window.addEventListener('pointerup',()=>isPouring=false);canvas.addEventListener('pointercancel',()=>isPouring=false);
document.querySelectorAll('.difficulty').forEach(b=>b.addEventListener('click',()=>setLevel(b.dataset.difficulty)));document.querySelector('#reset-btn').addEventListener('click',resetGame);document.querySelector('#replay-btn').addEventListener('click',()=>difficulty==='procedural'?setLevel('procedural'):resetGame());document.querySelector('#next-btn').addEventListener('click',()=>{if(difficulty==='procedural'){setLevel('procedural');return}const next=levelIndex+1;if(next<levels[difficulty].length)setLevel(difficulty,next);else{const order=['easy','medium','hard'],di=order.indexOf(difficulty);setLevel(order[Math.min(di+1,2)])}});soundBtn.addEventListener('click',()=>{soundOn=!soundOn;soundBtn.classList.toggle('muted',!soundOn);soundBtn.textContent=soundOn?'♬':'♩';soundBtn.setAttribute('aria-label',soundOn?'Turn sound off':'Turn sound on');if(soundOn)tone(600,.06,'triangle',.05)});
setLevel('easy');loop();
