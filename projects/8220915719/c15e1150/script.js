/* ===============================
   CINEMATIC INTRO: ROCK + SHATTER
   =============================== */
(() => {
  const stage = document.getElementById('stage');
  const app = document.getElementById('app');
  const titleEl = document.getElementById('introTitle');
  const glitchEl = document.getElementById('glitch');
  const fallback = document.getElementById('fallback');

  let renderer, scene, camera, rock, clock, sparks, shards = [], exploded = false, raf;
  const W = () => stage.clientWidth;
  const H = () => stage.clientHeight;

  function webglOk(){
    try{
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    }catch(e){return false}
  }

  if(!webglOk()){
    fallback.classList.remove('hidden');
    titleEl.style.display = 'none';
    return;
  }

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.setClearColor(0x000000, 1);
  stage.appendChild(renderer.domElement);

  // Scene & Camera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, W()/H(), 0.1, 200);
  camera.position.set(0, 0.4, 4.8);

  // Lights (volumetric-ish)
  const ambient = new THREE.AmbientLight(0x6677aa, 0.9);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xb26bff, 1.3);
  dir.position.set(3, 4, 2);
  scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0x44d2ff, 1.2);
  dir2.position.set(-3, -2, -1);
  scene.add(dir2);

  // Rock geometry (distorted icosahedron)
  const baseGeo = new THREE.IcosahedronGeometry(1.2, 4);
  const pos = baseGeo.attributes.position;
  // noise/roughness
  for(let i=0;i<pos.count;i++){
    const nx = (Math.sin(i*12.9898)*43758.5453)%1;
    const ny = (Math.sin((i+7)*78.233)*1337.1337)%1;
    const nz = (Math.sin((i+13)*0.333)*9182.2)%1;
    const n = ( (nx+ny+nz)/3 - 0.5 ) * 0.35;
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).normalize().multiplyScalar(n);
    pos.setXYZ(i, pos.getX(i)+v.x, pos.getY(i)+v.y, pos.getZ(i)+v.z);
  }
  pos.needsUpdate = true;
  baseGeo.computeVertexNormals();

  // Material with subtle crystal sheen
  const rockMat = new THREE.MeshStandardMaterial({
    color:0x1a2038,
    roughness:0.45,
    metalness:0.35,
    emissive: new THREE.Color(0x0a1533),
    emissiveIntensity: 0.6
  });
  rock = new THREE.Mesh(baseGeo, rockMat);
  rock.castShadow = false; rock.receiveShadow = false;
  scene.add(rock);

  // Particles (glowing dust)
  const pCount = 900;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount*3);
  for(let i=0;i<pCount;i++){
    const r = 0.2 + Math.random()*0.6;
    const theta = Math.random()*Math.PI*2;
    const phi = Math.acos(2*Math.random()-1);
    pPos[i*3+0] = r*Math.sin(phi)*Math.cos(theta);
    pPos[i*3+1] = r*Math.sin(phi)*Math.sin(theta);
    pPos[i*3+2] = r*Math.cos(phi);
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color:0x6ee7ff, size:0.01, sizeAttenuation:true, transparent:true, opacity:0.9 });
  sparks = new THREE.Points(pGeo, pMat);
  scene.add(sparks);

  // Shards container
  const shardGroup = new THREE.Group();
  scene.add(shardGroup);

  // Timing
  clock = new THREE.Clock();

  // Subtle camera move
  let t = 0;

  // Audio: synth bass on explosion
  let audioCtx, explodedOnce=false;
  function bass(){
    try{
      if(explodedOnce) return;
      explodedOnce=true;
      const ctx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
      audioCtx = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(50, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime+0.35);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime+0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime+0.6);
    }catch(e){}
  }

  // Shatter into triangle shards
  function shatter(){
    if(exploded) return;
    exploded = true;
    bass();

    // create shards per face
    const pos = rock.geometry.attributes.position;
    const index = rock.geometry.index ? rock.geometry.index.array : null;
    const tris = [];
    if(index){
      for(let i=0;i<index.length; i+=3){
        tris.push([
          new THREE.Vector3().fromBufferAttribute(pos, index[i]),
          new THREE.Vector3().fromBufferAttribute(pos, index[i+1]),
          new THREE.Vector3().fromBufferAttribute(pos, index[i+2]),
        ]);
      }
    } else {
      for(let i=0;i<pos.count; i+=3){
        tris.push([
          new THREE.Vector3().fromBufferAttribute(pos, i),
          new THREE.Vector3().fromBufferAttribute(pos, i+1),
          new THREE.Vector3().fromBufferAttribute(pos, i+2),
        ]);
      }
    }

    // remove original rock
    rock.visible = false;

    // build shard meshes
    const shardMat = new THREE.MeshStandardMaterial({
      color:0x1f2a4d,
      roughness:0.5,
      metalness:0.4,
      emissive: new THREE.Color(0x0b1938),
      emissiveIntensity: 0.9
    });

    const center = new THREE.Vector3();
    for(const tri of tris){
      const g = new THREE.BufferGeometry();
      const p = new Float32Array(9);
      for(let j=0;j<3;j++){
        p[j*3+0] = tri[j].x;
        p[j*3+1] = tri[j].y;
        p[j*3+2] = tri[j].z;
      }
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      g.computeVertexNormals();

      center.copy(tri[0]).add(tri[1]).add(tri[2]).divideScalar(3);
      const m = new THREE.Mesh(g, shardMat.clone());
      m.position.copy(center);

      // velocity away from origin
      const vel = center.clone().normalize().multiplyScalar(0.8 + Math.random()*1.2);
      vel.y += 0.3; // slight upward
      m.userData = {
        vel,
        rot: new THREE.Vector3((Math.random()-0.5)*8, (Math.random()-0.5)*8, (Math.random()-0.5)*8),
        life: 2.5 + Math.random()*1.5
      };
      shards.push(m);
      shardGroup.add(m);
    }

    // Glitch sweep + title reveal
    titleEl.style.opacity = '1';
    titleEl.style.transform = 'translateY(0)';
    titleEl.style.transition = 'opacity 1.2s ease, transform 1.2s ease';

    glitchEl.style.opacity = '1';
    glitchEl.style.transform = 'translateX(120%)';
    glitchEl.style.transition = 'transform 0.8s ease-out, opacity 0.8s ease-out';

    // Transition to main app after delay
    setTimeout(()=>{
      stage.style.opacity = '0';
      stage.style.transition = 'opacity 1.2s ease';
      setTimeout(()=>{
        stage.style.display = 'none';
        app.style.display = 'block';
        app.style.opacity = '0';
        setTimeout(()=>{
          app.style.opacity = '1';
          app.style.transition = 'opacity 1s ease';
          startTyping();
        }, 50);
      }, 1200);
    }, 2800);
  }

  // Animation loop
  function animate(){
    const dt = clock.getDelta();
    t += dt;

    // rock rotation + subtle camera sway
    rock.rotation.y += 0.4*dt;
    rock.rotation.x += 0.15*dt;
    camera.position.x = Math.sin(t*0.4)*0.18;
    camera.position.y = 0.35 + Math.sin(t*0.6)*0.03;
    camera.lookAt(0,0,0);

    // breathing emissive
    const s = 0.5+Math.sin(t*2.0)*0.5;
    if(rock.material) rock.material.emissiveIntensity = 0.45 + s*0.2;

    // shards motion & fade
    if(exploded){
      for(const m of shards){
        if(m.userData.life>0){
          m.position.addScaledVector(m.userData.vel, dt*0.9);
          m.rotation.x += m.userData.rot.x*dt;
          m.rotation.y += m.userData.rot.y*dt;
          m.rotation.z += m.userData.rot.z*dt;
          m.userData.life -= dt;
          const k = Math.max(m.userData.life, 0);
          m.material.opacity = Math.min(1, 1.2*k);
          m.material.transparent = true;
          m.material.needsUpdate = true;
        } else {
          m.visible = false;
        }
      }
      // particle fade
      sparks.material.opacity = Math.max(0, sparks.material.opacity - dt*0.4);
    }

    renderer.setSize(W(), H());
    camera.aspect = W()/H();
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  }
  animate();

  // Auto shatter after cinematic delay OR on click/tap
  let started = false;
  function start(){
    if(started) return;
    started = true;
    setTimeout(shatter, 1400); // brief suspense
  }
  // first user interaction will also trigger audio
  ['pointerdown','keydown'].forEach(ev => window.addEventListener(ev, start, {once:true}));
  // fallback auto-start (no interaction)
  setTimeout(start, 800);

  // Resize
  window.addEventListener('resize', ()=> {
    renderer.setSize(W(), H());
    camera.aspect = W()/H();
    camera.updateProjectionMatrix();
  });
})();

