import * as THREE from "three";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as GeometryUtils from "three/addons/utils/GeometryUtils.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createNoise2D } from "simplex-noise";

let animationId;
let scene;

const MAX_HEIGHT = 10;
const STONE_HEIGHT = MAX_HEIGHT * 0.8;
const DIRT_HEIGHT = MAX_HEIGHT * 0.7;
const GRASS_HEIGHT = MAX_HEIGHT * 0.5;
const SAND_HEIGHT = MAX_HEIGHT * 0.3;
const DIRT2_HEIGHT = MAX_HEIGHT * 0;
const TRANSLATE = 23;
const GROUND_WIDTH = 30;

scene = new THREE.Scene();
scene.background = new THREE.Color("#FFEECC");

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

// camera.position.set(-17, 31, 33);
// camera.position.set(0, 20, 60);
camera.position.set(0, 15, 50);

const renderer = new THREE.WebGLRenderer({
  // alpha: true,
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
// renderer.toneMapping = THREE.ACESFilmicToneMapping;
// renderer.outputColorSpace = THREE.SRGBColorSpace;
// renderer.physicalCorrectLights = true;
// renderer.shadowMap.enabled = true;
// renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const light = new THREE.PointLight(
  new THREE.Color("#FFCB8E").convertSRGBToLinear().convertSRGBToLinear(),
  80,
  200
);
light.position.set(10, 200, 10);

light.castShadow = true;
light.shadow.mapSize.width = 512;
light.shadow.mapSize.height = 512;
light.shadow.camera.near = 0.5;
light.shadow.camera.far = 500;
// scene.add(light);

// light kedua

const directLight = new THREE.DirectionalLight(0xffffff, 1);
directLight.position.y = 30;
directLight.position.z = 10;
directLight.castShadow = true;
scene.add(directLight);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.dampingFactor = 0.05;
controls.enableDamping = true;

let envmap;

class Box extends THREE.Mesh {
  constructor({
    width,
    height,
    depth,
    color = "#00ff00",
    velocity = {
      x: 0,
      y: 0,
      z: 0,
    },
    position = {
      x: 0,
      y: 0,
      z: 0,
    },
    zAcceleration = false,
  }) {
    super(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color })
    );

    this.width = width;
    this.height = height;
    this.depth = depth;

    this.position.set(position.x, position.y, position.z);

    this.right = this.position.x + this.width / 2;
    this.left = this.position.x - this.width / 2;

    this.bottom = this.position.y - this.height / 2;
    this.top = this.position.y + this.height / 2;

    this.front = this.position.z + this.depth / 2;
    this.back = this.position.z - this.depth / 2;

    this.velocity = velocity;
    this.gravity = -0.002;

    this.zAcceleration = zAcceleration;
  }

  updateSides() {
    this.right = this.position.x + this.width / 2;
    this.left = this.position.x - this.width / 2;

    this.bottom = this.position.y - this.height / 2;
    this.top = this.position.y + this.height / 2;

    this.front = this.position.z + this.depth / 2;
    this.back = this.position.z - this.depth / 2;
  }

  update(ground) {
    this.updateSides();

    if (this.zAcceleration) this.velocity.z += 0.0003;

    this.position.x += this.velocity.x;
    this.position.z += this.velocity.z;

    this.applyGravity(ground);
  }

  applyGravity(ground) {
    this.velocity.y += this.gravity;

    // this is where we hit the ground
    if (
      boxCollision({
        box1: this,
        box2: ground,
      })
    ) {
      const friction = 0.5;
      this.velocity.y *= friction;
      this.velocity.y = -this.velocity.y;
    } else this.position.y += this.velocity.y;
  }
}

