const $=s=>document.querySelector(s);
let audioCtx=null, master=null, convolver=null, recording=false, sequence=[], reverbOn=true, lastTime=0;
const notes=[
 {name:"C",semi:0,key:"A",color:"#0b6cf0"},{name:"D",semi:2,key:"S",color:"#1479f5"},
 {name:"E",semi:4,key:"D",color:"#2188fa"},{name:"F",semi:5,key:"F",color:"#3295fb"},
 {name:"G",semi:7,key:"G",color:"#45a1fc"},{name:"A",semi:9,key:"H",color:"#5aafff"},
 {name:"B",semi:11,key:"J",color:"#73baff"},{name:"C",semi:12,key:"K",color:"#91c8ff"}
];
function setupAudio(){
 if(audioCtx)return;
 audioCtx=new (window.AudioContext||window.webkitAudioContext)();
 master=audioCtx.createGain(); master.gain.value=.8; master.connect(audioCtx.destination);
 convolver=audioCtx.createConvolver();
 const rate=audioCtx.sampleRate, len=rate*1.1, impulse=audioCtx.createBuffer(2,len,rate);
 for(let c=0;c<2;c++){const d=impulse.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.3)}
 convolver.buffer=impulse; convolver.connect(master);
}
function freq(semi){return 261.625565*Math.pow(2,(Number($("#octave").value)-4)+semi/12)}
function play(n){
 setupAudio(); if(audioCtx.state==="suspended")audioCtx.resume();
 const now=audioCtx.currentTime, f=freq(n.semi), osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
 osc.type=$("#wave").value; osc.frequency.setValueAtTime(f,now);
 gain.gain.setValueAtTime(0,now); gain.gain.linearRampToValueAtTime(Number($("#volume").value)/100*.34,now+.008);
 gain.gain.exponentialRampToValueAtTime(.001,now+.72); osc.connect(gain); gain.connect(master);
 if(reverbOn){const rg=audioCtx.createGain();rg.gain.value=.18;gain.connect(rg);rg.connect(convolver)}
 osc.start(now);osc.stop(now+.75);
 const el=document.querySelector(`[data-name="${n.name}"]`);el.classList.add("playing");setTimeout(()=>el.classList.remove("playing"),90);
 $("#nowNote").textContent=n.name;$("#nowFreq").textContent=`${Math.round(f)} Hz`;
 if(recording) sequence.push({note:n.name,semi:n.semi,at:Date.now()-lastTime});
}
function render(){
 $("#keys").innerHTML=notes.map(n=>`<button class="key" data-name="${n.name}" style="background:${n.color}" aria-label="Nada ${n.name}"><span>${n.name}</span><small>${n.key}</small></button>`).join("");
 document.querySelectorAll(".key").forEach((el,i)=>{el.addEventListener("pointerdown",e=>{e.preventDefault();play(notes[i])})});
 $("#scaleName").textContent=`C Major • Octave ${$("#octave").value}`;
}
render();
$("#volume").oninput=e=>$("#volumeValue").textContent=e.target.value+"%";
$("#octave").oninput=()=>{$("#octaveValue").textContent=$("#octave").value;render()};
$("#wave").onchange=()=>{};
$("#reverbBtn").onclick=()=>{reverbOn=!reverbOn;$("#reverbBtn").classList.toggle("active",reverbOn)};
$("#recordBtn").onclick=()=>{
 recording=!recording;
 if(recording){sequence=[];lastTime=Date.now();$("#recordBtn").textContent="■ Stop";$("#recordBtn").classList.add("recording")}
 else{$("#recordBtn").textContent="● Record";$("#recordBtn").classList.remove("recording");}
};
$("#clearBtn").onclick=()=>{sequence=[];$("#nowNote").textContent="—";$("#nowFreq").textContent="Ready"};
$("#themeBtn").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("silver-xylophone-theme",document.body.classList.contains("dark")?"dark":"light");$("#themeBtn").textContent=document.body.classList.contains("dark")?"☀":"☾"};
if(localStorage.getItem("silver-xylophone-theme")==="dark"){document.body.classList.add("dark");$("#themeBtn").textContent="☀"}
const dialog=$("#helpDialog");$("#helpBtn").onclick=()=>dialog.showModal();$("#closeHelp").onclick=()=>dialog.close();$("#closeHelp2").onclick=()=>dialog.close();
document.addEventListener("keydown",e=>{if(e.repeat)return;const n=notes.find(x=>x.key.toLowerCase()===e.key.toLowerCase());if(n)play(n)});
