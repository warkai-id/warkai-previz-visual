import { DirectionalLight } from 'three';

const presetKeyColor = {golden:'#ffe0ab', overcast:'#f4f8ff', night:'#bacfff', studio:'#ffffff'};

export function defaultLightRig(light) {
  const az = light.azimuth * Math.PI/180, el = light.elevation * Math.PI/180;
  return {
    key:{
      position:[18*Math.cos(el)*Math.sin(az), 18*Math.sin(el), 18*Math.cos(el)*Math.cos(az)],
      target:[0,0,0], color:presetKeyColor[light.preset], intensity:light.intensity, shadows:true,
    },
    fill:{position:[-4,3,5], target:[0,1,0], color:'#ffffff', intensity:0},
  };
}

export function validateLightRig(rig) {
  const fail = field => {throw new Error('Rig cahaya tidak valid. Periksa ' + field + '.');};
  const vector = v => Array.isArray(v) && v.length === 3 && v.every(x => Number.isFinite(x) && Math.abs(x) <= 10000);
  for (const role of ['key','fill']) {
    const source = rig?.[role];
    if (!source || typeof source.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(source.color)) fail('warna ' + role);
    if (!Number.isFinite(source.intensity) || source.intensity < 0 || source.intensity > 12) fail('intensitas ' + role);
    if (!vector(source.position) || !vector(source.target)) fail('posisi dan sasaran ' + role);
    if (Math.hypot(...source.position.map((v,i) => v-source.target[i])) < 0.01) fail('jarak antara ' + role + ' dan sasarannya');
  }
  if (typeof rig.key.shadows !== 'boolean') fail('pilihan bayangan key');
  return rig;
}

// Call after the legacy scene preset has restored its key color, intensity and spherical position.
export function applyLightRig(engine, light) {
  const {key, scene} = engine;
  const enabled = light.mode !== 'local' && light.mode !== 'black';
  if (!light.rig || !enabled) {
    if (engine.fill) {
      engine.fill.visible = false;
      engine.fill.intensity = 0;
    }
    key.target.position.set(0,0,0);
    key.castShadow = enabled;
    return;
  }
  if (!engine.fill) {
    engine.fill = new DirectionalLight('#ffffff',0);
    engine.fill.name = 'Fill';
    scene.add(engine.fill, engine.fill.target);
  }
  if (!key.target.parent) scene.add(key.target);
  key.castShadow = light.rig.key.shadows;
  engine.fill.visible = light.rig.fill.intensity > 0;
  for (const role of ['key','fill']) {
    const source = light.rig[role], lamp = engine[role];
    lamp.color.set(source.color);
    lamp.intensity = source.intensity;
    lamp.position.fromArray(source.position);
    lamp.target.position.fromArray(source.target);
  }
}

export function describeLightRig(light) {
  if (!light.rig || light.mode === 'black' || light.mode === 'local') return '';
  return ['key','fill'].map(role => {
    const s = light.rig[role];
    const vector = v => '(' + v.map(n => Number(n.toFixed(2))).join(', ') + ')';
    const shadow = role === 'key' && s.shadows ? 'casts a shadow' : 'no cast shadow';
    return role + ' directional light from ' + vector(s.position) + ' m toward ' + vector(s.target)
      + ' m, ' + s.color + ', renderer intensity ' + s.intensity + ', ' + shadow + '.';
  }).join(' ');
}

export function lightRigInspector(light, {field,vectorFields}) {
  if (light.mode === 'local' || light.mode === 'black') return '';
  if (!light.rig) return '<button class="button subtle full" data-action="add-light-rig">Atur lampu utama dan pengisi</button>';
  const sections = [['key','Lampu utama'],['fill','Lampu pengisi']].map(([role,title]) => {
    const source = light.rig[role], path = 'rig.' + role;
    const opts = {scope:'shotLight'};
    return '<div class="inspector-section"><h3>'+title+'</h3><div class="field-row">'
      + field('Warna ' + title.toLowerCase(),path+'.color',source.color,{...opts,type:'color'})
      + field('Intensitas ' + title.toLowerCase(),path+'.intensity',source.intensity,{...opts,min:0,max:12})
      + '</div>' + vectorFields('Posisi ' + title.toLowerCase(),path+'.position',source.position,'shotLight')
      + vectorFields('Arahkan ke',path+'.target',source.target,'shotLight')
      + (role === 'key' ? '<label><input data-scope="shotLight" data-field="rig.key.shadows" type="checkbox" '
        + (source.shadows ? 'checked' : '') + '> Tampilkan bayangan lampu utama</label>' : '')
      + '</div>';
  });
  return sections.join('') + '<p class="field-note">Intensitas 0 mematikan sumber. Bayangan lampu utama memakai shadow map.</p>'
    + '<button class="text-button" data-action="remove-light-rig">Kembali ke arah lampu preset</button>';
}