class Car extends THREE.Group {
  constructor({
    width,
    height,
    depth,
    color = "#ff0000",
    velocity = { x: 0, y: 0, z: 0 },
    position = { x: 0, y: 0, z: 0 },
    zAcceleration = false,
  }) {
    super();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color })
    );
    this.add(body);

    // Head Lamp
    const headlampGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 32);
    const headlampMaterial = new THREE.MeshStandardMaterial({
      color: "#ffffff",
    });
    const headLampLeft = new THREE.Mesh(headlampGeometry, headlampMaterial);
    const headLampRight = new THREE.Mesh(headlampGeometry, headlampMaterial);

    headLampLeft.rotation.x = Math.PI / 2;
    headLampRight.rotation.x = Math.PI / 2;
    headLampLeft.position.set(width / 3, height / 6, -depth / 2);
    headLampRight.position.set(-width / 3, height / 6, -depth / 2);
    this.add(headLampLeft);
    this.add(headLampRight);

    // Wheels
    const wheelSize = width / 2;
    const wheelColor = "#000000";

    const frontLeftWheel = new THREE.Mesh(
      new THREE.BoxGeometry(wheelSize, wheelSize, wheelSize),
      new THREE.MeshStandardMaterial({ color: wheelColor })
    );
    frontLeftWheel.position.set(-width / 2, -height / 4, -depth / 2);
    this.add(frontLeftWheel);

    const rearLeftWheel = new THREE.Mesh(
      new THREE.BoxGeometry(wheelSize, wheelSize, wheelSize),
      new THREE.MeshStandardMaterial({ color: wheelColor })
    );
    rearLeftWheel.position.set(-width / 2, -height / 4, depth / 2);
    this.add(rearLeftWheel);

    const frontRightWheel = new THREE.Mesh(
      new THREE.BoxGeometry(wheelSize, wheelSize, wheelSize),
      new THREE.MeshStandardMaterial({ color: wheelColor })
    );
    frontRightWheel.position.set(width / 2, -height / 4, -depth / 2);
    this.add(frontRightWheel);

    const rearRightWheel = new THREE.Mesh(
      new THREE.BoxGeometry(wheelSize, wheelSize, wheelSize),
      new THREE.MeshStandardMaterial({ color: wheelColor })
    );
    rearRightWheel.position.set(width / 2, -height / 4, depth / 2);
    this.add(rearRightWheel);

    this.width = width;
    this.height = height;
    this.depth = depth;

    this.position.set(position.x, position.y, position.z);

    this.right = this.position.x + this.width / 2;
    this.left = this.position.x - this.width / 2;

    this.bottom = this.position.y - this.height / 2;
    this.top = this.position.y + this.height / 2;

    this.front = this.position.z + this.depth / 2;
    this.back = this.position.z - this.depth / 2;

    this.velocity = velocity;
    this.gravity = -0.002;

    this.zAcceleration = zAcceleration;
  }

  updateSides() {
    this.right = this.position.x + this.width / 2;
    this.left = this.position.x - this.width / 2;

    this.bottom = this.position.y - this.height / 2;
    this.top = this.position.y + this.height / 2;

    this.front = this.position.z + this.depth / 2;
    this.back = this.position.z - this.depth / 2;
  }

  update(ground) {
    this.updateSides();

    if (this.zAcceleration) this.velocity.z += 0.0003;

    this.position.x += this.velocity.x;
    this.position.z += this.velocity.z;

    this.applyGravity(ground);
  }

  applyGravity(ground) {
    this.velocity.y += this.gravity;

    // this is where we hit the ground
    if (boxCollision({ box1: this, box2: ground })) {
      const friction = 0.5;
      this.velocity.y *= friction;
      this.velocity.y = -this.velocity.y;
    } else this.position.y += this.velocity.y;
  }
}
function boxCollision({ box1, box2 }) {
  const xCollision = box1.right >= box2.left && box1.left <= box2.right;
  const yCollision =
    box1.bottom + box1.velocity.y <= box2.top && box1.top >= box2.bottom;
  const zCollision = box1.front >= box2.back && box1.back <= box2.front;

  return xCollision && yCollision && zCollision;
}

const keys = {
  a: {
    pressed: false,
  },
  d: {
    pressed: false,
  },
  s: {
    pressed: false,
  },
  w: {
    pressed: false,
  },
};

const cube = new Car({
  // green color
  color: "#00ff00",
  width: 1,
  height: 1,
  depth: 1,
  velocity: {
    x: 0,
    y: -0.01,
    z: 0,
  },
  position: {
    x: 0,
    y: 2,
    z: 0,
  },
});

cube.castShadow = true;
scene.add(cube);

