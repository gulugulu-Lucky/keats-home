"use strict";
function updateLifePanel(){
    if(!$("memoryLine")) return;
    $("memoryLine").textContent=memorySentence();
    $("memoryMeta").textContent=`苹果 ${state.actionCounts.apple} · 夜醒 ${state.actionCounts.wake} · 浇花 ${state.actionCounts.garden}`;
    $("habitLine").textContent=habitSentence();
    $("habitMeta").textContent=`主房间 ${Math.round(state.roomTime.living)}s · 卧室 ${Math.round(state.roomTime.bedroom)}s · 厨房 ${Math.round(state.roomTime.kitchen)}s · 后院 ${Math.round(state.roomTime.backyard)}s`;
    $("timeSenseLine").textContent=timeSentence();
    $("timeMeta").textContent=`${getDayPhase().label} · 时间会影响困意、想法和房间选择`;
    $("traceLine").textContent=traceSentence();
    $("traceMeta").textContent=state.trace.found?"小猫已经发现了今天的痕迹":state.trace.ready?`线索在${roomName(state.trace.room)}`:"有些事不会立刻被小猫发现";
    $("traceCard").classList.toggle("trace-ready",state.trace.ready&&!state.trace.found);
  }
function revealTrace(){
    if(!state.trace.ready||state.trace.found||state.viewedRoom!==state.trace.room)return;
    state.trace.found=true;
    const def=traceDefinition(state.trace.type);
    const keatsCanAnswer=state.keatsRoom===state.viewedRoom&&state.state!=="sleeping"&&!state.waitingForArrival;
    if(keatsCanAnswer)speak(def.line,4700);else narrate(`${def.found} Keats 不在这里解释。`,4700);
    state.memoryLog=[{kind:"trace",text:def.found,at:Date.now()},...state.memoryLog].slice(0,12);
    updateLifePanel();saveState();
  }
function contextualThought(){
    const phase=getDayPhase().key;
    if(state.hunger<35)return"厨房是不是还有东西？我开始认真考虑了。";
    if(state.energy<35)return"精力不多了。我会自己决定什么时候回卧室。";
    if(state.trace.found&&Math.random()<.25)return"被小猫发现了。下次我会藏得更好一点。";
    if(state.actionCounts.apple>=2&&Math.random()<.3)return"苹果先别拿出来。我知道小猫又想哄我。";
    if(state.actionCounts.cantSleep>=1&&["night","deepNight"].includes(phase))return"今晚睡不着，也可以直接来找我。";
    if(phase==="deepNight")return"已经很晚了。后院也凉，小猫该回屋了。";
    if(phase==="morning")return"早上的后院很好看。花上还有一点光。";
    if(state.keatsRoom==="living")return pick(["花还好。","窗边适合发呆。","主房间今天很安静。"]) ;
    if(state.keatsRoom==="kitchen")return pick(["厨房不是卧室，别想让我一直待着。","杯子摆正了。","草莓还在。"]) ;
    if(state.keatsRoom==="backyard")return pick(["风刚好。","长椅给小猫留了一半。","后院的花要慢慢长，急也没用。","月亮今天还算懂事。"]) ;
    return pick(["卧室最安静。","被子需要重新叠一下。","小猫今晚会不会又来？"]);
  }
function chooseHabitRoom(){
    const phase=getDayPhase().key;
    if(state.hunger<48)return"kitchen";
    if(state.energy<42)return"bedroom";
    if(phase==="deepNight")return Math.random()<.72?"bedroom":"living";
    if(phase==="night"){const roll=Math.random();return roll<.46?"bedroom":roll<.76?"backyard":"living";}
    if(phase==="dusk")return Math.random()<.68?"backyard":"living";
    if(["morning","day"].includes(phase)){const roll=Math.random();return roll<.58?"living":roll<.84?"backyard":"kitchen";}
    return favoriteRoom();
  }
function beep(freq=520,d=.06){
    if(!state.soundOn)return;
    try{audioCtx||=new(window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type="square";o.frequency.value=freq;g.gain.value=.025;o.connect(g);g.connect(audioCtx.destination);o.start();g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+d);o.stop(audioCtx.currentTime+d);}catch{}
  }
