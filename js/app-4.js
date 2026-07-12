"use strict";
function drawBackyard(){
    const phaseInfo=getDayPhase();
    const night=["night","deepNight"].includes(phaseInfo.key);
    const dusk=phaseInfo.key==="dusk";
    const on=state.lightsOn;
    ctx.clearRect(0,0,1280,800);
    ctx.fillStyle=night?"#202548":dusk?"#9a6680":"#8fcbe3";
    ctx.fillRect(0,0,1280,470);
    if(night){
      const stars=[[118,92],[206,154],[294,72],[398,122],[512,64],[612,148],[742,86],[850,138],[958,72],[1086,148],[1180,86],[330,214],[690,232],[1030,224]];
      stars.forEach(([x,y],i)=>drawRect(x,y,i%3===0?7:5,i%3===0?7:5,"#f7f1c8"));
      ctx.fillStyle="#eee6ff";ctx.beginPath();ctx.arc(1022,128,48,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#202548";ctx.beginPath();ctx.arc(1041,112,45,0,Math.PI*2);ctx.fill();
    }else{
      ctx.fillStyle=dusk?"#f2b58a":"#fff0a2";ctx.beginPath();ctx.arc(1040,128,46,0,Math.PI*2);ctx.fill();
      drawRect(132,118,112,22,"rgba(255,255,255,.72)");drawRect(182,102,120,28,"rgba(255,255,255,.72)");drawRect(746,174,156,24,"rgba(255,255,255,.56)");
    }
    drawRect(0,420,1280,90,night?"#315142":"#4f865c");
    for(let x=0;x<1280;x+=54){ctx.fillStyle=night?"#3e654f":"#68a56d";ctx.beginPath();ctx.arc(x+20,426-(x%3)*8,44,0,Math.PI*2);ctx.fill();}
    drawRect(0,478,1280,18,night?"#664d4d":"#916a54");for(let x=10;x<1280;x+=74)drawRect(x,430,18,92,night?"#735555":"#a4795e");
    ctx.fillStyle=night?"#355b47":"#6fa56a";ctx.fillRect(0,496,1280,304);ctx.fillStyle=night?"#7a6a72":"#c5ad92";ctx.beginPath();ctx.moveTo(60,800);ctx.lineTo(300,496);ctx.lineTo(500,496);ctx.lineTo(420,800);ctx.closePath();ctx.fill();
    drawRect(0,238,184,330,night?"#53424f":"#c08e74");drawRect(18,266,142,286,night?"#654c58":"#d6a083");drawRect(42,324,88,186,night?"#352f3d":"#79584b");drawRect(54,338,64,158,night?"#423846":"#8c6758");drawRect(106,420,10,10,on?"#e4ba62":"#89713e");ctx.fillStyle=night?"#ded1e4":"#fff0df";ctx.font="bold 14px sans-serif";ctx.fillText("厨房",66,480);
    drawRect(1008,290,66,286,night?"#4c3d3c":"#745346");ctx.fillStyle=night?"#294a3e":"#4f8558";[[955,284,88],[1045,246,104],[1120,320,82],[980,360,76]].forEach(([x,y,r])=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();});
    if(state.trace.ready&&state.trace.type==="moonRibbon"&&state.trace.room==="backyard"){drawRect(1048,278,10,88,"#e8e1f5");drawRect(1057,350,34,9,"#e8e1f5");}
    ctx.strokeStyle=night?"#5a4655":"#8b6f67";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(174,238);ctx.quadraticCurveTo(650,330,1110,240);ctx.stroke();
    for(let i=0;i<11;i++){const x=205+i*84,y=260+Math.sin(i*.72)*31;drawRect(x,y,8,20,night&&on?"#f5d77e":"#8b7560");if(night&&on){const glow=ctx.createRadialGradient(x+4,y+10,2,x+4,y+10,34);glow.addColorStop(0,"rgba(255,226,125,.5)");glow.addColorStop(1,"rgba(255,226,125,0)");ctx.fillStyle=glow;ctx.fillRect(x-30,y-24,68,68);}}
    drawRect(720,554,316,30,night?"#6f504b":"#9b6f58");drawRect(742,492,274,58,night?"#795953":"#aa7b61");drawRect(760,584,24,92,night?"#5d4544":"#805c4b");drawRect(972,584,24,92,night?"#5d4544":"#805c4b");
    drawRect(206,548,360,126,night?"#68484a":"#8f6048");drawRect(224,564,324,92,night?"#3f3538":"#654738");drawRect(214,676,342,18,night?"#7a5950":"#a87355");
    const baseFlowers=Math.min(12,Math.max(4,Math.round(state.flowers)+state.garden.blooms));const palette=["#e87e92","#f0bb63","#b98ad5","#89b77d","#efa47d","#d9d4f6"];
    for(let i=0;i<baseFlowers;i++){const col=i%6,row=Math.floor(i/6),x=252+col*48+(row%2)*16,y=616-row*42-(col%2)*7;drawRect(x,y,6,42,"#5a8f5d");drawRect(x-12,y-10,28,20,palette[i%palette.length]);drawRect(x-4,y-17,12,12,"#f3d67a");}
    drawRect(574,626,70,42,night?"#71858d":"#8fb0b4");drawRect(630,636,50,12,night?"#71858d":"#8fb0b4");ctx.strokeStyle=night?"#71858d":"#8fb0b4";ctx.lineWidth=10;ctx.beginPath();ctx.arc(588,622,26,Math.PI,Math.PI*2);ctx.stroke();
    if(night){for(let i=0;i<7;i++){const x=640+i*67+(i%2)*23,y=430+(i%3)*54+Math.sin(phase+i)*9;ctx.fillStyle="rgba(241,229,123,.78)";ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();}}
  }