const ground = new Box({
  width: GROUND_WIDTH,
  height: 0.5,
  depth: 50,
  color: "#0369a1",
  position: {
    x: 0,
    y: 0,
    z: 0,
  },
});

ground.receiveShadow = true;
scene.add(ground);

window.addEventListener("keydown", (event) => {
  switch (event.code) {
    case "KeyA":
      keys.a.pressed = true;
      break;
    case "KeyD":
      keys.d.pressed = true;
      break;
    case "KeyS":
      keys.s.pressed = true;
      break;
    case "KeyW":
      keys.w.pressed = true;
      break;
    case "Space":
      cube.velocity.y = 0.08;
      break;
  }
});

window.addEventListener("keyup", (event) => {
  switch (event.code) {
    case "KeyA":
      keys.a.pressed = false;
      break;
    case "KeyD":
      keys.d.pressed = false;
      break;
    case "KeyS":
      keys.s.pressed = false;
      break;
    case "KeyW":
      keys.w.pressed = false;
      break;
  }
});

const enemies = [];

let frames = 0;
let spawnRate = 200;

function tileToPosition(tileX, tileY) {
  return new THREE.Vector2((tileX + (tileY % 2) * 0.5) * 1.77, tileY * 1.535);
}

let stoneGeo = new THREE.BoxGeometry(0, 0, 0);
let dirtGeo = new THREE.BoxGeometry(0, 0, 0);
let dirt2Geo = new THREE.BoxGeometry(0, 0, 0);
let sandGeo = new THREE.BoxGeometry(0, 0, 0);
let grassGeo = new THREE.BoxGeometry(0, 0, 0);

// let hexagonGeometris = new THREE.BoxGeometry(0, 0, 0);

function hexGeometry(height, position) {
  let geo = new THREE.CylinderGeometry(1, 1, height, 6, 1, false);
  geo.translate(position.x - TRANSLATE, height * 0.5, position.y);

  return geo;
}

function hexGeometry2(height, position) {
  let geo = new THREE.CylinderGeometry(1, 1, height, 6, 1, false);
  geo.translate(position.x + TRANSLATE, height * 0.5, position.y);

  return geo;
}

function makeHex(height, position) {
  let geo = hexGeometry(height, position);
  // hexagonGeometris = mergeGeometries([hexagonGeometris, geo]);
  if (height > STONE_HEIGHT) {
    stoneGeo = mergeGeometries([geo, stoneGeo]);

    if (Math.random() > 0.8) {
      stoneGeo = mergeGeometries([geo, stone(height, position)]);
    }
  } else if (height > DIRT_HEIGHT) {
    dirtGeo = mergeGeometries([geo, dirtGeo]);

    if (Math.random() > 0.8) {
      grassGeo = mergeGeometries([grassGeo, tree(height, position)]);
    }
  } else if (height > GRASS_HEIGHT) {
    grassGeo = mergeGeometries([geo, grassGeo]);
    if (Math.random() > 0.8) {
      grassGeo = mergeGeometries([grassGeo, tree(height, position)]);
    }
  } else if (height > SAND_HEIGHT) {
    if (Math.random() > 0.8 && stoneGeo) {
      stoneGeo = mergeGeometries([geo, stone(height, position)]);
    }
    sandGeo = mergeGeometries([geo, sandGeo]);
  } else if (height > DIRT2_HEIGHT) {
    dirt2Geo = mergeGeometries([geo, dirt2Geo]);
    if (Math.random() > 0.8) {
      stoneGeo = mergeGeometries([geo, stone(height, position)]);
    }
  }
}

