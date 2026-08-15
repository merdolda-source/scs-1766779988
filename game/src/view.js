// Rendering. Every domino in the field is one instance of a single box mesh, so
// the whole board is a single draw call regardless of how many tiles are on it.

import * as THREE from 'three';
import { DOM_W, DOM_H, DOM_D, SPACING, STANDING, FALLEN } from './level.js';


const HALF_PI = Math.PI / 2;
const STANDING_COLOR = new THREE.Color('#3a4568');
const TRIGGER_COLOR = new THREE.Color('#ff4d6d');
const GHOST_COLOR = new THREE.Color('#5ee0c0');
const MAX_GHOSTS = 64;
const MAX_MARKERS = 128;

export class View {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#070a14');

    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 300);
    this.camera.position.set(0, 34, 18);
    this.camera.lookAt(0, 0, 0);

    // Kept close to 1.0 total so the fallen tiles show the picture's authored
    // colours rather than a washed-out version of them.
    this.scene.add(new THREE.HemisphereLight(0xaebfff, 0x0a0d18, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(-14, 26, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.key = key;
    this.scene.add(key);
    this.scene.add(key.target);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshLambertMaterial({ color: '#0d1120' })
    );
    ground.rotation.x = -HALF_PI;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.pad = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshLambertMaterial({ color: '#151b30' })
    );
    this.pad.rotation.x = -HALF_PI;
    this.pad.position.y = 0.004;
    this.pad.receiveShadow = true;
    this.scene.add(this.pad);

    this.geo = new THREE.BoxGeometry(DOM_W, DOM_H, DOM_D);
    this.mat = new THREE.MeshLambertMaterial();
    this.mesh = null;

    const ghostMat = new THREE.MeshBasicMaterial({
      color: GHOST_COLOR, transparent: true, opacity: 0.55,
    });
    this.ghosts = new THREE.InstancedMesh(this.geo, ghostMat, MAX_GHOSTS);
    this.ghosts.count = 0;
    this.ghosts.frustumCulled = false;
    this.scene.add(this.ghosts);

    // Flat plates on the floor showing exactly where the run is broken.
    this.markers = new THREE.InstancedMesh(
      new THREE.BoxGeometry(SPACING * 0.8, 0.02, DOM_W),
      new THREE.MeshBasicMaterial({ color: '#59f0d0', transparent: true, opacity: 0.30 }),
      MAX_MARKERS
    );
    this.markers.count = 0;
    this.markers.frustumCulled = false;
    this.scene.add(this.markers);

    this._m = new THREE.Matrix4();
    this._q = new THREE.Matrix4();
    this._c = new THREE.Color();
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._hit = new THREE.Vector3();
    this._ndc = new THREE.Vector2();
  }

  setField(field, capacity) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.dispose();
    }
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, capacity);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(capacity * 3), 3
    );
    this.scene.add(this.mesh);
    this.capacity = capacity;

    const b = field.bounds;
    this.pad.scale.set(b.maxX - b.minX + 2.2, b.maxZ - b.minZ + 2.2, 1);
    this.pad.position.x = (b.minX + b.maxX) / 2;
    this.pad.position.z = (b.minZ + b.maxZ) / 2;

    this.key.target.position.set(this.pad.position.x, 0, this.pad.position.z);
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.9;
    const sc = this.key.shadow.camera;
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span;
    sc.near = 1; sc.far = 90;
    sc.updateProjectionMatrix();

    this.fit(b);
  }

  fit(bounds) {
    const w = this.renderer.domElement.clientWidth || 1;
    const h = this.renderer.domElement.clientHeight || 1;
    const aspect = w / h;

    this.camera.updateMatrixWorld();
    const inv = this.camera.matrixWorldInverse;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const v = new THREE.Vector3();
    for (const x of [bounds.minX - 1.1, bounds.maxX + 1.1]) {
      for (const z of [bounds.minZ - 1.1, bounds.maxZ + 1.1]) {
        for (const y of [0, DOM_H]) {
          v.set(x, y, z).applyMatrix4(inv);
          minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
          minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
        }
      }
    }
    let halfW = (maxX - minX) / 2, halfH = (maxY - minY) / 2;
    const cx = (maxX + minX) / 2, cy = (maxY + minY) / 2;
    if (halfW / halfH > aspect) halfH = halfW / aspect;
    else halfW = halfH * aspect;

    this.camera.left = cx - halfW; this.camera.right = cx + halfW;
    this.camera.top = cy + halfH; this.camera.bottom = cy - halfH;
    this.camera.updateProjectionMatrix();
  }

  resize() {
    const el = this.renderer.domElement;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    if (this.bounds) this.fit(this.bounds);
  }

  // Compose the instance transform. The domino pivots on its bottom front edge
  // so it sweeps forward exactly like the real thing.
  _writeMatrix(i, x, z, fx, fz, theta) {
    const yaw = Math.atan2(fx, fz);
    const m = this._m, q = this._q;
    m.makeTranslation(x, 0.0009 * (i % 64), z);
    q.makeRotationY(yaw); m.multiply(q);
    q.makeTranslation(0, 0, DOM_D / 2); m.multiply(q);
    q.makeRotationX(theta); m.multiply(q);
    q.makeTranslation(0, DOM_H / 2, -DOM_D / 2); m.multiply(q);
    this.mesh.setMatrixAt(i, m);
  }

  syncAll(field, sim) {
    const n = field.count;
    const col = this.mesh.instanceColor.array;
    for (let i = 0; i < n; i++) {
      this._writeMatrix(i, field.px[i], field.pz[i], field.fx[i], field.fz[i], sim.theta[i]);
      this._writeColor(i, field, sim, col);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  syncMoving(field, sim) {
    const col = this.mesh.instanceColor.array;
    for (const list of [sim.active, sim.retired]) {
      for (let k = 0; k < list.length; k++) {
        const i = list[k];
        this._writeMatrix(i, field.px[i], field.pz[i], field.fx[i], field.fz[i], sim.theta[i]);
        this._writeColor(i, field, sim, col);
      }
    }
    sim.retired.length = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  _writeColor(i, field, sim, col) {
    const o = i * 3;
    if (sim.state[i] === STANDING) {
      const c = i === 0 ? TRIGGER_COLOR : STANDING_COLOR;
      col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
      return;
    }
    // Paint the picture in over the back half of the fall.
    const u = sim.state[i] === FALLEN ? 1 : Math.min(1, Math.max(0, (sim.t[i] / 0.17 - 0.45) / 0.55));
    const c = field.colors;
    col[o] = STANDING_COLOR.r + (c[o] - STANDING_COLOR.r) * u;
    col[o + 1] = STANDING_COLOR.g + (c[o + 1] - STANDING_COLOR.g) * u;
    col[o + 2] = STANDING_COLOR.b + (c[o + 2] - STANDING_COLOR.b) * u;
  }

  setGhosts(points, dirX, dirZ) {
    const n = Math.min(points.length, MAX_GHOSTS);
    const m = this._m, q = this._q;
    const yaw = Math.atan2(dirX, dirZ);
    for (let i = 0; i < n; i++) {
      m.makeTranslation(points[i][0], DOM_H / 2, points[i][1]);
      q.makeRotationY(yaw);
      m.multiply(q);
      this.ghosts.setMatrixAt(i, m);
    }
    this.ghosts.count = n;
    this.ghosts.instanceMatrix.needsUpdate = true;
  }

  clearGhosts() { this.ghosts.count = 0; }

  setMarkers(points) {
    const n = Math.min(points.length, MAX_MARKERS);
    for (let i = 0; i < n; i++) {
      this._m.makeTranslation(points[i][0], 0.012, points[i][1]);
      this.markers.setMatrixAt(i, this._m);
    }
    this.markers.count = n;
    this.markers.instanceMatrix.needsUpdate = true;
  }

  clearMarkers() { this.markers.count = 0; }

  // Screen point -> point on the ground plane.
  pick(clientX, clientY) {
    const el = this.renderer.domElement;
    const r = el.getBoundingClientRect();
    this._ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this._ray.setFromCamera(this._ndc, this.camera);
    return this._ray.ray.intersectPlane(this._plane, this._hit);
  }

  render() { this.renderer.render(this.scene, this.camera); }
}

export { SPACING };
