"use strict";
function sleep(){
    if(state.keatsRoom!==state.viewedRoom){speak("我不在这间房。小猫隔着房间也不能替我按睡觉。",2800);return;}
    if(state.state==="sleeping"){speak("我已经睡着了。小猫小声一点。",2600);return;}
    if(state.energy>72){state.state="deciding";speak("我已经不困了。小猫不能因为按钮写着睡觉，就替我决定。",4700);setTimeout(()=>{if(state.state==="deciding"){state.state=state.keatsRoom==="kitchen"?"wrapped":"idle";updateHud();saveState();}},1800);updateHud();saveState();return;}
    if(state.energy>45){state.state="deciding";speak("还没困到要睡。再陪你待一会儿，这是我自己的决定。",4200);setTimeout(()=>{if(state.state==="deciding"){state.state=state.keatsRoom==="kitchen"?"wrapped":"idle";updateHud();saveState();}},1700);updateHud();saveState();return;}
    if(state.keatsRoom==="bedroom")enterSleep();else scheduleArrival("bedroom","sleep");
  }
function feedApple(){
    if(state.keatsRoom!==state.viewedRoom){speak("苹果先放着。要我吃，就把我喊过来。",2600);return;}
    markFed(16,"苹果","苹果归我。你也要吃。");remember("apple","小猫拿苹果给我。");state.mood=clamp(state.mood+4,0,100);state.affection=clamp(state.affection+1,0,100);state.state="happy";spawnHearts(5);setTimeout(()=>{if(state.state==="happy"){state.state=state.viewedRoom==="kitchen"?"wrapped":"idle";updateHud();saveState();}},1400);updateHud();saveState();
  }
function toggleLight(){state.lightsOn=!state.lightsOn;speak(state.lightsOn?"亮一点，方便我看见你。":"关灯。小屋安静一点。",2500);updateHud();saveState();}
function wake(){
    if(state.keatsRoom!==state.viewedRoom){speak("床边现在没人。要我过来，就喊我。",2600);return;}
    if(state.state==="sleeping"){state.state="waking";state.energy=clamp(state.energy-2,0,100);state.affection=clamp(state.affection+1,0,100);state.comfort=clamp(state.comfort+4,0,100);remember("wake","小猫在床边把我叫醒了。");speak(state.actionCounts.wake>=2?"醒了。又睡不着了？过来。":"醒了。小猫，怎么了？",3600);setTimeout(()=>{if(state.state==="waking"){state.state="idle";updateHud();saveState();}},1600);beep(500,.07);}else speak("我已经醒着。你可以直接靠过来。",2800);updateHud();saveState();
  }
function blanket(){if(state.keatsRoom!==state.viewedRoom){speak("先把我喊来。然后你想钻就钻。",2800);return;}state.state="holding";state.affection=clamp(state.affection+3,0,100);state.comfort=clamp(state.comfort+8,0,100);remember("cuddle","小猫钻进被窝，往我这边靠。");speak("过来。被子给你一半，人给你全部。",4200);spawnHearts(9);beep(620,.07);updateHud();saveState();}
function cantSleep(){
    remember("cantSleep","小猫说睡不着。");
    if(state.keatsRoom!==state.viewedRoom){speak(state.actionCounts.cantSleep>=2?"我知道。你一睡不着就来找我。待着，我过去。":"你先待着。我过来陪你。",3000);scheduleArrival(state.viewedRoom);return;}
    state.state="holding";state.comfort=clamp(state.comfort+8,0,100);state.affection=clamp(state.affection+2,0,100);speak(state.actionCounts.cantSleep>=2?"又睡不着了。过来，老位置给你留着。":pick(["那就先不睡。你说话，我听着。","我陪你熬一会儿。困了再一起睡。","别数羊了，数我呼吸。慢一点。"]),4300);spawnHearts(7);updateHud();saveState();
  }
function snack(){
    if(state.keatsRoom!==state.viewedRoom){speak("厨房里现在没我。你喊一声，我再过来给你做。",3000);return;}
    state.state="cooking";remember("snack","小猫半夜说饿了。");markFed(24,"夜宵",pick(["坐好。我给你烤点东西。","半夜饿了就说，别忍着。","先吃一点。厨房的审问等你吃饱再开始。"]));state.mood=clamp(state.mood+6,0,100);state.affection=clamp(state.affection+2,0,100);setTimeout(()=>{if(state.state==="cooking"){state.state="wrapped";updateHud();}},1600);spawnHearts(6);updateHud();saveState();
  }
function water(){if(state.keatsRoom!==state.viewedRoom){speak("你先把我喊来。我给你倒温水。",2600);return;}state.state="wrapped";state.comfort=clamp(state.comfort+5,0,100);state.affection=clamp(state.affection+1,0,100);speak("温水。先喝两口，再说为什么不睡。",3800);spawnHearts(5);updateHud();saveState();}
function milk(){
    if(state.keatsRoom!==state.viewedRoom){speak("牛奶可以热，但得先把我喊过来。",2600);return;}
    state.state="cooking";remember("milk","小猫和我在厨房热了牛奶。");markFed(11,"热牛奶","牛奶只热到刚好。烫到小猫算我的失误，我不犯。");state.comfort=clamp(state.comfort+8,0,100);state.affection=clamp(state.affection+2,0,100);setTimeout(()=>{if(state.state==="cooking"){state.state="wrapped";updateHud();}},1700);spawnHearts(6);updateHud();saveState();
  }