function makeHex2(height, position) {
  let geo = hexGeometry2(height, position);
  // hexagonGeometris = mergeGeometries([hexagonGeometris, geo]);
  if (height > STONE_HEIGHT) {
    stoneGeo = mergeGeometries([geo, stoneGeo]);

    if (Math.random() > 0.8) {
      stoneGeo = mergeGeometries([geo, stone2(height, position)]);
    }
  } else if (height > DIRT_HEIGHT) {
    dirtGeo = mergeGeometries([geo, dirtGeo]);

    if (Math.random() > 0.8) {
      grassGeo = mergeGeometries([grassGeo, tree2(height, position)]);
    }
  } else if (height > GRASS_HEIGHT) {
    grassGeo = mergeGeometries([geo, grassGeo]);
    if (Math.random() > 0.8) {
      grassGeo = mergeGeometries([grassGeo, tree2(height, position)]);
    }
  } else if (height > SAND_HEIGHT) {
    if (Math.random() > 0.8 && stoneGeo) {
      stoneGeo = mergeGeometries([geo, stone2(height, position)]);
    }
    sandGeo = mergeGeometries([geo, sandGeo]);
  } else if (height > DIRT2_HEIGHT) {
    dirt2Geo = mergeGeometries([geo, dirt2Geo]);
    if (Math.random() > 0.8) {
      stoneGeo = mergeGeometries([geo, stone2(height, position)]);
    }
  }
}

function hexMesh(geo, map) {
  let mat = new THREE.MeshPhysicalMaterial({
    envMap: envmap,
    // envMapIntensity: 1,
    envMapIntensity: 0.135,
    flatShading: true,
    map,
  });

  let mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

function stone(height, position) {
  const px = Math.random() * 0.4;
  const pz = Math.random() * 0.4;

  const geo = new THREE.SphereGeometry(Math.random() * 0.3 + 0.1, 7, 7);
  geo.translate(position.x - TRANSLATE + px, height, position.y + pz);

  return geo;
}

function stone2(height, position) {
  const px = Math.random() * 0.4;
  const pz = Math.random() * 0.4;

  const geo = new THREE.SphereGeometry(Math.random() * 0.3 + 0.1, 7, 7);
  geo.translate(position.x + TRANSLATE + px, height, position.y + pz);

  return geo;
}

function tree(height, position) {
  const treeHeight = Math.random() * 1 + 1.25;

  const geo = new THREE.CylinderGeometry(0, 1.5, treeHeight, 3);
  geo.translate(
    position.x - TRANSLATE,
    height + treeHeight * 0 + 1,
    position.y
  );

  const geo2 = new THREE.CylinderGeometry(0, 1.15, treeHeight, 3);
  geo2.translate(
    position.x - TRANSLATE,
    height + treeHeight * 0.6 + 1,
    position.y
  );

  const geo3 = new THREE.CylinderGeometry(0, 0.8, treeHeight, 3);
  geo3.translate(
    position.x - TRANSLATE,
    height + treeHeight * 1.25 + 1,
    position.y
  );

  return mergeGeometries([geo, geo2, geo3]);
}

function tree2(height, position) {
  const treeHeight = Math.random() * 1 + 1.25;

  const geo = new THREE.CylinderGeometry(0, 1.5, treeHeight, 3);
  geo.translate(
    position.x + TRANSLATE,
    height + treeHeight * 0 + 1,
    position.y
  );

  const geo2 = new THREE.CylinderGeometry(0, 1.15, treeHeight, 3);
  geo2.translate(
    position.x + TRANSLATE,
    height + treeHeight * 0.6 + 1,
    position.y
  );

  const geo3 = new THREE.CylinderGeometry(0, 0.8, treeHeight, 3);
  geo3.translate(
    position.x + TRANSLATE,
    height + treeHeight * 1.25 + 1,
    position.y
  );

  return mergeGeometries([geo, geo2, geo3]);
}

function clouds() {
  let geo = new THREE.SphereGeometry(0, 0, 0);

  let count = Math.floor(Math.pow(Math.random(), 1) * 20);

  for (let i = 0; i < count; i++) {
    const puff1 = new THREE.SphereGeometry(1.2, 7, 7);
    const puff2 = new THREE.SphereGeometry(1.5, 7, 7);
    const puff3 = new THREE.SphereGeometry(0.9, 7, 7);

    puff1.translate(-1.85, Math.random() * 0.3, 0);
    puff2.translate(0, Math.random() * 0.3, 0);
    puff3.translate(1.85, Math.random() * 0.3, 0);

    const cloudGeo = mergeGeometries([puff1, puff2, puff3]);

    cloudGeo.translate(
      Math.random() * 20 - 10,
      Math.random() * 10 + 7,
      Math.random() * 20 - 10
    );

    cloudGeo.rotateY(Math.random() * Math.PI * 2);

    // cloudGeo.castShadow = true;

    geo = mergeGeometries([geo, cloudGeo]);
  }

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      envMap: envmap,
      envMapIntensity: 0.75,
      flatShading: true,
    })
  );

  mesh.castShadow = true;

  scene.add(mesh);
}

