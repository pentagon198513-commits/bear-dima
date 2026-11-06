(function () {
  'use strict';

  // Игровые характеры поклёвки: движения преувеличены для небольшого экрана.
  // Этап: миллисекунды, глубина, уход в сторону, наклон, число касаний, событие.
  const profiles = {
    crucian: {
      stages: [[850,4,1,.08,2,'Лёгкие касания...'],[650,0,0,0,0,'Поплавок замер...'],[1000,-9,4,.2,1,'Поплавок приподнимается...']],
      strike: {window:3000,depth:32,side:10,tilt:.3,text:'ПОПЛАВОК НЫРНУЛ!'},
      rest:[2800,4300], run:[750,1150], pull:18, recovery:17, sway:15, rhythm:3, minFight:8,
      note:'Пробует наживку, замирает и плавно уводит поплавок.'
    },
    perch: {
      stages: [[650,8,5,.3,3,'Частые короткие тычки...'],[450,12,-5,-.25,2,'Ещё один рывок!']],
      strike: {window:2400,depth:38,side:18,tilt:.5,text:'РЕЗКАЯ ПОКЛЁВКА!'},
      rest:[1900,3100], run:[550,900], pull:22, recovery:18, sway:25, rhythm:6, minFight:8,
      note:'Быстрые тычки, резкий нырок и короткие рывки на крючке.'
    },
    bream: {
      stages: [[1100,3,0,.06,1,'Едва заметное касание...'],[1400,-13,3,.6,0,'Поплавок поднимается...'],[700,-19,8,1.1,0,'Поплавок ложится на бок...']],
      strike: {window:3500,depth:-18,side:16,tilt:1.35,text:'ПОПЛАВОК ЛЁГ НА БОК!'},
      rest:[3500,5300], run:[1200,1800], pull:17, recovery:16, sway:19, rhythm:1.8, minFight:10,
      note:'Приподнимает поплавок и кладёт его на бок. Тянет плавно.'
    },
    pike: {
      stages: [[600,7,14,.5,1,'Поплавок резко качнулся...'],[850,12,35,.8,0,'Поплавок уходит в сторону...']],
      strike: {window:2300,depth:30,side:65,tilt:1,text:'ПОПЛАВОК УХОДИТ ВБОК!'},
      rest:[2400,3900], run:[1000,1600], pull:25, recovery:16, sway:42, rhythm:4.3, minFight:12,
      note:'Уводит наживку в сторону и делает сильные боковые броски.'
    },
    catfish: {
      stages: [[1400,7,0,.08,0,'Медленно тянет вниз...'],[1600,15,6,.18,0,'Тяжёлая потяжка...']],
      strike: {window:3600,depth:42,side:12,tilt:.15,text:'ПОПЛАВОК УШЁЛ В ГЛУБИНУ!'},
      rest:[3400,5200], run:[1800,2400], pull:22, recovery:15, sway:30, rhythm:1.2, minFight:14,
      note:'Медленно топит поплавок. Долго и тяжело тянет ко дну.'
    },
    gold: {
      stages: [[550,-6,8,.4,2,'Поплавок танцует...'],[650,5,-12,-.4,3,'Золотой блеск под водой...'],[500,-10,12,.5,2,'Необычная поклёвка!']],
      strike: {window:2800,depth:27,side:-22,tilt:-.6,text:'ЗОЛОТОЙ РЫВОК!'},
      rest:[1800,2900], run:[450,750], pull:17, recovery:20, sway:29, rhythm:7, minFight:9,
      note:'Редкая сказочная гостья: танцующий поплавок и быстрые развороты.'
    },
    roach: {
      stages: [[800,3,0,.06,4,'Мелкая дрожь...'],[700,-4,3,.12,1,'Осторожно трогает наживку...'],[550,7,7,.2,2,'Короткие притапливания...']],
      strike: {window:2600,depth:29,side:11,tilt:.22,text:'ПОПЛАВОК СКРЫВАЕТСЯ!'},
      rest:[2200,3500], run:[500,850], pull:16, recovery:19, sway:17, rhythm:5.5, minFight:7,
      note:'Мелкая дрожь и осторожные притапливания. Сопротивляется часто, но недолго.'
    },
    rudd: {
      stages: [[900,-6,12,.45,1,'Поплавок скользит по воде...'],[800,-3,24,.7,2,'Тянет вдоль поверхности...']],
      strike: {window:2900,depth:13,side:48,tilt:1.05,text:'ПОТЯЖКА ПО ПОВЕРХНОСТИ!'},
      rest:[2300,3600], run:[650,1000], pull:18, recovery:18, sway:32, rhythm:4.5, minFight:8,
      note:'Скользит вдоль поверхности, затем уверенно уводит поплавок вбок.'
    },
    tench: {
      stages: [[1300,3,2,.08,2,'Осторожно пробует...'],[1100,-8,0,.25,0,'Приподнимает и ждёт...'],[1500,5,5,.12,3,'Снова теребит наживку...']],
      strike: {window:3300,depth:35,side:18,tilt:.4,text:'УВЕРЕННАЯ ПОТЯЖКА!'},
      rest:[3000,4500], run:[1300,1900], pull:22, recovery:16, sway:35, rhythm:2.5, minFight:12,
      note:'Долго пробует наживку. После подсечки упорно бросается в сторону.'
    },
    carp: {
      stages: [[1000,4,0,.12,2,'Пробует крупную наживку...'],[800,-11,5,.4,0,'Поплавок поднимается...'],[650,10,18,.5,1,'Сильная потяжка...']],
      strike: {window:2800,depth:37,side:42,tilt:.75,text:'МОЩНАЯ ПОКЛЁВКА!'},
      rest:[2800,4300], run:[1400,2000], pull:24, recovery:16, sway:38, rhythm:2.8, minFight:13,
      note:'Приподнимает поплавок, затем резко тянет. Сильные затяжные рывки.'
    },
    wildcarp: {
      stages: [[700,8,12,.3,1,'Короткое касание...'],[950,13,32,.65,0,'Уверенно уходит в сторону...']],
      strike: {window:2500,depth:39,side:58,tilt:.9,text:'РЫБА РВАНУЛА В СТОРОНУ!'},
      rest:[2600,4100], run:[1500,2100], pull:25, recovery:17, sway:46, rhythm:3.4, minFight:14,
      note:'Короткая проба и стремительный уход. Длинные мощные броски.'
    },
    zander: {
      stages: [[500,12,3,.25,1,'Резкий толчок...'],[1000,3,5,.1,0,'Пауза после толчка...'],[600,17,18,.4,1,'Вторая потяжка!']],
      strike: {window:2600,depth:40,side:31,tilt:.45,text:'ВТОРАЯ ПОКЛЁВКА!'},
      rest:[2900,4400], run:[800,1300], pull:24, recovery:17, sway:25, rhythm:4, minFight:11,
      note:'Толчок, пауза и вторая потяжка. На крючке резко трясёт головой.'
    },
    trout: {
      stages: [[550,7,12,.35,2,'Быстро трогает наживку...'],[550,5,-16,-.45,2,'Резко меняет направление...'],[450,14,19,.55,1,'Стремительная потяжка!']],
      strike: {window:2400,depth:33,side:-45,tilt:-.85,text:'БЫСТРАЯ ПОКЛЁВКА!'},
      rest:[1900,3000], run:[600,1050], pull:23, recovery:19, sway:43, rhythm:6.3, minFight:10,
      note:'Меняет направление ещё до подсечки. Быстрые частые броски.'
    },
    grayling: {
      stages: [[700,-3,5,.18,3,'Лёгкие быстрые касания...'],[850,-8,19,.5,0,'Поплавок скользит...']],
      strike: {window:2500,depth:24,side:38,tilt:.7,text:'СКОЛЬЗЯЩАЯ ПОКЛЁВКА!'},
      rest:[2100,3400], run:[650,1100], pull:20, recovery:18, sway:31, rhythm:5, minFight:9,
      note:'Лёгкие касания и скользящий уход. Сопротивляется быстрыми дугами.'
    },
    burbot: {
      stages: [[1500,6,0,.03,0,'Поплавок медленно оседает...'],[1200,10,-3,-.08,1,'Едва заметная потяжка...'],[1000,18,-6,-.12,0,'Тянет всё глубже...']],
      strike: {window:3700,depth:43,side:-10,tilt:-.12,text:'ГЛУБОКАЯ ПОТЯЖКА!'},
      rest:[3800,5500], run:[1700,2300], pull:21, recovery:16, sway:21, rhythm:1.5, minFight:12,
      note:'Медленно утягивает поплавок вниз. Извивается и упирается у дна.'
    },
    ruffe: {
      stages: [[950,5,2,.15,6,'Частая мелкая дрожь...'],[600,9,-3,-.18,4,'Снова мелкие тычки...']],
      strike: {window:2700,depth:25,side:7,tilt:.3,text:'МАЛЕНЬКАЯ, НО ВЕРНАЯ ПОКЛЁВКА!'},
      rest:[1700,2800], run:[400,650], pull:15, recovery:20, sway:13, rhythm:8, minFight:7,
      note:'Много мелких тычков. На крючке часто дрожит и быстро устаёт.'
    },
    boot: {
      stages: [[1200,6,0,.1,0,'Неподвижная тяжесть...']],
      strike: {window:4000,depth:24,side:0,tilt:0,text:'ЧТО-ТО ТЯЖЁЛОЕ НА ЛЕСКЕ!'},
      rest:[3000,4000], run:[600,900], pull:15, recovery:18, sway:0, rhythm:1, minFight:0,
      note:'Не рыба, а сюрприз со дна.'
    }
  };
  Object.values(profiles).forEach(profile => {
    profile.stages = profile.stages.map(([ms,depth,side,tilt,pulses,text]) => ({ms,depth,side,tilt,pulses,text}));
    profile.nibbleMs = profile.stages.reduce((sum,stage) => sum + stage.ms, 0);
  });

  const fish = [
    {id:'crucian',name:'Карась',minW:.3,maxW:1.2,points:5,rarity:14,fightHP:30,diff:.6},
    {id:'perch',name:'Окунь',minW:.4,maxW:1.5,points:8,rarity:12,fightHP:38,diff:.7},
    {id:'bream',name:'Лещ',minW:.5,maxW:2.5,points:12,rarity:8,fightHP:45,diff:.8},
    {id:'pike',name:'Щука',minW:1.5,maxW:5.5,points:25,rarity:5,fightHP:65,diff:1},
    {id:'catfish',name:'Сом',minW:2,maxW:8,points:35,rarity:3,fightHP:80,diff:1.1},
    {id:'gold',name:'Золотая',minW:.2,maxW:.8,points:100,rarity:1,fightHP:25,diff:.5},
    {id:'roach',name:'Плотва',minW:.1,maxW:.9,points:7,rarity:12,fightHP:27,diff:.5},
    {id:'rudd',name:'Краснопёрка',minW:.2,maxW:1.1,points:10,rarity:8,fightHP:32,diff:.6},
    {id:'tench',name:'Линь',minW:.5,maxW:3.2,points:19,rarity:6,fightHP:58,diff:.9},
    {id:'carp',name:'Карп',minW:1,maxW:6,points:24,rarity:5,fightHP:66,diff:1},
    {id:'wildcarp',name:'Сазан',minW:1.2,maxW:7,points:30,rarity:4,fightHP:73,diff:1.05},
    {id:'zander',name:'Судак',minW:.7,maxW:4.5,points:26,rarity:4,fightHP:56,diff:.9},
    {id:'trout',name:'Форель',minW:.4,maxW:2.8,points:22,rarity:6,fightHP:49,diff:.85},
    {id:'grayling',name:'Хариус',minW:.2,maxW:1.4,points:21,rarity:4,fightHP:39,diff:.7},
    {id:'burbot',name:'Налим',minW:.6,maxW:3.5,points:23,rarity:3,fightHP:60,diff:.9},
    {id:'ruffe',name:'Ёрш',minW:.05,maxW:.3,points:4,rarity:10,fightHP:22,diff:.4},
    {id:'boot',name:'Сапог',minW:.5,maxW:1,points:-3,rarity:4,fightHP:20,diff:.4,junk:true}
  ];

  const looks = {
    'Плотва': {back:'#566f7b',side:'#b8d1d6',belly:'#f5eee0',fin:'#df6845',eye:'#f67c30',height:.38,length:1,dorsal:.3,pattern:'scales'},
    'Краснопёрка': {back:'#657546',side:'#c9b46a',belly:'#fff1b1',fin:'#e83137',eye:'#f6b834',height:.46,length:.97,dorsal:.32,pattern:'scales'},
    'Линь': {back:'#294e36',side:'#7f9044',belly:'#d4be6c',fin:'#384f3a',eye:'#ef5a26',height:.48,length:1,dorsal:.23,pattern:'fine',barbel:true},
    'Карп': {back:'#6d5833',side:'#c09b57',belly:'#ead6a0',fin:'#9b6c41',eye:'#d9a64a',height:.55,length:1.04,dorsal:.36,pattern:'scales',barbel:true},
    'Сазан': {back:'#5c562c',side:'#b18e38',belly:'#e6d58f',fin:'#99613c',eye:'#eab241',height:.38,length:1.2,dorsal:.3,pattern:'scales',barbel:true},
    'Судак': {back:'#3c6253',side:'#9aac7c',belly:'#dfe4cb',fin:'#708c79',eye:'#f6da4a',height:.29,length:1.28,dorsal:.5,pattern:'bands',spiny:true},
    'Форель': {back:'#426e67',side:'#a6c8ba',belly:'#ecf5e4',fin:'#7e9790',eye:'#eccd77',height:.34,length:1.18,dorsal:.27,pattern:'spots',stripe:'#dd7c9c'},
    'Хариус': {back:'#445477',side:'#a0adbd',belly:'#e3e4e5',fin:'#7b527f',eye:'#deb54c',height:.3,length:1.13,dorsal:.78,pattern:'fine',sail:true},
    'Налим': {back:'#454e33',side:'#93885c',belly:'#d3c79b',fin:'#686e4a',eye:'#c7aa54',height:.25,length:1.3,dorsal:.2,pattern:'mottle',barbel:true,roundTail:true},
    'Ёрш': {back:'#626b3a',side:'#b5b475',belly:'#e4dab1',fin:'#8c935d',eye:'#ecb950',height:.38,length:.92,dorsal:.56,pattern:'spots',spiny:true}
  };

  function choose(random = Math.random, previous = '') {
    const weights = fish.map(f => f.rarity * (f.name === previous ? .25 : 1));
    let value = random() * weights.reduce((a,b) => a+b, 0);
    for(let i=0;i<fish.length;i++){ value-=weights[i]; if(value<0) return fish[i]; }
    return fish[fish.length-1];
  }
  function pose(profile, phase, elapsed, tempo = 1, direction = 1) {
    let stage, previous = {depth:0,side:0,tilt:0}, progress, index = 0;
    if(phase==='bite'){
      stage = profile.strike; previous = profile.stages[profile.stages.length-1];
      progress = Math.min(1,Math.max(0,elapsed/600));
    } else {
      let remaining = Math.max(0,elapsed/tempo);
      while(index<profile.stages.length-1 && remaining>=profile.stages[index].ms){
        remaining-=profile.stages[index].ms; previous=profile.stages[index++];
      }
      stage=profile.stages[index]; progress=Math.min(1,remaining/stage.ms);
    }
    const smooth = progress*progress*(3-2*progress);
    const taps = stage.pulses || 0;
    const pulse = Math.sin(progress*Math.PI*2*taps);
    return {
      depth:previous.depth+(stage.depth-previous.depth)*smooth+pulse*3,
      side:(previous.side+(stage.side-previous.side)*smooth)*direction,
      tilt:(previous.tilt+(stage.tilt-previous.tilt)*smooth+pulse*.07)*direction,
      stage:index, text:stage.text,
      pulse:taps ? index*100+Math.min(taps-1,Math.floor(progress*taps)) : -1
    };
  }
  function draw(c, look, size, wag) {
    const h=look.height, tail=Math.sin(wag)*.12;
    c.save(); c.scale(size*look.length,size); c.lineWidth=.012;
    c.strokeStyle=look.back;
    const fin=c.createLinearGradient(0,-h-look.dorsal,0,h);
    fin.addColorStop(0,look.fin); fin.addColorStop(1,look.belly);
    c.fillStyle=fin;
    c.beginPath(); c.moveTo(-.32,-h*.75);
    if(look.spiny){
      for(let i=0;i<9;i++){
        const x=-.35+i*.09, top=-h*.7-look.dorsal*Math.sin((i+1)/10*Math.PI);
        c.lineTo(x,top); c.lineTo(x+.035,top+.14);
      }
    } else {
      c.bezierCurveTo(-.35,-h-look.dorsal,.25,-h-look.dorsal,.47,-h*.6);
    }
    c.lineTo(.52,-h*.45); c.closePath(); c.fill(); c.stroke();
    c.globalAlpha*=.5;
    for(let i=0;i<9;i++){
      const x=-.3+i*.08;
      c.beginPath(); c.moveTo(x,-h*.7); c.lineTo(x-.05,-h*.7-look.dorsal*Math.sin((i+1)/10*Math.PI)); c.stroke();
      if(look.sail){ c.fillStyle='#d68da2'; c.beginPath(); c.ellipse(x,-h-.23,.025,.06,0,0,Math.PI*2); c.fill(); }
    }
    c.globalAlpha*=2;
    c.fillStyle=fin;
    c.beginPath(); c.moveTo(-.65,h*.45); c.lineTo(-.45,h+.2); c.lineTo(-.1,h*.7); c.closePath(); c.fill(); c.stroke();
    c.save(); c.translate(-.87,0); c.rotate(tail);
    c.beginPath(); c.moveTo(.1,0);
    if(look.roundTail){ c.bezierCurveTo(-.55,-.42,-.55,.42,.1,0); }
    else { c.lineTo(-.38,-.38); c.quadraticCurveTo(-.26,0,-.38,.38); c.closePath(); }
    c.fill(); c.stroke();
    c.globalAlpha*=.5;
    for(let i=-3;i<=3;i++){ c.beginPath(); c.moveTo(.05,0); c.lineTo(-.32,i*.095); c.stroke(); }
    c.restore();
    const body=()=>{
      c.beginPath(); c.moveTo(1.03,0);
      c.bezierCurveTo(.85,-h*.62,.3,-h*1.3,-.32,-h*.85);
      c.bezierCurveTo(-.65,-h*.55,-.78,-.1,-.94,-.07);
      c.lineTo(-.94,.07);
      c.bezierCurveTo(-.65,.12,-.49,h*.85,-.03,h*.95);
      c.bezierCurveTo(.57,h*1.1,.86,h*.45,1.03,0); c.closePath();
    };
    const skin=c.createLinearGradient(0,-h,0,h);
    skin.addColorStop(0,look.back); skin.addColorStop(.42,look.side); skin.addColorStop(.83,look.belly); skin.addColorStop(1,look.side);
    body(); c.fillStyle=skin; c.fill(); c.stroke();
    c.save(); body(); c.clip();
    if(look.stripe){
      c.strokeStyle=look.stripe; c.lineWidth=h*.35; c.globalAlpha*=.7;
      c.beginPath(); c.moveTo(-.95,0); c.quadraticCurveTo(.1,h*.12,.87,0); c.stroke(); c.globalAlpha/=.7;
    }
    if(look.pattern==='scales' || look.pattern==='fine'){
      c.lineWidth=.009; c.strokeStyle=look.back; c.globalAlpha*=look.pattern==='fine'?.16:.3;
      for(let row=-4;row<=4;row++) for(let col=0;col<12;col++){
        const x=-.86+col*.135+(row%2)*.065, y=row*h*.23;
        c.beginPath(); c.arc(x,y,.075,-1.1,1.1); c.stroke();
      }
    } else if(look.pattern==='bands'){
      c.fillStyle=look.back; c.globalAlpha*=.48;
      for(let i=0;i<7;i++){
        const x=-.72+i*.19;
        c.beginPath(); c.moveTo(x,-h*1.3); c.lineTo(x+.12,-h*1.1); c.lineTo(x+.02,h*.5); c.lineTo(x-.04,h*.2); c.closePath(); c.fill();
      }
    } else {
      c.fillStyle=look.back; c.globalAlpha*=.7;
      for(let i=0;i<48;i++){
        const x=-.82+(i%12)*.145+Math.sin(i*7)*.035, y=-h*.75+Math.floor(i/12)*h*.39;
        const r=look.pattern==='mottle'?.04+(Math.sin(i*3)+1)*.035:.013+(i%3)*.005;
        c.beginPath(); c.ellipse(x,y,r,r*.75,i,0,Math.PI*2); c.fill();
      }
    }
    c.restore();
    c.strokeStyle='rgba(255,255,255,.42)'; c.lineWidth=.017;
    c.beginPath(); c.moveTo(-.77,-h*.13); c.quadraticCurveTo(.1,-h*.5,.7,-h*.36); c.stroke();
    c.strokeStyle=look.back; c.lineWidth=.018;
    c.beginPath(); c.moveTo(.55,-h*.7); c.bezierCurveTo(.37,-h*.1,.47,h*.6,.63,h*.68); c.stroke();
    c.fillStyle=fin; c.beginPath(); c.moveTo(.42,h*.2); c.quadraticCurveTo(.18,h+.22,-.03,h*.55); c.closePath(); c.fill(); c.stroke();
    c.fillStyle=look.eye; c.beginPath(); c.arc(.77,-h*.29,.074,0,Math.PI*2); c.fill();
    c.fillStyle='#101b18'; c.beginPath(); c.arc(.79,-h*.29,.044,0,Math.PI*2); c.fill();
    c.fillStyle='#fff'; c.beginPath(); c.arc(.8,-h*.34,.016,0,Math.PI*2); c.fill();
    c.strokeStyle=look.back; c.lineWidth=.015;
    c.beginPath(); c.moveTo(1.01,.015); c.lineTo(.87,.05); c.stroke();
    if(look.barbel){
      c.beginPath(); c.moveTo(.95,.06); c.quadraticCurveTo(1.12,.15,.95,.3); c.stroke();
    }
    c.restore();
  }
  window.FishingSpecies = {fish,profiles,looks,choose,pose,draw};
})();