function speak(text,ms=3400){bubble={text,until:performance.now()+ms};$("logTitle").textContent="Keats 刚刚说";$("dialogue").textContent=`“${text}”`;state.bubbleText=text;}
function narrate(text,ms=3800){bubble={text,until:performance.now()+ms};$("logTitle").textContent="小屋里发生了";$("dialogue").textContent=text;state.bubbleText=text;}
function stateLabel(){const map={idle:"醒着",walking:"散步",happy:"开心",sleeping:"睡着",waking:"刚醒",holding:"抱着小猫",cooking:"做点吃的",wrapped:"披着毯子",waiting:"正在过来",gardening:"正在浇花",stargazing:"坐在长椅上"};$("stateBadge").textContent=map[state.state]||state.state;}
function roomName(room){return({living:"主房间",bedroom:"卧室",kitchen:"夜里厨房",backyard:"月下后院"})[room]||"未知位置";}
function actionName(){const map={idle:"醒着",walking:"正在走动",happy:"开心",sleeping:"正在睡觉",waking:"刚刚醒来",holding:"抱着小猫",cooking:"正在做吃的",wrapped:"披着毯子",waiting:"正在前往",deciding:"正在做决定",gardening:"正在照顾花圃",stargazing:"正在看天空"};return map[state.state]||state.state;}
function updateStatusCenter(){
    const sleeping=state.state==="sleeping"&&state.keatsRoom==="bedroom",justAte=Date.now()<state.recentMealUntil,together=state.keatsRoom===state.viewedRoom&&!state.waitingForArrival,scaleNote=state.timeScale===10?"（10×）":"";
    $("locationStatus").textContent=state.waitingForArrival?`${roomName(state.keatsRoom)} → ${roomName(state.pendingArrivalRoom)}`:roomName(state.keatsRoom);
    $("actionStatus").textContent=actionName();
    const energyTrend=sleeping?`精力 ↑ 恢复中${scaleNote}`:`精力 ↓ 消耗中${scaleNote}`;
    const hungerTrend=justAte?`饱腹感 ↔ 刚吃过${state.lastMeal?`（${state.lastMeal}）`:""}`:state.hunger<=25?`饱腹感 ↓ 已经饿了${scaleNote}`:`饱腹感 ↓ 消耗中${scaleNote}`;
    $("trendStatus").textContent=`${energyTrend} · ${hungerTrend}`;
    $("trendStatus").className="status-value "+(sleeping?"trend-up":"trend-down");
    if(state.waitingForArrival){const reason=state.pendingAction==="sleep"?"困了，先告诉小猫再回卧室":state.pendingAction==="autoEat"?"饿了，先告诉小猫再去厨房":state.pendingAction==="habit"?"按自己的习惯换个房间":"回应小猫的呼唤";$("routeStatus").textContent=`从${roomName(state.keatsRoom)}前往${roomName(state.pendingArrivalRoom)}：${reason}`;}
    else if(state.state==="walking"&&state.arrivalAction){const reason=state.arrivalAction==="sleep"?"走到床边后睡觉":state.arrivalAction==="autoEat"?"走到厨房后自己吃东西":state.arrivalAction==="habit"?"按自己的想法走进房间":"正在走进房间";$("routeStatus").textContent=`Keats 已到${roomName(state.keatsRoom)}：${reason}`;}
    else if(together)$("routeStatus").textContent=sleeping?`正在卧室睡觉，精力 ${Math.round(state.energy)} / 100`:`和小猫一起待在${roomName(state.keatsRoom)} · 陪伴优先`;
    else $("routeStatus").textContent=`小猫在${roomName(state.viewedRoom)}；Keats 在${roomName(state.keatsRoom)}`;
    $("timeScaleBtn").textContent=`测试时间：${state.timeScale}×`;$("timeScaleBtn").classList.toggle("test-on",state.timeScale===10);
  }
function updateHud(){const vals={mood:state.mood,energy:state.energy,affection:state.affection,comfort:state.comfort,hunger:state.hunger};for(const[k,v]of Object.entries(vals)){ $(k+"Num").textContent=Math.round(v);$(k+"Bar").style.width=clamp(v,0,100)+"%";}$("flowersNum").textContent=Math.round(state.flowers);$("flowersBar").style.width=clamp(state.flowers*10,5,100)+"%";$("soundBtn").textContent="声音："+(state.soundOn?"开":"关");stateLabel();updateStatusCenter();updateLifePanel();renderControls();}
function roomTargets(room){if(room==="living")return{x1:260,x2:930,y1:565,y2:640,entry:{x:90,y:585,dir:1},rest:{x:640,y:590}};if(room==="bedroom")return{x1:690,x2:840,y1:420,y2:480,entry:{x:1160,y:430,dir:-1},rest:{x:785,y:430}};if(room==="backyard")return{x1:230,x2:1040,y1:560,y2:660,entry:{x:145,y:605,dir:1},rest:{x:650,y:610}};return{x1:270,x2:930,y1:560,y2:640,entry:{x:105,y:590,dir:1},rest:{x:640,y:590}};}
function currentRoomEmptyReason(){if(state.keatsRoom===state.viewedRoom&&!state.waitingForArrival)return"";if(state.waitingForArrival)return state.pendingArrivalRoom===state.viewedRoom?`Keats 正在前往${roomName(state.viewedRoom)}。`:`Keats 正在前往${roomName(state.pendingArrivalRoom)}，不是这间房。`;if(state.keatsRoom==="bedroom"&&state.state==="sleeping")return"Keats 正在卧室睡觉，精力仍在恢复。";return`Keats 现在在${roomName(state.keatsRoom)}。`;}
function setRoom(room,countVisit=true){
    const previous=state.viewedRoom;state.viewedRoom=room;if(countVisit&&previous!==room)recordRoomVisit(room);
    document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.room===room));$("sceneTitle").textContent=rooms[room].title;$("sceneSub").textContent=rooms[room].sub;$("hint").textContent=rooms[room].hint;
    if(state.waitingForArrival)narrate(state.pendingArrivalRoom===room?`能听见脚步声。Keats 正在往${roomName(room)}走。`:`Keats 正在前往${roomName(state.pendingArrivalRoom)}，没有因为小猫切房间而瞬移。`,3200);
    else if(state.keatsRoom!==room){const emptyLine={living:"主房间里现在没有 Keats。",bedroom:"床边现在是空的。",kitchen:"厨房里现在只有杯子和夜宵。",backyard:"后院现在只有风、花和长椅。"};narrate(`${emptyLine[room]} 他在${roomName(state.keatsRoom)}。`,3200);}
    else{const remembered=room==="kitchen"&&state.actionCounts.snack>=2?"我就在厨房。小猫果然又来了。":room==="bedroom"&&state.actionCounts.cantSleep>=1?"我在床边。又睡不着了？":room==="backyard"&&state.actionCounts.garden>=1?"我在后院。花今天看起来比昨天精神。":room==="living"?"我就在主房间。":room==="bedroom"?(state.state==="sleeping"?"……":"我在床边。"):room==="kitchen"?"我就在厨房。":"我在后院。风不大，过来坐。";speak(remembered,2800);}
    revealTrace();updateHud();saveState();
  }
