import {performanceFor,isCharacter} from './model.js';
import {blockingTrack} from './director.js';
import {aragiWarnings} from './aragi-plan.js';

export function motionInspector(project,shot,actor,{field,vectorFields,select}) {
  const camera=!actor, scope=camera?'shot':'track';
  const track=camera?shot.camera:blockingTrack(project,shot,actor);
  const duration=camera?shot.duration:performanceFor(project,shot).duration;
  const keys=(track?.keys || []).map((key,index)=>{
    const path=(camera?'camera.keys.':'keys.')+index;
    const control=(label,name,min,max,unit)=>field(label,path+'.'+name,key[name],{scope,min,max,unit});
    const frame=Math.round(key.at*duration*project.fps);
    const position=vectorFields('Posisi key '+(index+1),path+'.position',key.position,scope);
    const cameraFields=()=>vectorFields('Target key '+(index+1),path+'.target',key.target,scope)+
      control('Lensa','lens',12,200,'mm')+control('Fokus niat','focus',.1,1000,'m')+
      '<button class="button subtle" data-action="select-motion-key" data-index="'+index+'">Geser key di stage</button>'+
      '<button class="button subtle" data-action="use-key-view" data-index="'+index+'">Ambil posisi dan target dari diorama</button>';
    const actorFields=()=>field('Tahan posisi (frame)',path+'.holdFrames',key.holdFrames || 0,{scope,step:1,min:0})+
      control('Arah hadap','rotation',-360,360,'°')+control('Angguk','pitch',-360,360,'°')+
      select('Postur',path+'.pose',key.pose,['stand','sit','kneel','crouch','lie'],scope)+
      select('Aksi dari key ini',path+'.action',key.action,['hold','walk','run','jump','float'],scope);
    return `<fieldset><legend>Key ${index+1} · frame ${frame}</legend>
      ${position}${camera?cameraFields():actorFields()}${control('Roll','roll',-360,360,'°')}
      <button class="text-button" data-action="remove-motion-key" data-index="${index}">Hapus key ${index+1}</button></fieldset>`;
  });
  return `<section class="inspector-section"><h3>${camera?'Jalur kamera':'Jalur pemeran atau properti'}</h3>
    <p class="field-note">Geser playhead ke titik perubahan arah, lalu tambahkan key. ${!camera&&shot.takeId?'Frame dihitung dari awal take bersama.':''}</p>
    <button class="button subtle" data-action="add-motion-key">Tambah key di playhead</button>${keys.join('')}</section>`;
}

export function directionChecks(project,shot,{select,field,esc}) {
  const options=[['','Pilih jika diperlukan'],...project.actors.map(a=>[a.id,a.name])], expected=shot.composition || {};
  const plan=project.aragiPlan;
  const clips=plan?.clips.filter(c=>c.shotIds.includes(shot.sourceShotId)) || [];
  const notes=plan? `<section class="inspector-section"><h3>Arahan Aragi</h3><p>${esc(plan.requirements)}</p>
    ${clips.map(c=>`<p>${esc(c.id)} · ${c.durationSeconds} detik · ${esc(c.direction)}</p>`).join('')}
    ${aragiWarnings(project).map(m=>`<p class="field-note">${esc(m)}</p>`).join('')}</section>`:'';
  const cues=technicalCues(project,shot);
  const cueNotes=cues.length?'<section class="inspector-section"><h3>Perlu arahan Director</h3>'+cues.map(c=>'<p>'+esc(c)+'</p>').join('')+'</section>':'';
  return `${notes}${cueNotes}<section class="inspector-section"><h3>Ganti kamera dalam take</h3>
    <p class="field-note">Posisikan playhead di titik cut. Kedua shot memakai satu gerak pemain. Kamera kedua dapat diarahkan sendiri.</p>
    <button class="button subtle" data-action="cut-camera">Potong kamera di playhead</button></section>
    <section class="inspector-section"><h3>Periksa komposisi</h3>
    ${select('Objek foreground','foregroundId',expected.foregroundId || '',options,'composition')}
    ${select('Objek reveal','revealId',expected.revealId || '',options,'composition')}
    ${expected.revealId?field('Reveal mulai pada frame','revealFrame',expected.revealFrame ?? Math.round(shot.duration*project.fps)-1,{scope:'composition',step:1,min:0,max:Math.round(shot.duration*project.fps)-1}):''}
    <button class="button subtle" data-action="scan-composition">Periksa semua frame shot</button></section>`;
}

export function technicalCues(project,shot) {
  const cues=[], cast=project.actors.filter(isCharacter);
  const tracks=performanceFor(project,shot).blocking.filter(b=>cast.some(a=>a.id===b.actorId));
  if (/\b(mendekat\w*|menjauh\w*|berjalan|berlari|walks?|approaches|runs?)\b/i.test(shot.action) &&
      !tracks.some(b=>[...(b.keys || []).map(k=>k.position),b.end].some(pos=>pos.some((n,i)=>n!==b.start[i]))))
    cues.push('Aksi menyebut perpindahan pemain. Tentukan pemain, jalur dan posisi berhentinya di Blocking.');
  if (/\b(memegang|menggenggam|meraih|tersenyum|menangis|grips?|smiles?)\b/i.test(shot.action))
    cues.push('Periksa referensi akting untuk tangan atau wajah. Pill menunjukkan posisi, arah dan timing.');
  const durations=[...shot.action.matchAll(/\b(?:durasi(?: shot)?|shot duration)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(?:s\b|detik|seconds?)/gi)];
  if(durations.some(m=>Math.abs(Number(m[1].replace(',','.'))-shot.duration)>.5/project.fps))
    cues.push('Durasi shot yang tertulis di aksi berbeda dari timeline. Periksa durasi di Kamera.');
  return cues;
}
