"use strict";
function update(dt,now){
    phase+=dt*4;
    const simDt=dt*state.timeScale;
    if(Math.random()<dt*.12)blinkUntil=now+110;
    normalizeDailyLife(state);
    if(state.waitingForArrival&&now>=state.arrivalAt)beginArrival(state.pendingArrivalRoom);
    if(state.state==="sleeping"&&state.keatsRoom==="bedroom"){
      state.energy=clamp(state.energy+simDt*2.2,0,100);
      if(state.energy>=100){state.energy=100;state.state="idle";speak("我已经不困了。小猫还在，挺好。",4200);updateHud();saveState();}
    }else{
      if(state.state==="walking"){
        const dx=state.tx-state.x,dy=state.ty-state.y,d=Math.hypot(dx,dy);
        if(d<4){
          state.x=state.tx;state.y=state.ty;const action=state.arrivalAction;state.arrivalAction=null;
          if(action==="sleep")enterSleep();else if(action==="autoEat")eatByMyself();else{state.state=state.keatsRoom==="kitchen"?"wrapped":"idle";if(action==="habit")state.decisionCooldownUntil=Date.now()+6000;updateHud();saveState();}
        }else{const speed=120;state.x+=dx/d*speed*dt;state.y+=dy/d*speed*dt;}
      }
      const phaseKey=getDayPhase().key,lateFactor=phaseKey==="deepNight"?1.35:phaseKey==="night"?1.12:1,drain=state.state==="walking"?.5:.08;
      state.energy=clamp(state.energy-simDt*drain*lateFactor,0,100);
    }
    state.hunger=clamp(state.hunger-simDt*.018,0,100);
    state.roomTime[state.keatsRoom]=(Number(state.roomTime[state.keatsRoom])||0)+simDt;
    if(!state.trace.ready){state.trace.progress+=simDt;if(state.trace.progress>=20){state.trace.ready=true;updateLifePanel();saveState();}}
    revealTrace();
    const together=state.keatsRoom===state.viewedRoom&&!state.waitingForArrival;
    if(now>nextThought&&together&&!state.arrivalAction&&state.state!=="sleeping"){
      if(state.viewedRoom==="living"&&!["deciding","cooking","gardening","stargazing"].includes(state.state)&&Math.random()<.28){chooseTarget();speak(pick(["我去窗边看看，但不离开这间房。","巡一下这里。小猫还在，我不往别处跑。","我去花旁边站一会儿。"]),2800);}else speak(contextualThought(),3300);
      nextThought=now+rand(6000,9800);
    }
    const freeToDecide=state.state!=="waiting"&&state.state!=="walking"&&state.state!=="cooking"&&state.state!=="gardening"&&state.state!=="stargazing"&&state.state!=="holding"&&!state.waitingForArrival&&!state.arrivalAction&&Date.now()>=state.decisionCooldownUntil;
    if(state.hunger<=8&&freeToDecide){state.decisionCooldownUntil=Date.now()+18000;if(state.keatsRoom==="kitchen"&&state.state!=="sleeping")eatByMyself();else scheduleArrival("kitchen","autoEat");}
    else if(state.energy<=18&&state.state!=="sleeping"&&freeToDecide){state.decisionCooldownUntil=Date.now()+12000;if(state.keatsRoom==="bedroom")enterSleep();else scheduleArrival("bedroom","sleep");}
    else if(state.hunger<=20&&state.state!=="sleeping"&&freeToDecide){state.decisionCooldownUntil=Date.now()+18000;if(state.keatsRoom==="kitchen")eatByMyself();else scheduleArrival("kitchen","autoEat");}
    else{
      const phaseKey=getDayPhase().key;
      if(phaseKey==="deepNight"&&state.energy<=48&&state.state!=="sleeping"&&freeToDecide){state.decisionCooldownUntil=Date.now()+14000;if(state.keatsRoom==="bedroom")enterSleep();else scheduleArrival("bedroom","sleep");}
      else{
        if(state.state!=="sleeping"&&!together)state.habitCountdown-=simDt;
        if(together&&state.habitCountdown<12)state.habitCountdown=rand(28,48);
        if(state.habitCountdown<=0&&freeToDecide&&state.state!=="sleeping"&&!together){
          state.habitCountdown=rand(28,48);const target=chooseHabitRoom();
          if(target!==state.keatsRoom){state.decisionCooldownUntil=Date.now()+9000;scheduleArrival(target,"habit");}
          else if(state.keatsRoom!==state.viewedRoom){const rt=roomTargets(state.keatsRoom);state.tx=rand(rt.x1,rt.x2);state.ty=rand(rt.y1,rt.y2);state.direction=state.tx>=state.x?1:-1;state.state="walking";}
        }
      }
    }
    updateParticles(dt);
  }
function render(now){
    if(state.viewedRoom==="living")drawLiving();else if(state.viewedRoom==="bedroom")drawBedroom();else if(state.viewedRoom==="kitchen")drawKitchen();else drawBackyard();
    drawDailyTrace();drawUnifiedKeats(now);drawParticles();drawBubble(now);
    if(state.keatsRoom!==state.viewedRoom){ctx.save();ctx.fillStyle="rgba(255,250,245,.93)";ctx.strokeStyle="rgba(60,43,70,.16)";ctx.lineWidth=3;roundRect(365,330,550,110,18,true,true);ctx.fillStyle="#473a53";ctx.textAlign="center";ctx.font="bold 24px sans-serif";ctx.fillText("这间房里现在没有 Keats。",640,372);ctx.font="16px sans-serif";ctx.fillText(currentRoomEmptyReason(),640,404);ctx.fillText(state.waitingForArrival?"他已经在路上了。":"想见他，就点下面的“喊 Keats 过来”。",640,430);ctx.restore();}
    if(state.waitingForArrival){ctx.save();ctx.fillStyle="rgba(115,87,152,.14)";ctx.strokeStyle="rgba(115,87,152,.24)";ctx.lineWidth=3;roundRect(468,120,344,58,16,true,true);ctx.fillStyle="#5f4b7f";ctx.textAlign="center";ctx.font="bold 18px sans-serif";ctx.fillText(`Keats 正在前往${roomName(state.pendingArrivalRoom)}……`,640,156);ctx.restore();}
  }
function loop(now){const dt=Math.min(.04,(now-last)/1000||0);last=now;update(dt,now);render(now);if(Math.floor(now/250)!==Math.floor((now-dt*1000)/250))updateHud();requestAnimationFrame(loop);}
function updateClock(){const d=new Date();$("timeText").textContent=d.toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"});$("dayBadge").textContent=`${getDayPhase(d).label}小屋`;updateLifePanel();}
setRoom(state.viewedRoom||"living",false);
updateHud();
updateClock();
setInterval(updateClock,30000);
setInterval(saveState,5000);
window.addEventListener("beforeunload",saveState);
requestAnimationFrame(loop);