/* ===============================
   MAIN: Ripple follow for portals
   =============================== */
document.querySelectorAll('.portal').forEach(el=>{
  el.addEventListener('pointermove', (e)=>{
    const r = el.getBoundingClientRect();
    el.style.setProperty('--x', (e.clientX - r.left)+'px');
    el.style.setProperty('--y', (e.clientY - r.top)+'px');
  });
});

/* ===============================
   FOOTER: typing effect loop
   =============================== */
function startTyping(){
  const el = document.getElementById('typing');
  const lines = [
    'This is not just a website… this is my future identity.',
    'بوابة رقمية… عالم واحد لكل اتصالاتي.',
    'Welcome to my digital world.'
  ];
  let iLine = 0, iChar = 0, deleting = false;

  function tick(){
    const full = lines[iLine];
    if(!deleting){
      iChar++;
      el.textContent = full.substring(0, iChar);
      if(iChar >= full.length){
        deleting = true;
        setTimeout(tick, 1400);
        return;
      }
    } else {
      iChar--;
      el.textContent = full.substring(0, iChar);
      if(iChar <= 0){
        deleting = false;
        iLine = (iLine+1) % lines.length;
      }
    }
    const speed = deleting ? 30 : 42;
    setTimeout(tick, speed + Math.random()*60);
  }
  tick();
}

