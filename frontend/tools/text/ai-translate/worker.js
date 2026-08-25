import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
env.allowLocalModels = false;
const LANG={Portuguese:'por_Latn',English:'eng_Latn',Spanish:'spa_Latn',French:'fra_Latn',German:'deu_Latn',Italian:'ita_Latn',Dutch:'nld_Latn',Russian:'rus_Cyrl',Ukrainian:'ukr_Cyrl',Arabic:'arb_Arab',Hindi:'hin_Deva',Bengali:'ben_Beng',Chinese:'zho_Hans',Japanese:'jpn_Jpan',Korean:'kor_Hang',Turkish:'tur_Latn',Polish:'pol_Latn',Swedish:'swe_Latn',Greek:'ell_Grek',Indonesian:'ind_Latn'};
let translator=null;
async function load(){
  if(translator)return;
  const progress_callback=p=>self.postMessage({type:'progress',progress:p?.progress??0,status:p?.status??'Loading AI model…'});
  try{translator=await pipeline('translation','Xenova/nllb-200-distilled-600M',{dtype:'q4',device:'webgpu',progress_callback});self.postMessage({type:'ready',device:'webgpu'});}
  catch(e){console.warn('WebGPU unavailable, falling back to WASM',e);translator=await pipeline('translation','Xenova/nllb-200-distilled-600M',{dtype:'q4',device:'wasm',progress_callback});self.postMessage({type:'ready',device:'wasm'});}
}
self.onmessage=async e=>{const m=e.data||{};try{if(m.type==='load'){await load();return}if(m.type==='translate'){await load();const result=await translator(m.text,{src_lang:LANG[m.from],tgt_lang:LANG[m.to],max_new_tokens:256});self.postMessage({type:'result',text:result?.[0]?.translation_text||''});}}catch(err){self.postMessage({type:'error',message:err?.message||'AI model error'});}};