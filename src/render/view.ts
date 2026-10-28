// Camada 3D: lê o estado do WumpusWorld e desenha a caverna com Three.js.
import * as THREE from 'three';
import { DIR_VEC, type Cell, type WumpusWorld } from '../game/world';
import type { CellBelief } from '../agents/knowledge';

const TILE = 2; // tamanho de cada sala em unidades 3D

// Converte coordenada do grid (x, y) para posição 3D (o norte aponta para -z)
const toWorld = (x: number, y: number) => new THREE.Vector3(x * TILE, 0, -y * TILE);
// Ângulo (yaw) do agente para cada direção: leste, norte, oeste, sul
const DIR_YAW = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

export type CameraMode = 'follow' | 'overview';

export class WorldView {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  private clock = new THREE.Clock();

  private world!: WumpusWorld;
  private level = new THREE.Group();
  private tiles: THREE.Mesh[][] = [];
  private pits = new Map<string, THREE.Object3D>();
  private wumpus!: THREE.Group;
  private gold!: THREE.Group;
  private agent!: THREE.Group;
  private torch!: THREE.PointLight;
  private breeze!: THREE.Points;
  private stench!: THREE.Points;
  private beliefGroup = new THREE.Group();
  private arrow: { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; duration: number } | null = null;

  private agentYaw = 0;
  private camTarget = new THREE.Vector3();
  cameraMode: CameraMode = 'follow';
  revealAll = false;

