"use strict";
"use strict";
  const $ = id => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rand=(a,b)=>Math.random()*(b-a)+a;
  const pick=a=>a[Math.floor(Math.random()*a.length)];

  const base={
    viewedRoom:"living",
    keatsRoom:"living",
    x:640,y:590,tx:640,ty:590,direction:1,
    mood:80,energy:64,affection:22,comfort:66,hunger:72,flowers:3,
    state:"idle",
    lightsOn:true,soundOn:false,timeScale:1,
    waitingForArrival:false,pendingArrivalRoom:null,arrivalAt:0,
    pendingAction:null,arrivalAction:null,calledFromSleep:false,
    leavingKittenForNeed:false,
    recentMealUntil:0,lastMeal:"",decisionCooldownUntil:0,
    memoryLog:[],
    visits:{living:1,bedroom:0,kitchen:0,backyard:0},
    roomTime:{living:0,bedroom:0,kitchen:0,backyard:0},
    actionCounts:{
      pet:0,call:0,apple:0,wake:0,cuddle:0,cantSleep:0,
      snack:0,milk:0,garden:0,stargaze:0
    },
    daily:{
      date:"",pet:0,call:0,apple:0,wake:0,cuddle:0,cantSleep:0,
      snack:0,milk:0,kitchen:0,backyard:0,garden:0,stargaze:0
    },
    yesterdayMemory:"",
    trace:{date:"",type:"",room:"living",progress:0,ready:false,found:false},
    garden:{waterings:0,blooms:0,lastWaterDay:""},
    habitCountdown:32,
    bubbleText:"小猫在我身边时，我不会为了一个随机计时器突然走掉。",
    lastSeen:Date.now()
  };

  const rooms={
    living:{
      title:"主房间",
      sub:"如果 Keats 在睡觉，这里就会是空的。只有你喊他，他才会过来。",
      hint:"点 Keats 摸摸他；点地板让他走；如果房间空着，就点“喊 Keats 过来”",
      controls:[
        ["pet","摸摸 Keats",true],
        ["call","喊 Keats 过来",false],
        ["apple","喂苹果 🍎",false],
        ["sleep","让 Keats 睡觉",false],
        ["light","切换灯光",false]
      ]
    },
    bedroom:{
      title:"床边夜醒",
      sub:"Keats 睡觉只会在这里。你可以来看他，也可以喊他去别的房间。",
      hint:"如果他在床上，就能叫醒他；如果没在，就说明他在别处",
      controls:[
        ["wake","轻轻叫醒",true],
        ["sleep","让 Keats 睡觉",false],
        ["blanket","钻进被窝",false],
        ["cantSleep","说“睡不着”",false],
        ["call","喊 Keats 过来",false],
        ["light","床头灯",false]
      ]
    },
    kitchen:{
      title:"夜里厨房",
      sub:"厨房里不会默认放一只 Keats。右侧的门通往后院。",
      hint:"点右侧后院门出去；想让 Keats 来，就按“喊 Keats 过来”",
      controls:[
        ["snack","说“我饿了”",true],
        ["water","倒温水",false],
        ["milk","热牛奶",false],
        ["call","喊 Keats 过来",false],
        ["light","厨房灯",false]
      ]
    },
    backyard:{
      title:"月下后院",
      sub:"花圃、长椅、树和串灯都回来了。这里也只会有同一个 Keats。",
      hint:"点左侧小屋门回厨房；可以和 Keats 浇花，或坐在长椅上看天",
      controls:[
        ["garden","和 Keats 浇花",true],
        ["stargaze","坐到长椅上",false],
        ["pet","摸摸 Keats",false],
        ["call","喊 Keats 过来",false],
        ["light","开／关串灯",false]
      ]
    }
  };

  let state = loadState();
  let last = performance.now();
  let phase = 0;
  let blinkUntil = 0;
  let particles = [];
  let bubble = {text:state.bubbleText, until:performance.now()+4200};
  let nextThought = performance.now()+4200;
  let audioCtx = null;
  let controlsSignature = "";

  function loadState(){
    let s={...base};
    let loadedV13=false;
    try{
      const raw=JSON.parse(localStorage.getItem("keats_house_v13")||"{}");
      if(Object.keys(raw).length){
        s={...s,...raw};
        loadedV13=true;
      }
    }catch{}
    if(!loadedV13){
      try{
        const oldV12=JSON.parse(localStorage.getItem("keats_house_v12")||"{}");
        if(Object.keys(oldV12).length){
          s={...s,...oldV12};
        }else{
          const oldV11=JSON.parse(localStorage.getItem("keats_house_v11")||"{}");
          s={...s,...oldV11};
        }
      }catch{}
    }
    s.timeScale=s.timeScale===10?10:1;
    s.pendingAction=s.pendingAction||null;
    s.arrivalAction=s.arrivalAction||null;
    s.calledFromSleep=Boolean(s.calledFromSleep);
    s.leavingKittenForNeed=Boolean(s.leavingKittenForNeed);
    s.recentMealUntil=Number(s.recentMealUntil)||0;
    s.decisionCooldownUntil=Number(s.decisionCooldownUntil)||0;
    s.habitCountdown=Number.isFinite(Number(s.habitCountdown))?clamp(Number(s.habitCountdown),4,90):32;
    const numberOr=(value,fallback)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};
    s.energy=clamp(numberOr(s.energy,64),0,100);
    s.hunger=clamp(numberOr(s.hunger,72),0,100);
    s.mood=clamp(numberOr(s.mood,80),0,100);
    s.affection=clamp(numberOr(s.affection,22),0,100);
    s.comfort=clamp(numberOr(s.comfort,66),0,100);
    s.flowers=Math.max(0,numberOr(s.flowers,3));
    const defaultVisits={living:1,bedroom:0,kitchen:0,backyard:0};
    const defaultRoomTime={living:0,bedroom:0,kitchen:0,backyard:0};
    const defaultCounts={pet:0,call:0,apple:0,wake:0,cuddle:0,cantSleep:0,snack:0,milk:0,garden:0,stargaze:0};
    const defaultDaily={date:"",pet:0,call:0,apple:0,wake:0,cuddle:0,cantSleep:0,snack:0,milk:0,kitchen:0,backyard:0,garden:0,stargaze:0};
    s.visits={...defaultVisits,...(s.visits&&typeof s.visits==="object"?s.visits:{})};
    s.roomTime={...defaultRoomTime,...(s.roomTime&&typeof s.roomTime==="object"?s.roomTime:{})};
    s.actionCounts={...defaultCounts,...(s.actionCounts&&typeof s.actionCounts==="object"?s.actionCounts:{})};
    s.daily={...defaultDaily,...(s.daily&&typeof s.daily==="object"?s.daily:{})};
    s.memoryLog=Array.isArray(s.memoryLog)?s.memoryLog.slice(0,12):[];
    s.yesterdayMemory=typeof s.yesterdayMemory==="string"?s.yesterdayMemory:"";
    s.trace={date:"",type:"",room:"living",progress:0,ready:false,found:false,...(s.trace&&typeof s.trace==="object"?s.trace:{})};
    s.trace.progress=Math.max(0,numberOr(s.trace.progress,0));
    s.trace.ready=Boolean(s.trace.ready);
    s.trace.found=Boolean(s.trace.found);
    s.garden={waterings:0,blooms:0,lastWaterDay:"",...(s.garden&&typeof s.garden==="object"?s.garden:{})};
    s.garden.waterings=Math.max(0,numberOr(s.garden.waterings,0));
    s.garden.blooms=Math.max(0,numberOr(s.garden.blooms,0));
    s.garden.lastWaterDay=typeof s.garden.lastWaterDay==="string"?s.garden.lastWaterDay:"";
    const validRooms=["living","bedroom","kitchen","backyard"];
    if(!validRooms.includes(s.keatsRoom)) s.keatsRoom="living";
    if(!validRooms.includes(s.viewedRoom)) s.viewedRoom="living";
    if(s.state==="sleeping") s.keatsRoom="bedroom";
    if(["deciding","happy","waking","cooking","gardening","stargazing"].includes(s.state)) s.state=s.keatsRoom==="kitchen"?"wrapped":"idle";
    if(s.waitingForArrival){
      if(validRooms.includes(s.pendingArrivalRoom)){s.state="waiting";s.arrivalAt=performance.now()+550;}
      else{s.waitingForArrival=false;s.pendingArrivalRoom=null;s.pendingAction=null;s.leavingKittenForNeed=false;s.state=s.keatsRoom==="kitchen"?"wrapped":"idle";}
    }else if(s.state==="waiting") s.state=s.keatsRoom==="kitchen"?"wrapped":"idle";
    normalizeDailyLife(s);
    const hours=Math.max(0,(Date.now()-numberOr(s.lastSeen,Date.now()))/3600000);
    if(s.state==="sleeping"&&s.keatsRoom==="bedroom") s.energy=clamp(s.energy+hours*8,0,100);
    s.hunger=clamp(s.hunger-hours*3,0,100);
    s.lastSeen=Date.now();
    return s;
  }

  function saveState(){state.lastSeen=Date.now();state.bubbleText=bubble.text;localStorage.setItem("keats_house_v13",JSON.stringify(state));}
  function todayKey(date=new Date()){const y=date.getFullYear();const m=String(date.getMonth()+1).padStart(2,"0");const d=String(date.getDate()).padStart(2,"0");return `${y}-${m}-${d}`;}
  function getDayPhase(date=new Date()){const h=date.getHours();if(h>=5&&h<10)return{key:"morning",label:"清晨"};if(h>=10&&h<17)return{key:"day",label:"白天"};if(h>=17&&h<20)return{key:"dusk",label:"黄昏"};if(h>=20||h<1)return{key:"night",label:"夜晚"};return{key:"deepNight",label:"深夜"};}
  function summarizeDaily(d){if(!d)return"";const parts=[];if((d.apple||0)>0)parts.push(`拿苹果哄了我 ${d.apple} 次`);if((d.wake||0)>0)parts.push(`半夜叫醒了我 ${d.wake} 次`);if((d.cuddle||0)>0)parts.push(`钻进被窝 ${d.cuddle} 次`);if((d.cantSleep||0)>0)parts.push(`说睡不着 ${d.cantSleep} 次`);if((d.kitchen||0)>=2)parts.push(`往厨房跑了 ${d.kitchen} 次`);if((d.backyard||0)>=2)parts.push(`去后院待了 ${d.backyard} 次`);if((d.garden||0)>0)parts.push(`和我浇花 ${d.garden} 次`);if(!parts.length)return"昨天很安静。小猫没有闹我，我反而多看了门口几次。";return`昨天小猫${parts.slice(0,2).join("，还")}。我记得。`;}
  function traceDefinition(type){const map={flowers:{room:"living",hidden:"主房间里好像有一点细小的变化。",found:"花瓶里的花被重新按高低排好了。",line:"我只是觉得它们站得太乱。顺手整理，不是等小猫夸。"},appleNote:{room:"living",hidden:"主房间里似乎多了一张小纸条。",found:"苹果旁压着一张字很小的纸条：记得吃。",line:"那张纸条是我放的。小猫会忘记吃东西，我不会忘。"},warmCup:{room:"kitchen",hidden:"厨房里像是有人提前来过。",found:"桌上的杯子是温的，杯柄正好朝着小猫这一边。",line:"杯子是我放的。方向也是故意的，省得小猫烫到手。"},foldedBlanket:{room:"bedroom",hidden:"卧室的被角看起来比平时整齐。",found:"床尾多了一条叠好的小毯子。",line:"夜里凉。我叠在那里，等小猫自己发现。"},moonRibbon:{room:"backyard",hidden:"后院的树枝上好像多了一点浅色。",found:"树枝上系着一小段月白色丝带，正好会被风吹到长椅旁。",line:"丝带是我系的。风吹起来的时候，小猫坐在长椅上就能看见。"}};return map[type]||map.flowers;}
  function newTraceForDate(dateKey){const choices=["flowers","appleNote","warmCup","foldedBlanket","moonRibbon"];const seed=[...dateKey].reduce((sum,ch)=>sum+ch.charCodeAt(0),0);const type=choices[seed%choices.length];const def=traceDefinition(type);return{date:dateKey,type,room:def.room,progress:0,ready:false,found:false};}
  function normalizeDailyLife(target){const today=todayKey();if(target.daily.date&&target.daily.date!==today){const summary=summarizeDaily(target.daily);target.yesterdayMemory=summary;target.memoryLog=[{kind:"yesterday",text:summary,at:Date.now()},...target.memoryLog].slice(0,12);target.daily={date:today,pet:0,call:0,apple:0,wake:0,cuddle:0,cantSleep:0,snack:0,milk:0,kitchen:0,backyard:0,garden:0,stargaze:0};}else if(!target.daily.date)target.daily.date=today;if(target.trace.date!==today)target.trace=newTraceForDate(today);}
  function remember(kind,text){if(Object.prototype.hasOwnProperty.call(state.actionCounts,kind))state.actionCounts[kind]+=1;if(Object.prototype.hasOwnProperty.call(state.daily,kind))state.daily[kind]+=1;state.memoryLog=[{kind,text,at:Date.now()},...state.memoryLog].slice(0,12);updateLifePanel();}
  function recordRoomVisit(room){state.visits[room]=(Number(state.visits[room])||0)+1;if(room==="kitchen")state.daily.kitchen=(Number(state.daily.kitchen)||0)+1;if(room==="backyard")state.daily.backyard=(Number(state.daily.backyard)||0)+1;}
  function favoriteRoom(){const phase=getDayPhase().key;const livedSeconds=room=>Math.max(0,Number(state.roomTime[room])||0);const livedWeight=room=>Math.log1p(livedSeconds(room)/60)*1.25;const scores={living:4+livedWeight("living"),bedroom:3+livedWeight("bedroom"),kitchen:1.2+livedWeight("kitchen"),backyard:2.2+livedWeight("backyard")};if(["morning","day"].includes(phase)){scores.living+=2.2;scores.backyard+=1.8;}if(phase==="dusk")scores.backyard+=4.2;if(phase==="night")scores.backyard+=1.4;if(["night","deepNight"].includes(phase))scores.bedroom+=2.4;if(state.energy<48)scores.bedroom+=5;if(state.hunger<48)scores.kitchen+=6;if(state.actionCounts.garden>=2)scores.backyard+=1.8;return Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0];}
  function memorySentence(){const c=state.actionCounts;if(c.wake>=2||c.cantSleep>=2)return"小猫睡不着的时候会来找我。这个习惯，我已经记住了。";if(c.apple>=2)return"你总喜欢拿苹果哄我。下次再举起来，我会在你开口前认出来。";if(c.cuddle>=2)return"小猫钻进被窝时总往我这边靠。别装，我记得很清楚。";if(c.call>=3)return"小猫喊我的次数越来越多。每一次我都分得出来。";if(state.yesterdayMemory)return state.yesterdayMemory;if(state.memoryLog.length)return`我记得：${state.memoryLog[0].text}`;return"我还在认识小猫。记忆会从相处里慢慢长出来。";}
  function habitSentence(){if(state.keatsRoom===state.viewedRoom&&state.state!=="sleeping"&&!state.waitingForArrival)return`小猫在${roomName(state.viewedRoom)}时，我会优先留在这一间。自主生活不等于突然把小猫丢下。`;const room=favoriteRoom();if(room==="living")return"我偏爱主房间。窗边、花和小猫经过时的声音都在这里。";if(room==="bedroom")return"最近我更想待在卧室。安静，适合睡觉，也适合把小猫抱近一点。";if(room==="backyard")return"最近我更喜欢后院。风、花和长椅都很安静，小猫也可以坐我旁边。";return"最近厨房很有吸引力。可能是饿，也可能是小猫总在那里制造动静。";}
  function timeSentence(){const phase=getDayPhase();const lines={morning:"清晨。后院的叶子还带着凉意，我可能先去看看花。",day:"白天。精力够的时候，我会在主房间和后院之间活动。",dusk:"黄昏。后院的串灯快亮了，这个时候最适合坐一会儿。",night:"夜晚。我会去后院看看月亮，也会留意小猫是不是又不睡。",deepNight:"深夜。后院太凉，我通常会慢慢回卧室。"};return lines[phase.key];}
  function traceSentence(){const def=traceDefinition(state.trace.type);if(state.trace.found)return def.found;if(state.trace.ready)return def.hidden;return"今天的生活痕迹还在慢慢形成。Keats 没打算提前告诉小猫。";}