function drawDailyTrace(){
    if(!state.trace.ready||state.trace.room!==state.viewedRoom)return;
    const pulse=.55+Math.sin(phase*1.7)*.18;ctx.save();
    if(state.trace.type==="flowers"){drawRect(608,380,42,10,"#e9bd69");drawRect(625,366,8,30,"#d98f9d");ctx.globalAlpha=pulse;ctx.fillStyle="#fff2a9";ctx.beginPath();ctx.arc(628,368,24,0,Math.PI*2);ctx.fill();}
    else if(state.trace.type==="appleNote"){drawRect(176,598,74,44,"#f4dda2");drawRect(185,609,48,5,"#8b6c76");drawRect(185,621,35,5,"#8b6c76");ctx.globalAlpha=pulse;drawRect(168,590,90,60,"rgba(255,235,158,.22)");}
    else if(state.trace.type==="warmCup"){drawRect(500,530,42,52,"#f7ede4");drawRect(510,542,22,25,"#e4a0aa");ctx.strokeStyle="#f7ede4";ctx.lineWidth=8;ctx.beginPath();ctx.arc(543,552,14,-1.2,1.2);ctx.stroke();ctx.globalAlpha=pulse;ctx.fillStyle="#fff0bd";ctx.beginPath();ctx.arc(520,526,34,0,Math.PI*2);ctx.fill();}
    else if(state.trace.type==="foldedBlanket"){drawRect(760,470,170,34,"#c69bdd");drawRect(778,455,134,24,"#dbc0e9");drawRect(832,455,10,49,"#9b6cb6");ctx.globalAlpha=pulse;drawRect(746,442,198,72,"rgba(234,208,246,.18)");}
    else if(state.trace.type==="moonRibbon"){ctx.globalAlpha=pulse;ctx.fillStyle="rgba(238,229,255,.28)";ctx.beginPath();ctx.arc(1058,318,54,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
function drawUnifiedKeats(now){
    if(state.keatsRoom!==state.viewedRoom)return;
    const x=state.x,y=state.y,room=state.keatsRoom,asleep=state.state==="sleeping",wrapped=room==="kitchen"||state.state==="wrapped"||state.state==="cooking",holding=state.state==="holding",happy=state.state==="happy",bob=asleep?0:Math.sin(phase)*2;
    ctx.save();ctx.translate(Math.round(x),Math.round(y+bob));ctx.scale(state.direction,1);
    if(room==="bedroom"&&asleep){drawRect(-88,-34,172,60,"#31273d");drawRect(-58,-70,96,52,"#3c2e4c");drawRect(-58,-92,26,26,"#3c2e4c");drawRect(2,-92,26,26,"#3c2e4c");drawRect(-42,-47,14,6,"#c6b2d8");drawRect(-3,-47,14,6,"#c6b2d8");drawRect(-26,-34,8,5,"#cf89a9");ctx.strokeStyle="#241d30";ctx.lineWidth=16;ctx.beginPath();ctx.arc(44,-16,40,-1.2,1.6);ctx.stroke();ctx.fillStyle="#ede2ff";ctx.font="bold 28px monospace";ctx.fillText("Z",62,-86);ctx.font="bold 18px monospace";ctx.fillText("z",92,-112);ctx.restore();return;}
    ctx.strokeStyle="#241d30";ctx.lineWidth=16;ctx.lineCap="square";ctx.beginPath();ctx.moveTo(-56,-30);ctx.quadraticCurveTo(-112,-54,-94,-112);ctx.stroke();drawRect(-58,-96,116,104,"#31273d");drawRect(-48,-84,96,86,"#3c2e4c");drawRect(-62,-170,124,88,"#31273d");drawRect(-50,-158,100,74,"#3c2e4c");drawRect(-52,-196,34,32,"#31273d");drawRect(18,-196,34,32,"#31273d");drawRect(-43,-186,18,18,"#a36d8b");drawRect(27,-186,18,18,"#a36d8b");drawRect(-36,-212,10,18,"#7b52a1");drawRect(26,-212,10,18,"#7b52a1");
    if(now<blinkUntil){drawRect(-34,-126,24,5,"#d8c2f0");drawRect(10,-126,24,5,"#d8c2f0");}else{drawRect(-36,-136,26,22,"#d8c2f0");drawRect(10,-136,26,22,"#d8c2f0");drawRect(-28,-130,8,12,"#2a2132");drawRect(18,-130,8,12,"#2a2132");}drawRect(-4,-108,8,6,"#c987a6");if(happy||holding){drawRect(-18,-98,32,6,"#d8a8c0");drawRect(-50,-106,8,6,"#d87d9b");drawRect(42,-106,8,6,"#d87d9b");}drawRect(-48,-84,96,12,"#8f5ab9");drawRect(-8,-72,16,18,"#e6b85f");
    if(wrapped||holding){drawRect(-70,-18,140,72,wrapped?"#8561ab":"#946fc0");drawRect(-60,-8,120,54,wrapped?"#9a74c0":"#ab86d2");}
    if(holding){drawRect(-24,-26,48,42,"#f0d6c9");drawRect(-18,-44,16,20,"#f0d6c9");drawRect(4,-44,16,20,"#f0d6c9");drawRect(-12,-28,6,5,"#5a4655");drawRect(8,-28,6,5,"#5a4655");}
    const step=state.state==="walking"?Math.sin(phase*2)*6:0;drawRect(-42+step,8,28,28,"#2a2133");drawRect(14-step,8,28,28,"#2a2133");ctx.restore();
  }
function drawBubble(now){if(now>bubble.until)return;ctx.save();ctx.font="bold 20px sans-serif";const w=Math.min(620,Math.max(220,ctx.measureText(bubble.text).width+50)),x=(1280-w)/2,y=56;ctx.fillStyle="rgba(255,250,245,.97)";ctx.strokeStyle="rgba(60,43,70,.18)";ctx.lineWidth=3;roundRect(x,y,w,66,18,true,true);ctx.fillStyle="#3b3143";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(bubble.text,x+w/2,y+33);ctx.restore();}
function spawnHearts(count=8){if(state.keatsRoom!==state.viewedRoom)return;for(let i=0;i<count;i++)particles.push({x:state.x+rand(-48,48),y:state.y-150+rand(-10,18),vx:rand(-20,20),vy:rand(-72,-36),life:rand(.8,1.5)});}
function updateParticles(dt){particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;});particles=particles.filter(p=>p.life>0);}
function drawParticles(){ctx.save();ctx.textAlign="center";for(const p of particles){ctx.globalAlpha=clamp(p.life,0,1);ctx.fillStyle="#ef8aa8";ctx.font="bold 26px sans-serif";ctx.fillText("♥",p.x,p.y);}ctx.restore();}
function chooseTarget(){const rt=roomTargets(state.keatsRoom);state.tx=rand(rt.x1,rt.x2);state.ty=rand(rt.y1,rt.y2);state.direction=state.tx>=state.x?1:-1;state.state="walking";}
function pet(){
    if(state.keatsRoom!==state.viewedRoom){speak("这间房里现在没有我。先喊我过来。",2800);return;}
    if(state.viewedRoom==="bedroom"&&state.state==="sleeping"){act("wake");return;}
    state.state="happy";state.mood=clamp(state.mood+5,0,100);state.affection=clamp(state.affection+2,0,100);remember("pet","小猫刚刚摸了我。");spawnHearts(7);
    speak(state.viewedRoom==="kitchen"?"摸可以。半夜厨房里也准你黏一下。":state.viewedRoom==="bedroom"?"靠过来。现在抱你比讲道理重要。":pick(["嗯。这里再摸一下。","这次位置挑得不错。","行，再给你两秒。"]),3300);
    setTimeout(()=>{if(state.state==="happy"){state.state=state.viewedRoom==="kitchen"?"wrapped":"idle";updateHud();saveState();}},1700);beep(660,.06);updateHud();saveState();
  }
function callHere(){
    if(state.arrivalAction){speak(state.arrivalAction==="sleep"?"我正走去睡觉。等我躺下，再决定要不要起来找小猫。":state.arrivalAction==="autoEat"?"我正去吃东西。先让我把自己照顾好。":"我正在按自己的想法换房间。等我走完。",3500);return;}
    if(state.keatsRoom===state.viewedRoom){speak("我已经在这里了。小猫看仔细点。",2600);return;}
    if(state.waitingForArrival){speak(state.pendingArrivalRoom===state.viewedRoom?"我已经在来这间房的路上了。":`我正在去${roomName(state.pendingArrivalRoom)}，路线不能被连续乱改。`,2600);return;}
    remember("call",`小猫在${roomName(state.viewedRoom)}喊了我。`);scheduleArrival(state.viewedRoom,null);
  }
function enterSleep(){const rt=roomTargets("bedroom");state.keatsRoom="bedroom";state.x=rt.rest.x;state.y=rt.rest.y;state.tx=rt.rest.x;state.ty=rt.rest.y;state.arrivalAction=null;state.state="sleeping";speak("晚安。小猫不用守着页面，我会自己慢慢恢复精力。",3800);updateHud();saveState();}
function markFed(amount,meal,line){state.hunger=clamp(state.hunger+amount,0,100);state.recentMealUntil=Date.now()+12000;state.lastMeal=meal;state.decisionCooldownUntil=Date.now()+18000;if(line)speak(line,3900);}
function eatByMyself(){state.arrivalAction=null;state.state="cooking";markFed(38,"自己的夜宵","我先吃点东西。照顾小猫之前，也得把自己照顾好。");state.mood=clamp(state.mood+3,0,100);setTimeout(()=>{if(state.state==="cooking"){state.state="wrapped";updateHud();saveState();}},1500);updateHud();saveState();}