  private matTileHidden = new THREE.MeshStandardMaterial({ color: 0x1a1714, roughness: 1 });
  private matTileVisited = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 });

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x07060a);
    this.scene.fog = new THREE.Fog(0x07060a, 8, 26);
    this.scene.add(new THREE.HemisphereLight(0x8a8aaa, 0x2a1d10, 0.7));
    this.scene.add(this.level);

    window.addEventListener('resize', () => this.resize(container));
    this.resize(container);
  }

  private resize(container: HTMLElement) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Reconstrói toda a cena para um novo mundo. */
  load(world: WumpusWorld) {
    this.world = world;
    this.level.clear();
    this.tiles = [];
    this.pits.clear();
    this.arrow = null;
    const n = world.size;

    // Piso: uma laje por sala
    const tileGeo = new THREE.BoxGeometry(TILE * 0.96, 0.2, TILE * 0.96);
    for (let x = 0; x < n; x++) {
      this.tiles[x] = [];
      for (let y = 0; y < n; y++) {
        const tile = new THREE.Mesh(tileGeo, this.matTileHidden);
        tile.position.copy(toWorld(x, y)).setY(-0.1);
        this.level.add(tile);
        this.tiles[x][y] = tile;
      }
    }

    // Entrada: um anel azul na sala (1,1)
    const entrance = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.7, 32),
      new THREE.MeshBasicMaterial({ color: 0x4fa3ff, side: THREE.DoubleSide }),
    );
    entrance.rotation.x = -Math.PI / 2;
    entrance.position.copy(toWorld(0, 0)).setY(0.02);
    this.level.add(entrance);

    // Paredes ao redor do mapa
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 1 });
    const span = n * TILE;
    const wallH = 0.7;
    const walls: [number, number, number, number][] = [
      // [centro x, centro z, largura, profundidade]
      [(span - TILE) / 2, TILE / 2 + 0.15, span + 0.6, 0.3], // sul
      [(span - TILE) / 2, -span + TILE / 2 - 0.15, span + 0.6, 0.3], // norte
      [-TILE / 2 - 0.15, -(span - TILE) / 2, 0.3, span], // oeste
      [span - TILE / 2 + 0.15, -(span - TILE) / 2, 0.3, span], // leste
    ];
    for (const [cx, cz, w, d] of walls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
      wall.position.set(cx, wallH / 2 - 0.2, cz);
      this.level.add(wall);
    }

    // Poços: buraco escuro com borda de pedra
    for (const k of world.pits) {
      const [x, y] = k.split(',').map(Number);
      const pit = new THREE.Group();
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(0.7, 32),
        new THREE.MeshBasicMaterial({ color: 0x000000 }),
      );
      hole.rotation.x = -Math.PI / 2;
      hole.position.y = 0.01;
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.08, 8, 32),
        new THREE.MeshStandardMaterial({ color: 0x3a3330 }),
      );
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = 0.04;
      pit.add(hole, rim);
      pit.position.copy(toWorld(x, y));
      this.level.add(pit);
      this.pits.set(k, pit);
    }

    this.wumpus = this.makeWumpus();
    this.wumpus.position.copy(toWorld(world.wumpus.x, world.wumpus.y));
    this.level.add(this.wumpus);

    this.gold = this.makeGold();
    if (world.gold) this.gold.position.copy(toWorld(world.gold.x, world.gold.y));
    this.level.add(this.gold);

    this.agent = this.makeAgent();
    this.agent.position.copy(toWorld(world.agent.x, world.agent.y));
    this.agentYaw = DIR_YAW[world.agent.dir];
    this.agent.rotation.y = this.agentYaw;
    this.level.add(this.agent);

    this.breeze = this.makeParticles(0xbfe3ff, 60, 0.05);
    this.stench = this.makeParticles(0x6dff4a, 50, 0.09);
    this.agent.add(this.breeze, this.stench);

    this.level.add(this.beliefGroup);

    this.camTarget.copy(this.agent.position);
    this.placeCamera(1);
    this.sync();
  }

  /** Desenha sobre o piso o que o agente acredita sobre cada sala (null apaga). */
  showBeliefs(beliefs: Map<string, CellBelief> | null) {
    for (const obj of this.beliefGroup.children) {
      if (obj instanceof THREE.Sprite) obj.material.map?.dispose();
    }
    this.beliefGroup.clear();
    if (!beliefs) return;

    const discGeo = new THREE.CircleGeometry(0.75, 32);
    for (const [k, b] of beliefs) {
      const [x, y] = k.split(',').map(Number);
      const risk = 1 - (1 - b.pit) * (1 - b.wumpus);
      const color = new THREE.Color(0x3ddc84).lerp(new THREE.Color(0xffc93d), Math.min(risk * 2, 1));
      if (risk > 0.5) color.lerp(new THREE.Color(0xff3d3d), (risk - 0.5) * 2);
      const disc = new THREE.Mesh(
        discGeo,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.copy(toWorld(x, y)).setY(0.03);

      const lines: string[] = [];
      if (b.pit > 0) lines.push(`Poço ${Math.round(b.pit * 100)}%`);
      if (b.wumpus > 0) lines.push(`Wumpus ${Math.round(b.wumpus * 100)}%`);
      if (!lines.length) lines.push('Segura');
      const label = this.makeLabel(lines, color);
      label.position.copy(toWorld(x, y)).setY(0.5);
      this.beliefGroup.add(disc, label);
    }
  }

  private makeLabel(lines: string[], color: THREE.Color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.fillStyle = `#${color.getHexString()}`;
    lines.forEach((line, i) => {
      const y = 64 + (i - (lines.length - 1) / 2) * 46;
      ctx.strokeText(line, 128, y);
      ctx.fillText(line, 128, y);
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
    sprite.scale.set(2, 1, 1);
    sprite.renderOrder = 10;
    return sprite;
  }

  private makeAgent() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.5, 6, 16),
      new THREE.MeshStandardMaterial({ color: 0x3d7bd9, roughness: 0.5 }),
    );
    body.position.y = 0.55;
    // "Nariz" indica para onde o agente está olhando (-z local)
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.35, 12),
      new THREE.MeshStandardMaterial({ color: 0xffd27a }),
    );
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0.7, -0.35);
    // Tocha: a principal fonte de luz da caverna
    this.torch = new THREE.PointLight(0xffa64d, 30, 7, 1.6);
    this.torch.position.set(0.35, 1.7, 0.2);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.07), new THREE.MeshBasicMaterial({ color: 0xffc070 }));
    flame.position.copy(this.torch.position);
    g.add(body, nose, this.torch, flame);
    return g;
  }

  private makeWumpus() {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0x6b1f1f, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 16), skin);
    body.scale.set(1, 0.85, 1);
    body.position.y = 0.6;
    g.add(body);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09), new THREE.MeshBasicMaterial({ color: 0xffee33 }));
      eye.position.set(side * 0.22, 0.78, 0.5);
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0xe8dcc0 }),
      );
      horn.position.set(side * 0.35, 1.15, 0);
      horn.rotation.z = -side * 0.4;
      g.add(eye, horn);
    }
    g.userData.skin = skin;
    return g;
  }

  private makeGold() {
    const g = new THREE.Group();
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32),
      new THREE.MeshStandardMaterial({ color: 0xffcc33, metalness: 1, roughness: 0.2, emissive: 0xaa7700 }),
    );
    gem.position.y = 0.6;
    const light = new THREE.PointLight(0xffcc33, 6, 3);
    light.position.y = 0.8;
    g.add(gem, light);
    g.userData.gem = gem;
    return g;
  }

  private makeParticles(color: number, count: number, size: number) {
    const positions = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    points.userData.seeds = Array.from({ length: count }, () => [Math.random(), Math.random(), Math.random()]);
    points.visible = false;
    return points;
  }

  /** Atualiza visibilidade e materiais a partir do estado atual do mundo. */
  sync() {
    const w = this.world;
    const showAll = this.revealAll || w.gameOver;

    for (let x = 0; x < w.size; x++) {
      for (let y = 0; y < w.size; y++) {
        this.tiles[x][y].material = w.isVisited(x, y) || showAll ? this.matTileVisited : this.matTileHidden;
      }
    }
    for (const [k, pit] of this.pits) {
      const [x, y] = k.split(',').map(Number);
      pit.visible = showAll || w.isVisited(x, y);
    }

    const wc = w.wumpus;
    this.wumpus.visible = showAll || !w.wumpusAlive || w.isVisited(wc.x, wc.y);
    const skin = this.wumpus.userData.skin as THREE.MeshStandardMaterial;
    skin.color.set(w.wumpusAlive ? 0x6b1f1f : 0x3a3a3a);
    this.wumpus.rotation.z = w.wumpusAlive ? 0 : Math.PI / 2;
    this.wumpus.position.y = w.wumpusAlive ? 0 : 0.35;

    this.gold.visible = !!w.gold && (showAll || w.percepts.glitter || w.isVisited(w.gold.x, w.gold.y));
    if (w.hasGold) {
      // O ouro passa a flutuar acima do agente
      this.gold.visible = true;
      if (this.gold.parent !== this.agent) {
        this.agent.add(this.gold);
        this.gold.position.set(0, 0.9, 0);
        this.gold.scale.setScalar(0.6);
      }
    }

    this.breeze.visible = w.percepts.breeze && !w.gameOver;
    this.stench.visible = w.percepts.stench && w.wumpusAlive && !w.gameOver;
    this.agent.visible = w.status !== 'dead-pit';
  }

  /** Dispara a animação da flecha entre duas salas. */
  shootArrow(from: Cell, to: Cell) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff1c0 }),
    );
    const [dx, dy] = DIR_VEC[this.world.agent.dir];
    // Orienta o cilindro (eixo Y) na direção do disparo
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, 0, -dy));
    const a = toWorld(from.x, from.y).setY(0.7);
    const b = toWorld(to.x, to.y).setY(0.7);
    if (from.x === to.x && from.y === to.y) b.add(new THREE.Vector3(dx, 0, -dy).multiplyScalar(TILE * 0.45));
    mesh.position.copy(a);
    this.level.add(mesh);
    this.arrow = { mesh, from: a, to: b, t: 0, duration: Math.max(0.15, a.distanceTo(b) / 14) };
  }

  private placeCamera(lerp: number) {
    const n = this.world.size;
    let pos: THREE.Vector3;
    let look: THREE.Vector3;
    const fog = this.scene.fog as THREE.Fog;
    fog.far = this.cameraMode === 'overview' ? 30 + n * TILE * 2 : 26;
    if (this.cameraMode === 'overview') {
      const c = toWorld((n - 1) / 2, (n - 1) / 2);
      look = c;
      pos = c.clone().add(new THREE.Vector3(0, n * 2.6, n * 1.6));
    } else {
      look = this.camTarget;
      pos = this.camTarget.clone().add(new THREE.Vector3(0, 7, 4));
    }
    this.camera.position.lerp(pos, lerp);
    this.camera.lookAt(look);
  }

  private animateParticles(points: THREE.Points, time: number, rising: boolean) {
    if (!points.visible) return;
    const pos = points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const seeds = points.userData.seeds as number[][];
    seeds.forEach(([a, b, c], i) => {
      if (rising) {
        // Fedor: névoa verde que sobe devagar
        const t = (time * 0.25 + a) % 1;
        const r = 0.4 + b * 0.5;
        pos.setXYZ(i, Math.cos(c * 6.28 + t) * r, t * 1.6, Math.sin(c * 6.28 + t) * r);
      } else {
        // Brisa: partículas girando rápido em volta do agente
        const ang = time * (1.5 + b) + a * 6.28;
        const r = 0.6 + c * 0.4;
        pos.setXYZ(i, Math.cos(ang) * r, 0.2 + b * 1.2, Math.sin(ang) * r);
      }
    });
    pos.needsUpdate = true;
  }

  /** Chamado a cada frame. */
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.elapsedTime;
    const w = this.world;

    // Movimento suave do agente até a sala atual
    const target = toWorld(w.agent.x, w.agent.y);
    this.agent.position.lerp(target, 1 - Math.exp(-dt * 12));
    let goal = DIR_YAW[w.agent.dir];
    while (goal - this.agentYaw > Math.PI) goal -= Math.PI * 2;
    while (goal - this.agentYaw < -Math.PI) goal += Math.PI * 2;
    this.agentYaw += (goal - this.agentYaw) * (1 - Math.exp(-dt * 14));
    this.agent.rotation.y = this.agentYaw;

    // Tocha tremulando
    this.torch.intensity = 28 + Math.sin(time * 13) * 2 + Math.sin(time * 7.3) * 2;

    const gem = this.gold.userData.gem as THREE.Mesh;
    gem.rotation.y += dt * 2;
    gem.position.y = 0.6 + Math.sin(time * 2) * 0.08;

    if (w.wumpusAlive) this.wumpus.rotation.y = Math.sin(time * 0.8) * 0.4;

    this.animateParticles(this.breeze, time, false);
    this.animateParticles(this.stench, time, true);

    if (this.arrow) {
      const a = this.arrow;
      a.t += dt / a.duration;
      a.mesh.position.lerpVectors(a.from, a.to, Math.min(a.t, 1));
      if (a.t >= 1.3) {
        this.level.remove(a.mesh);
        this.arrow = null;
      }
    }

    this.camTarget.lerp(this.agent.position, 1 - Math.exp(-dt * 6));
    this.placeCamera(1 - Math.exp(-dt * 4));
    this.renderer.render(this.scene, this.camera);
  }
}