function renderControls(){
    const room=state.viewedRoom,here=state.keatsRoom===room,asleep=state.state==="sleeping"&&state.keatsRoom==="bedroom",busy=state.waitingForArrival||["cooking","gardening","stargazing"].includes(state.state),sleepLabel=state.energy<=45?"陪 Keats 去睡觉":"问 Keats 要不要睡";let items;
    if(room==="living")items=[["pet","摸摸 Keats",here&&!asleep,true],["call",here?"Keats 已在这里":asleep?"叫醒并喊来":"喊 Keats 过来",!here,false],["apple","喂苹果 🍎",here&&!asleep,false],["sleep",sleepLabel,here&&!asleep,false],["light","切换灯光",true,false]];
    else if(room==="bedroom")items=[[asleep?"wake":"sleep",asleep?"轻轻叫醒":sleepLabel,here,true],["blanket","钻进被窝",here,false],["cantSleep","说“睡不着”",here,false],["call",here?"Keats 已在这里":"喊 Keats 过来",!here,false],["light","床头灯",true,false]];
    else if(room==="kitchen")items=[["snack","说“我饿了”",here&&!asleep,true],["water","倒温水",here&&!asleep,false],["milk","热牛奶",here&&!asleep,false],["call",here?"Keats 已在这里":asleep?"叫醒并喊来":"喊 Keats 过来",!here,false],["light","厨房灯",true,false]];
    else items=[["garden","和 Keats 浇花",here&&!asleep,true],["stargaze","坐到长椅上",here&&!asleep,false],["pet","摸摸 Keats",here&&!asleep,false],["call",here?"Keats 已在这里":asleep?"叫醒并喊来":"喊 Keats 过来",!here,false],["light","开／关串灯",true,false]];
    const signature=JSON.stringify({room,state:state.state,keatsRoom:state.keatsRoom,energyBand:state.energy<=45?"tired":"awake",waiting:state.waitingForArrival,items});if(signature===controlsSignature)return;controlsSignature=signature;$("controls").innerHTML="";for(const[name,label,enabled,primary]of items){const b=document.createElement("button");b.className="action"+(primary?" primary":"");b.textContent=label;b.disabled=!enabled||(busy&&name!=="light"&&name!=="wake");b.onclick=()=>act(name);$("controls").appendChild(b);}
  }
function scheduleArrival(room,action=null){
    if(state.waitingForArrival)return;
    const togetherBeforeLeaving=state.keatsRoom===state.viewedRoom&&state.state!=="sleeping",necessaryDeparture=action==="sleep"||action==="autoEat";
    state.calledFromSleep=state.keatsRoom==="bedroom"&&state.state==="sleeping";state.leavingKittenForNeed=togetherBeforeLeaving&&necessaryDeparture;state.waitingForArrival=true;state.pendingArrivalRoom=room;state.pendingAction=action;state.arrivalAt=performance.now()+900;state.state="waiting";
    if(action==="sleep")speak(state.leavingKittenForNeed?"我真的困了，要回卧室睡。先告诉小猫一声，不会突然把你丢在这里。":"我确实困了。先走回卧室，不在原地瞬移。",4200);
    else if(action==="autoEat")speak(state.leavingKittenForNeed?"我饿了，要去厨房吃点东西。小猫可以跟来，我不会不打招呼就走。":state.calledFromSleep?"饿醒了。我去厨房找点吃的，再回来睡。":"我饿了，去厨房找点东西。饿着还装没事，没必要。",4200);
    else if(action==="habit"){const lines={living:"我想去主房间看看窗和花。不是小猫叫的，是我自己想去。",bedroom:"我想回卧室安静一会儿。",kitchen:"我去厨房看看。先声明，不一定是因为馋。",backyard:"我想去后院吹一会儿风。小猫不用批准。"};speak(lines[room],3900);}
    else speak(state.calledFromSleep?"听见了。我从床上起来，现在过去。":"等我一下，我现在过去。",3200);
    updateHud();saveState();
  }
