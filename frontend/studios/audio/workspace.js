(() => {
  const $ = id => document.getElementById(id);
  const fileInput = $('audioFile');
  const fileName = $('fileName');
  const fileMeta = $('fileMeta');
  const processBtn = $('processBtn');
  const status = $('status');
  const result = $('result');
  const resultAudio = $('resultAudio');
  let file = null, audioBuffer = null, recorder = null, chunks = [];

  const setFile = async f => {
    if (!f) return;
    file = f; fileName.textContent = f.name; fileMeta.textContent = `${(f.size/1024/1024).toFixed(2)} MB · ${f.type || 'audio file'}`;
    try { audioBuffer = await decode(f); $('wave').style.display='block'; drawWave(audioBuffer); processBtn.disabled=false; status.textContent='Ready to process.'; }
    catch { audioBuffer=null; processBtn.disabled=false; status.textContent='File loaded. Browser preview is ready; processing support depends on the format.'; }
  };
  const decode = f => f.arrayBuffer().then(b => new AudioContext().decodeAudioData(b));
  $('chooseBtn')?.addEventListener('click',()=>fileInput.click());
  fileInput?.addEventListener('change',e=>setFile(e.target.files[0]));
  const drop=$('drop'); ['dragenter','dragover'].forEach(e=>drop?.addEventListener(e,x=>{x.preventDefault();drop.classList.add('drag')})); ['dragleave','drop'].forEach(e=>drop?.addEventListener(e,x=>{x.preventDefault();drop.classList.remove('drag')})); drop?.addEventListener('drop',e=>setFile(e.dataTransfer.files[0]));
  $('resetBtn')?.addEventListener('click',()=>{file=null;audioBuffer=null;fileInput.value='';fileName.textContent='No file selected';fileMeta.textContent='';processBtn.disabled=true;result.classList.remove('show');$('wave').style.display='none';status.textContent='Choose an audio file to begin.'});
  $('recordBtn')?.addEventListener('click', async()=>{ if(recorder?.state==='recording'){recorder.stop();$('recordBtn').textContent='Record from microphone';return} try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];recorder=new MediaRecorder(stream);recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());setFile(new File(chunks,'nexauren-recording.webm',{type:'audio/webm'}));};recorder.start();$('recordBtn').textContent='Stop recording';status.textContent='Recording…';}catch{status.textContent='Microphone access was not available.'}});
  const drawWave=b=>{const c=$('waveCanvas');if(!c)return;const ctx=c.getContext('2d');c.width=c.clientWidth*2;c.height=c.clientHeight*2;ctx.clearRect(0,0,c.width,c.height);const d=b.getChannelData(0), step=Math.ceil(d.length/c.width);ctx.strokeStyle='#7657ff';ctx.lineWidth=2;ctx.beginPath();for(let x=0;x<c.width;x++){let min=1,max=-1;for(let j=0;j<step;j++){const v=d[x*step+j]||0;min=Math.min(min,v);max=Math.max(max,v)}ctx.moveTo(x,c.height/2+min*c.height*.38);ctx.lineTo(x,c.height/2+max*c.height*.38)}ctx.stroke()};
  const wavBlob=(buffer,start=0,end=buffer.duration)=>{const rate=buffer.sampleRate,from=Math.floor(start*rate),to=Math.floor(end*rate),len=to-from,ch=buffer.numberOfChannels,buf=new ArrayBuffer(44+len*ch*2),v=new DataView(buf);const w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};w(0,'RIFF');v.setUint32(4,36+len*ch*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,ch,true);v.setUint32(24,rate,true);v.setUint32(28,rate*ch*2,true);v.setUint16(32,ch*2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,len*ch*2,true);let p=44;for(let i=0;i<len;i++)for(let c=0;c<ch;c++){let x=Math.max(-1,Math.min(1,buffer.getChannelData(c)[from+i]));v.setInt16(p,x<0?x*32768:x*32767,true);p+=2}return new Blob([buf],{type:'audio/wav'})};
  processBtn?.addEventListener('click',async()=>{if(!audioBuffer){status.textContent='Please choose an audio file first.';return}const processing=$('processing');processing.classList.add('show');processBtn.disabled=true;await new Promise(r=>setTimeout(r,2400));let blob=wavBlob(audioBuffer,0,audioBuffer.duration);if(window.NexaurenAudioTransform)blob=await window.NexaurenAudioTransform(audioBuffer);const url=URL.createObjectURL(blob);resultAudio.src=url;$('downloadBtn').onclick=()=>{const a=document.createElement('a');a.href=url;a.download='nexauren-audio.wav';a.click()};result.classList.add('show');processing.classList.remove('show');processBtn.disabled=false;status.textContent='Processing complete.'});
  window.NexaurenAudioWorkspace={getBuffer:()=>audioBuffer,wavBlob};
})();