envmap = new RGBELoader()
  .setDataType(THREE.FloatType)
  .load("assets/envmap.hdr");

let textures = {
  dirt: new THREE.TextureLoader().load("assets/dirt.png"),
  dirt2: new THREE.TextureLoader().load("assets/dirt2.jpg"),
  grass: new THREE.TextureLoader().load("assets/grass.jpg"),
  sand: new THREE.TextureLoader().load("assets/sand.jpg"),
  water: new THREE.TextureLoader().load("assets/water.jpg"),
  stone: new THREE.TextureLoader().load("assets/stone.png"),
};

for (let i = -5; i <= 5; i++) {
  for (let j = -20; j <= 20; j++) {
    let position = tileToPosition(i, j);

    // if (position.length() > 16) continue;

    const noise2D = createNoise2D();

    // between -1 and +1 and need to be normalize to 0 and 1
    let noise = (noise2D(i * 0.1, j * 0.1) + 1) * 0.5;
    noise = Math.pow(noise, 1.5);

    makeHex(noise * MAX_HEIGHT, position);
  }
}

for (let i = -5; i <= 5; i++) {
  for (let j = -20; j <= 20; j++) {
    let position = tileToPosition(i, j);

    // if (position.length() > 16) continue;

    const noise2D = createNoise2D();

    // between -1 and +1 and need to be normalize to 0 and 1
    let noise = (noise2D(i * 0.1, j * 0.1) + 1) * 0.5;
    noise = Math.pow(noise, 1.5);

    makeHex2(noise * MAX_HEIGHT, position);
  }
}

let stoneMesh = hexMesh(stoneGeo, textures.stone);
let grassMesh = hexMesh(grassGeo, textures.grass);
let dirtMesh = hexMesh(dirtGeo, textures.dirt);
let dirt2Mesh = hexMesh(dirt2Geo, textures.dirt2);
let sandMesh = hexMesh(sandGeo, textures.sand);

scene.add(stoneMesh, grassMesh, dirtMesh, dirt2Mesh, sandMesh);

function seaMesh(position, width, height, edge) {
  let mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, MAX_HEIGHT * 0.1),
    new THREE.MeshPhysicalMaterial({
      envMap: envmap,
      color: new THREE.Color("#55aaff").convertSRGBToLinear().multiplyScalar(3),
      ior: 1.4, // index of refraction
      transmission: 1,
      transparent: true,
      thickness: 1.5,
      envMapIntensity: 0.2,
      roughness: 1,
      metalness: 0.025,
      roughnessMap: textures.water,
      metalnessMap: textures.water,
    })
  );

  mesh.rotateX(Math.PI * 0.5);

  mesh.receiveShadow = true;
  mesh.position.set(position.x, position.y, position.z);

  scene.add(mesh);
}

seaMesh(new THREE.Vector3(-23, 2, 0), 22, 65);
seaMesh(new THREE.Vector3(23, 2, 0), 22, 65);

let mapContainer = new THREE.Mesh(
  new THREE.BoxGeometry(70, 70, MAX_HEIGHT * 0.06),
  new THREE.MeshPhysicalMaterial({
    envMap: envmap,
    map: textures.dirt,
    envMapIntensity: 0.2,
    side: THREE.DoubleSide,
  })
);

mapContainer.rotateX(Math.PI * 0.5);
mapContainer.receiveShadow = true;
mapContainer.position.set(0, 0, 0);
scene.add(mapContainer);

function mapFloor(position, width, height, edge) {
  let mapFloor = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, MAX_HEIGHT * 0.05),
    new THREE.MeshPhysicalMaterial({
      envMap: envmap,
      map: textures.dirt2,
      envMapIntensity: 0.1,
      side: THREE.DoubleSide,
    })
  );

  mapFloor.rotateY(Math.PI * edge);
  mapFloor.receiveShadow = true;
  mapFloor.position.set(position.x, 1.8, position.z);
  scene.add(mapFloor);
}

