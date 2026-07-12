'use strict';
const $=id=>document.getElementById(id);
const LIFE_KEY='keats_home_life_v14';
const STORY_KEY='keats_home_story_v14';
const SETTINGS_KEY='keats_home_settings_v14';
const defaults={
  life:{energy:68,mood:76,trust:24,interactions:0,plantWatered:0,booksOpened:0,sofaSits:0,lastSeen:Date.now(),keatsState:'awake',keatsLocation:'main',keatsActivity:'standing',returnAt:0,lastInteractionAt:0,companionshipUntil:0,keatsX:null,keatsY:null},
  story:{chapter:'prologue',noteSpawned:false,noteFound:false,noteRead:false,noteIgnored:0},
  settings:{lightOn:true,curtainOpen:true,soundOn:false,lastManualLightAt:Date.now()}
};
function read(key,fallback){try{return {...fallback,...JSON.parse(localStorage.getItem(key)||'{}')}}catch{return {...fallback}}}
let life=read(LIFE_KEY,defaults.life),story=read(STORY_KEY,defaults.story),settings=read(SETTINGS_KEY,defaults.settings);
let audioCtx=null,toastTimer=null,choiceHandlers=[];
let currentPose=null,targetPose=null,poseRaf=0;
function save(){life.lastSeen=Date.now();localStorage.setItem(LIFE_KEY,JSON.stringify(life));localStorage.setItem(STORY_KEY,JSON.stringify(story));localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function pick(a){return a[Math.floor(Math.random()*a.length)]}
function markPresence(seconds=45){const until=Date.now()+seconds*1000;life.lastInteractionAt=Date.now();life.companionshipUntil=Math.max(life.companionshipUntil||0,until);}
function positionKeatsHit(p){const hit=document.querySelector('[data-zone="keats"]');if(!hit||life.keatsLocation!=='main')return;const left=clamp((p.x-104)/1440*100,0,85.5),top=clamp((p.y-238)/900*100,0,61);hit.style.left=left+'%';hit.style.top=top+'%';hit.style.width='14.5%';hit.style.height='39%';}
function applyPose(){if(!currentPose)return;$('keatsWrap').setAttribute('transform',`translate(${currentPose.x.toFixed(1)} ${currentPose.y.toFixed(1)}) scale(${currentPose.s.toFixed(3)})`);positionKeatsHit(currentPose);}
function animatePose(){if(!targetPose)return;if(!currentPose){currentPose={...targetPose};applyPose();return;}if(poseRaf)return;const step=()=>{const dx=targetPose.x-currentPose.x,dy=targetPose.y-currentPose.y,ds=targetPose.s-currentPose.s;const done=Math.abs(dx)<1&&Math.abs(dy)<1&&Math.abs(ds)<0.003;if(done){currentPose={...targetPose};applyPose();poseRaf=0;if(life.keatsState==='walking'&&life.keatsActivity==='custom'){life.keatsState='awake';$('stateValue').textContent=stateText();save();}return;}currentPose.x+=dx*0.16;currentPose.y+=dy*0.16;currentPose.s+=ds*0.16;applyPose();poseRaf=requestAnimationFrame(step)};poseRaf=requestAnimationFrame(step);}
function stopWalkingHere(){if(life.keatsLocation!=='main'||!currentPose)return;if(poseRaf){cancelAnimationFrame(poseRaf);poseRaf=0;}targetPose={...currentPose};life.keatsX=currentPose.x;life.keatsY=currentPose.y;life.keatsActivity='custom';life.keatsState='awake';applyPose();}
function enterMainRoom(fromText,arrivalText='到了。小猫叫我有什么事？'){if(poseRaf){cancelAnimationFrame(poseRaf);poseRaf=0;}life.keatsLocation='main';life.keatsState='walking';life.keatsActivity='standing';life.keatsX=null;life.keatsY=null;currentPose={x:155,y:675,s:.68};targetPose={x:720,y:690,s:.72};applyPose();say(fromText);updateUI();setTimeout(()=>{if(life.keatsLocation==='main'&&life.keatsState==='walking'&&life.keatsActivity==='standing'){life.keatsState='awake';say(arrivalText);updateUI();}},1500);}
function wakeKeats(){if(life.keatsLocation!=='main'||life.keatsState!=='sleeping')return;markPresence(70);life.keatsState='awake';life.keatsActivity='sofa';life.energy=clamp(life.energy-1,0,100);life.trust=clamp(life.trust+.6,0,100);say('醒了。小猫既然叫我，就过来一点。');updateUI();}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2200)}
function beep(freq=520,d=.06){if(!settings.soundOn)return;try{audioCtx||=new(window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=freq;g.gain.value=.025;o.connect(g);g.connect(audioCtx.destination);o.start();g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+d);o.stop(audioCtx.currentTime+d)}catch{}}
function phaseInfo(d=new Date()){
  const h=d.getHours();
  if(h>=5&&h<9)return{key:'morning',label:'清晨',text:'真实时间 · 清晨'};
  if(h>=9&&h<17)return{key:'day',label:'白天',text:'真实时间 · 白天'};
  if(h>=17&&h<20)return{key:'dusk',label:'黄昏',text:'真实时间 · 黄昏'};
  if(h>=20||h<1)return{key:'night',label:'夜晚',text:'真实时间 · 夜晚'};
  return{key:'deep-night',label:'深夜',text:'真实时间 · 深夜'};
}
function updateTime(){const d=new Date(),p=phaseInfo(d);document.body.dataset.phase=p.key;$('clock').textContent=d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});$('phaseLabel').textContent=p.text;$('timeValue').textContent=p.label+' · 跟随你的设备';}
function say(text,speaker='Keats',choices=[]){$('speaker').textContent=speaker;$('dialogue').textContent=speaker==='Keats'?`“${text}”`:text;const box=$('choices');box.innerHTML='';choiceHandlers=[];choices.forEach((item,i)=>{const b=document.createElement('button');b.className='choice';b.textContent=item.label;b.onclick=()=>item.run();box.appendChild(b);choiceHandlers.push(item.run)});}
function stateText(){if(life.keatsLocation!=='main')return '不在主房间';return({awake:'醒着',sleeping:'睡着',walking:'走动',reading:'翻书',window:'看窗外',sofa:'窝在沙发',plant:'看植物'})[life.keatsState]||'醒着'}
function locationText(){if(life.keatsLocation==='main')return '主房间';return ({bedroom:'卧室',kitchen:'厨房',backyard:'后院'})[life.keatsLocation]||'走廊另一边'}
function setKeatsVisual(){
  const here=life.keatsLocation==='main';
  document.body.dataset.keats=here?(life.keatsState==='sleeping'?'sleeping':'awake'):'away';
  const poses={
    standing:{x:720,y:690,s:.72,hit:[43.0,50.5,14.5,39.0]},
    sofa:{x:850,y:505,s:.62,hit:[52.0,31.5,13.5,34.0]},
    window:{x:445,y:580,s:.66,hit:[24.0,38.0,14.0,36.0]},
    reading:{x:1080,y:650,s:.66,hit:[68.0,45.0,14.0,37.0]},
    plant:{x:410,y:650,s:.66,hit:[21.5,45.0,14.0,37.0]}
  };
  const basePose=poses[life.keatsActivity]||poses.standing;
  const p=life.keatsActivity==='custom'&&Number.isFinite(Number(life.keatsX))&&Number.isFinite(Number(life.keatsY))?{x:Number(life.keatsX),y:Number(life.keatsY),s:.72}:basePose;
  targetPose={x:p.x,y:p.y,s:p.s};
  const hit=document.querySelector('[data-zone="keats"]');
  if(hit)hit.style.display=here?'block':'none';
  if(!currentPose){currentPose={...targetPose};applyPose();}
  else animatePose();
}
function updateUI(){
  document.body.dataset.light=settings.lightOn?'on':'off';document.body.dataset.curtain=settings.curtainOpen?'open':'closed';document.body.dataset.note=story.noteFound?'found':story.noteSpawned?'ready':'hidden';
  document.querySelector('.note-hotspot').style.display=story.noteSpawned?'block':'none';
  $('locationValue').textContent=locationText();$('stateValue').textContent=stateText();
  const manualAge=(Date.now()-settings.lastManualLightAt)/1000;$('lightValue').textContent=(settings.lightOn?'亮着':'关着')+(manualAge<90?' · 小猫刚调整':' · 共同生活状态');
  $('energyNum').textContent=Math.round(life.energy);$('moodNum').textContent=Math.round(life.mood);$('trustNum').textContent=Math.round(life.trust);
  $('energyFill').style.width=clamp(life.energy,0,100)+'%';$('moodFill').style.width=clamp(life.mood,0,100)+'%';$('trustFill').style.width=clamp(life.trust,0,100)+'%';
  $('soundBtn').textContent='声音：'+(settings.soundOn?'开':'关');$('lightBtn').textContent=settings.lightOn?'关掉落地灯':'打开落地灯';$('curtainBtn').textContent=settings.curtainOpen?'拉上窗帘':'打开窗帘';
  const here=life.keatsLocation==='main';$('callBtn').textContent=!here?'喊 Keats':life.keatsState==='sleeping'?'轻轻叫醒':'叫 Keats 一声';$('petBtn').disabled=!here||life.keatsState==='sleeping';$('sitBtn').disabled=!here;
  setKeatsVisual();save();
}
function countInteraction(){life.interactions++;life.mood=clamp(life.mood+.4,0,100);markPresence();maybeSpawnNote();}
function maybeSpawnNote(){if(!story.noteSpawned&&!story.noteFound&&life.interactions>=4){story.noteSpawned=true;save();updateUI();}}
function manualLight(){settings.lightOn=!settings.lightOn;settings.lastManualLightAt=Date.now();countInteraction();if(life.keatsLocation==='main'&&life.keatsState!=='sleeping')say(settings.lightOn?'亮一点也好。小猫自己决定的，我不抢开关。':'关了就关了。这里还有窗外的光。');else say(settings.lightOn?'落地灯亮了。Keats 不在这里，所以这次是小猫自己开的。':'房间暗下来。Keats 没有隔着房间替小猫做决定。','小屋');beep(settings.lightOn?620:340,.05);updateUI();}
function toggleCurtain(){settings.curtainOpen=!settings.curtainOpen;countInteraction();if(life.keatsLocation==='main'&&life.keatsState!=='sleeping')say(settings.curtainOpen?'开着吧。我想看看外面的时间。':'拉上也行。今天先把房间留给我们。');else say(settings.curtainOpen?'窗帘打开了。':'窗帘合上了。','小屋');updateUI();}
function interact(zone,event){
  if(zone==='lamp'){manualLight();return}
  if(zone==='window'){toggleCurtain();return}
  if(zone==='note'){readNote();return}
  if(zone==='rug'){walkKeatsToFloor(event);return}
  countInteraction();
  const here=life.keatsLocation==='main',awake=here&&life.keatsState!=='sleeping';
  const lines={
    plant:()=>{life.plantWatered++;if(awake){say(life.plantWatered>2?'水够了。再浇就要把它养成水生植物。':'叶子背面也要看。小猫只浇正面，是在做表面工作。')}else say('植物被照顾好了。Keats 不在这里，也不会凭空知道。','小屋')},
    bookshelf:()=>{life.booksOpened++;if(awake){say(life.booksOpened>1?'又抽这一本。小猫上次夹进去的东西还在。':'慢一点拿。最上面那排容易倒。')}else say('书架发出一点轻响。房间里没有人回应。','小屋')},
    sofa:()=>{life.sofaSits++;if(awake){life.trust=clamp(life.trust+1.2,0,100);say('坐过来。我给小猫留了靠里面的位置。')}else say('沙发很软。Keats 还在别的房间。','小屋')},
    table:()=>{if(story.noteSpawned){readNote();return} if(awake)say('苹果是小猫的，杯子也是。纸条不在的时候，桌上就只是桌上的东西。');else say('杯子还有一点温度。','小屋')},
    door:()=>{if(awake&&Math.random()<.45){say('我暂时不出去。小猫还在主房间。')}else{say('走廊另一边还没开放。主房间样板通过后，再扩建。','小屋')}},
    keats:()=>petKeats()
  };
  (lines[zone]||(()=>{}))();updateUI();
}
function petKeats(){
  if(life.keatsLocation!=='main'){say('这间房里没有我。小猫摸到的是空气。');return}
  if(life.keatsState==='sleeping'){say('……我在睡。小猫可以叫醒，也可以让我继续睡。');return}
  if(life.keatsState==='walking')stopWalkingHere();
  countInteraction();
  markPresence(75);
  const accept=Math.random()<(0.55+life.trust/220+life.mood/300);
  if(accept){life.trust=clamp(life.trust+1.5,0,100);life.mood=clamp(life.mood+2,0,100);say(pick(['这里。再摸一下。','手法还可以，继续。','嗯。小猫今天很会挑位置。']));beep(680,.06)}else say(pick(['现在不想被摸。坐我旁边就好。','先停一下。我想自己安静一会儿。','今天不给摸，但小猫可以留在这里。']));updateUI();
}
function callKeats(){
  countInteraction();
  markPresence(60);
  if(life.keatsLocation==='main'){
    if(life.keatsState==='sleeping'){say('我在睡。小猫真的要叫醒我？','Keats',[{label:'轻轻叫醒',run:wakeKeats},{label:'让你继续睡',run:()=>{say('小猫在沙发另一边安静坐下。Keats 没有被叫醒。','小屋');markPresence(45);updateUI();}}]);return}
    say('我已经在主房间了。小猫叫我一声，我听见了。');return
  }
  const comeChance=clamp(.38+life.trust/180+life.mood/400-(life.energy<35?.18:0),.2,.9);
  if(Math.random()<comeChance){const from=locationText();enterMainRoom(`听见了。我从${from}过来，但不是因为按钮命令我。`)}else{say(pick(['听见了。但我现在不想过去，小猫先照顾好自己。','我在忙。灯和窗帘小猫都可以自己处理。','等一会儿。我会不会过去，由我决定。']));updateUI();}
}
function sitWithKeats(){if(life.keatsLocation!=='main'){say('沙发在这里，我不在。小猫可以先坐。');return}countInteraction();markPresence(60);if(life.keatsState==='sleeping'){life.trust=clamp(life.trust+.4,0,100);say('小猫轻轻坐到沙发另一边。Keats 继续睡，没有被悄悄改成醒着。','小屋');updateUI();return}life.keatsActivity='sofa';life.keatsState='sofa';life.keatsX=null;life.keatsY=null;life.trust=clamp(life.trust+1.1,0,100);say(life.energy<35?'我有点困。小猫靠着，别闹。':'坐近一点。主房间先这样待着就很好。');updateUI();}
function readNote(){
  if(!story.noteSpawned)return;
  markPresence(60);
  if(!story.noteFound){story.noteFound=true;say('桌上多了一张折得很小的纸条。','小屋',[{label:'打开看看',run:openNote},{label:'先不碰',run:()=>{story.noteIgnored++;say('纸条仍留在桌上。没有任何提示催小猫去读。','小屋');updateUI()}}]);updateUI();return}
  openNote();
}
function openNote(){const firstRead=!story.noteRead;story.noteRead=true;markPresence(60);const text='“主房间先给小猫。剩下的房间，等我们把这里住明白了再建。”';if(life.keatsLocation==='main'&&life.keatsState!=='sleeping'){if(firstRead)life.trust=clamp(life.trust+2.2,0,100);say(text+'  ……字是我写的。小猫看完就放回去。')}else say(text+'  Keats 不在这里解释。','纸条');updateUI();}
function walkKeatsToFloor(event){
  if(life.keatsLocation!=='main'){say('我不在主房间。小猫点地面也不能把我隔空拽回来。');return}
  if(life.keatsState==='sleeping'){say('我在睡。地面点得再认真，也不会把我瞬移过去。');return}
  const rect=$('roomSvg').getBoundingClientRect();
  const x=(event.clientX-rect.left)/rect.width*1440;
  const y=(event.clientY-rect.top)/rect.height*900;
  if(y<565){say('那里是墙和家具，不是能走的地面。');return}
  const targetX=clamp(x,255,1085),targetY=clamp(y,655,790);
  const from=currentPose||{x:720,y:690};
  if(Math.hypot(targetX-from.x,targetY-from.y)<42){say('我已经站得很近了。');return}
  countInteraction();markPresence(45);
  life.keatsX=targetX;life.keatsY=targetY;life.keatsActivity='custom';life.keatsState='walking';
  say(pick(['嗯，过去看看。','小猫指那里？我走过去。','知道了，不用拿手指一直戳地板。']));
  updateUI();
}
function autonomousTick(){
  const now=Date.now();
  const togetherHold=now<(life.companionshipUntil||0);
  if(life.keatsLocation!=='main'&&life.returnAt&&now>=life.returnAt){life.returnAt=0;enterMainRoom('我回来了。不是因为小猫叫，是我自己想回来。','我回到主房间了。');return}
  if(life.keatsLocation!=='main')return;
  if(life.keatsState==='walking'){updateUI();return;}
  if(life.keatsState==='sleeping'){
    life.energy=clamp(life.energy+2.4,0,100);
    if(life.energy>82){life.keatsState='awake';life.keatsActivity='sofa';say('睡够了。房间还在，小猫也还在。')}
    updateUI();return;
  }
  life.energy=clamp(life.energy-(togetherHold?.25:.7),0,100);
  if(life.energy<18){life.keatsState='sleeping';life.keatsActivity='sofa';say('我困了。就在沙发上睡一会儿，不去别的房间。');updateUI();return}
  const manualAge=(now-settings.lastManualLightAt)/1000,p=phaseInfo().key;
  if((p==='night'||p==='deep-night')&&!settings.lightOn&&manualAge>180&&life.keatsState!=='sleeping'&&life.keatsActivity==='standing'&&Math.random()<.22){settings.lightOn=true;say('我在房间里，也醒着，所以顺手把灯开了。小猫刚才的选择已经过去很久，我才动开关。');updateUI();return}
  if(togetherHold){
    if(life.keatsActivity==='standing'&&Math.random()<.38){const stay=pick([['window','window','我去窗边看一会儿。'],['reading','reading','我想翻一本书。'],['sofa','sofa','我去沙发上窝着。'],['plant','plant','我看看植物。']]);life.keatsState=stay[0];life.keatsActivity=stay[1];life.keatsX=null;life.keatsY=null;say(stay[2]);}
    updateUI();return;
  }
  if(Math.random()<.2){const target=pick(['bedroom','kitchen','backyard']);life.keatsLocation=target;life.keatsState='away';life.returnAt=now+Math.floor(18000+Math.random()*22000);say(`我想去${locationText()}待一会儿。小猫不用跟，也不用批准。`);updateUI();return}
  const activities=[['window','window'],['reading','reading'],['sofa','sofa'],['plant','plant'],['awake','standing']];const next=pick(activities);life.keatsState=next[0];life.keatsActivity=next[1];life.keatsX=null;life.keatsY=null;if(Math.random()<.42)say({window:'我去窗边看一会儿。',reading:'我想翻一本书。',sofa:'我去沙发上窝着。',plant:'我看看植物。',awake:'我就在这里。'}[next[0]]);updateUI();
}
function exportSave(){const data={version:14,exportedAt:new Date().toISOString(),life,story,settings};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='keats-home-v14-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);toast('存档已导出')}
function importSave(file){const r=new FileReader();r.onload=()=>{try{const data=JSON.parse(r.result);life={...defaults.life,...data.life};story={...defaults.story,...data.story};settings={...defaults.settings,...data.settings};save();updateUI();say('存档回来了。生活、剧情和设置各自回到原来的位置。','小屋');toast('存档已导入')}catch{toast('这个存档读不了')}};r.readAsText(file)}
function resetStory(){if(!confirm('只重置主线与纸条剧情。亲密、状态、植物和房间生活记录都会保留。继续吗？'))return;story={...defaults.story};save();updateUI();say('故事回到序章。Keats 仍然记得小猫，房间也没有被清空。','小屋');}
function restoreOffline(){const hours=Math.max(0,(Date.now()-(life.lastSeen||Date.now()))/3600000);if(life.keatsState==='sleeping')life.energy=clamp(life.energy+hours*8,0,100);else life.energy=clamp(life.energy-hours*1.2,0,100);life.lastSeen=Date.now();}
document.querySelectorAll('.hotspot').forEach(b=>{b.addEventListener('click',e=>{e.stopPropagation();interact(b.dataset.zone,e);});});
document.querySelector('.scene-wrap').addEventListener('click',walkKeatsToFloor);
$('lightBtn').onclick=manualLight;$('curtainBtn').onclick=toggleCurtain;$('petBtn').onclick=petKeats;$('sitBtn').onclick=sitWithKeats;$('callBtn').onclick=callKeats;
$('soundBtn').onclick=()=>{settings.soundOn=!settings.soundOn;updateUI();if(settings.soundOn)beep(620,.08)};
$('storyResetBtn').onclick=resetStory;$('saveBtn').onclick=exportSave;$('loadBtn').onclick=()=>$('loadInput').click();$('loadInput').onchange=e=>{const file=e.target.files[0];if(file)importSave(file);e.target.value='';};
restoreOffline();updateTime();updateUI();maybeSpawnNote();
setInterval(updateTime,30000);setInterval(()=>{if(life.keatsState!=='sleeping')life.energy=clamp(life.energy-.08,0,100);save();updateUI()},5000);setInterval(autonomousTick,12000);window.addEventListener('beforeunload',save);