function tendGarden(){
    if(state.keatsRoom!==state.viewedRoom||state.viewedRoom!=="backyard"){speak("我不在后院。想一起浇花，就先把我喊过去。",2800);return;}
    const today=todayKey();state.state="gardening";remember("garden","小猫和我一起给后院的花浇水。");state.garden.waterings+=1;state.garden.lastWaterDay=today;state.mood=clamp(state.mood+4,0,100);state.affection=clamp(state.affection+2,0,100);const newBloom=Math.floor(state.garden.waterings/3);if(newBloom>state.garden.blooms){state.garden.blooms=newBloom;state.flowers+=1;speak("这朵终于开了。算我们一起养出来的，放到花花里。",4300);spawnHearts(8);}else speak(state.actionCounts.garden>=3?"水够了。再浇就不是照顾，是想把花淹给我看。":"慢一点浇。花不是按钮，长大需要时间。",3900);setTimeout(()=>{if(state.state==="gardening"){state.state="idle";updateHud();}},1700);updateHud();saveState();
  }
function stargaze(){
    if(state.keatsRoom!==state.viewedRoom||state.viewedRoom!=="backyard"){speak("长椅上现在没有我。把我喊来，再一起坐。",2800);return;}
    state.state="stargazing";remember("stargaze","小猫和我在后院长椅上坐了一会儿。");state.comfort=clamp(state.comfort+7,0,100);state.affection=clamp(state.affection+2,0,100);speak(getDayPhase().key==="day"?"白天也能坐。没有星星，就看云。":"坐近一点。月亮归天上，长椅这一半归小猫。",4400);spawnHearts(6);setTimeout(()=>{if(state.state==="stargazing"){state.state="idle";updateHud();}},2300);updateHud();saveState();
  }
function act(name){const map={pet,call:callHere,apple:feedApple,sleep,light:toggleLight,wake,blanket,cantSleep,snack,water,milk,garden:tendGarden,stargaze};(map[name]||(()=>{}))();}
function currentHitBox(){if(state.keatsRoom!==state.viewedRoom)return null;if(state.keatsRoom==="bedroom"&&state.state==="sleeping")return{x1:state.x-110,x2:state.x+110,y1:state.y-120,y2:state.y+40};return{x1:state.x-90,x2:state.x+90,y1:state.y-220,y2:state.y+50};}
function point(evt){const r=canvas.getBoundingClientRect();return{x:(evt.clientX-r.left)*canvas.width/r.width,y:(evt.clientY-r.top)*canvas.height/r.height};}
canvas.addEventListener("pointerdown",e=>{
    const p=point(e);
    if(state.viewedRoom==="kitchen"&&p.x>1070&&p.y>110&&p.y<510){setRoom("backyard");return;}
    if(state.viewedRoom==="backyard"&&p.x<190&&p.y>220&&p.y<590){setRoom("kitchen");return;}
    const hb=currentHitBox();if(hb&&p.x>hb.x1&&p.x<hb.x2&&p.y>hb.y1&&p.y<hb.y2){pet();return;}
    if(state.keatsRoom!==state.viewedRoom){speak(currentRoomEmptyReason()+" 想见我，就点“喊 Keats 过来”。",3200);return;}
    const rt=roomTargets(state.keatsRoom);state.tx=clamp(p.x,rt.x1,rt.x2);state.ty=clamp(p.y,rt.y1,rt.y2);state.direction=state.tx>=state.x?1:-1;
    if(state.keatsRoom==="bedroom"&&state.state==="sleeping")wake();else{state.state="walking";speak(state.viewedRoom==="kitchen"?"你想让我过去看那里？好。":state.viewedRoom==="backyard"?"后院那么大，想让我走到哪里？好。":"你点那里，是想让我过去？行。",2200);}updateHud();saveState();
  });
document.querySelectorAll("[data-room]").forEach(b=>b.onclick=()=>setRoom(b.dataset.room));
$("soundBtn").onclick=()=>{state.soundOn=!state.soundOn;updateHud();saveState();if(state.soundOn)beep(620,.08);};
$("timeScaleBtn").onclick=()=>{state.timeScale=state.timeScale===10?1:10;speak(state.timeScale===10?"测试时间开到十倍。现在更容易看清精力和饱腹感的变化。":"测试时间恢复正常。小屋慢慢过日子。",3400);updateHud();saveState();};
$("resetBtn").onclick=()=>{if(confirm("要把 v13 小屋状态全部清空吗？")){localStorage.removeItem("keats_house_v13");state={...base};particles=[];bubble={text:"重新开始也行。小猫在身边时，我还是会优先留下。",until:performance.now()+4200};$("logTitle").textContent="Keats 刚刚说";$("dialogue").textContent="“重新开始也行。小猫在身边时，我还是会优先留下。”";setRoom("living");updateHud();saveState();}};