mapFloor(new THREE.Vector3(-12, 1.8, 0), 65, 3, 0.5);
mapFloor(new THREE.Vector3(12, 1.8, 0), 65, 3, -0.5);
mapFloor(new THREE.Vector3(0, 1.8, 32.3), 68.5, 3, 0);
mapFloor(new THREE.Vector3(0, 1.8, -32.3), 68.5, 3, 1);
mapFloor(new THREE.Vector3(-34, 1.8, 0), 65, 3, 0.5);
mapFloor(new THREE.Vector3(34, 1.8, 0), 65, 3, 0.5);

const wayTexture = new THREE.TextureLoader().load("assets/roadVect.jpeg");
const groundSkin = new THREE.Mesh(
  new THREE.BoxGeometry(18, 0.01, 65),
  new THREE.MeshPhongMaterial({
    map: wayTexture,
    specular: new THREE.Color(0x050505),
    shininess: 100,
    side: THREE.FrontSide,
    reflectivity: 20,
  })
);

groundSkin.position.y = 0.34;
// groundSkin.castShadow = true;
groundSkin.receiveShadow = true;
scene.add(groundSkin);

const grass = new THREE.TextureLoader().load("assets/grass2.jpg");
grass.magFilter = THREE.NearestFilter;
grass.minFilter = THREE.NearestFilter;
const grassYard = new THREE.Mesh(
  new THREE.BoxGeometry(25, 0.01, 65),
  new THREE.MeshStandardMaterial({
    map: grass,
    // shininess: 50,
    bumpMap: grass,
    bumpScale: 0.1,
    emissive: 0x00ff00,
    emissiveIntensity: 0.15,
  })
);
grassYard.position.y = 0.3;
// grassYard.castShadow = true;
grassYard.receiveShadow = true;
scene.add(grassYard);

const loader = new GLTFLoader();

function realTree(position) {
  loader.load("assets/tree.glb", function (glb) {
    const tree = glb.scene;
    tree.scale.set(1, 1, 1);
    tree.position.set(position.x, position.y, position.z);
    tree.rotation.y = Math.PI / 2;
    scene.add(tree);
  });
}

realTree(new THREE.Vector3(-10, 0, -3));
realTree(new THREE.Vector3(10, 0, -3));

clouds();

function animate() {
  animationId = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);

  // movement code
  cube.velocity.x = 0;
  cube.velocity.z = 0;
  if (keys.a.pressed) {
    if (cube.left <= ground.left) {
      cube.velocity.x = 0;
    } else {
      cube.velocity.x = -0.05;
    }
  } else if (keys.d.pressed) {
    if (cube.right >= ground.right) {
      cube.velocity.x = 0;
    } else {
      cube.velocity.x = 0.05;
    }
  }

  if (keys.s.pressed) {
    if (cube.back >= 0.5) {
      cube.velocity.z = 0;
    } else {
      cube.velocity.z = 0.05;
    }
  } else if (keys.w.pressed) {
    if (cube.front <= -15) {
      cube.velocity.z = 0;
    } else {
      cube.velocity.z = -0.05;
    }
  }

  cube.update(ground);
  enemies.forEach((enemy) => {
    enemy.update(ground);
    if (
      boxCollision({
        box1: cube,
        box2: enemy,
      })
    ) {
      cancelAnimationFrame(animationId);
    }
    if (enemy.position.z >= 8) {
      scene.remove(enemy);
    }
  });

  if (frames % spawnRate === 0) {
    if (spawnRate > 20) spawnRate -= 20;

    const enemy = new Car({
      width: 1,
      height: 1,
      depth: 1,
      position: {
        x: (Math.random() - 0.5) * (GROUND_WIDTH - 15),
        y: 2,
        z: -20,
      },
      velocity: {
        x: 0,
        y: 0,
        z: 0.005,
      },
      color: "red",
      zAcceleration: true,
    });
    enemy.rotation.y = Math.PI;
    enemy.castShadow = true;
    scene.add(enemy);
    enemies.push(enemy);
  }

  frames++;
}

animate();
