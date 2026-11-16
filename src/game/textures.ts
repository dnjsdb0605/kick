import * as THREE from 'three';

export type SignTextureType =
  | 'bike_lane'
  | 'bike_end'
  | 'no_sidewalk'
  | 'crosswalk_walk';

export interface TextureLibrary {
  asphalt: THREE.CanvasTexture;
  intersectionAsphalt: THREE.CanvasTexture;
  bikeLane: THREE.CanvasTexture;
  sidewalk: THREE.CanvasTexture;
  crosswalk: THREE.CanvasTexture;
  sharrowDecal: THREE.CanvasTexture;
  grass: THREE.CanvasTexture;
  policeSide: THREE.CanvasTexture;
  schoolBanner: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  buildings: THREE.CanvasTexture[];
  signs: Record<SignTextureType, THREE.CanvasTexture>;
  dispose(): void;
}

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(maxAnisotropy, 16);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function createAsphaltCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  // Base dark asphalt
  ctx.fillStyle = '#2c3038';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle aggregate grain
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 36 + Math.floor(Math.random() * 26);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Outer white boundary lines (u=0.025 and u=0.975)
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(8, 0, 8, 512);
  ctx.fillRect(496, 0, 8, 512);

  // Double yellow centerline (u=0.5)
  ctx.fillStyle = '#eab308';
  ctx.fillRect(247, 0, 6, 512);
  ctx.fillRect(259, 0, 6, 512);

  // Dashed lane dividers at u=0.25 and u=0.75
  ctx.fillStyle = '#cbd5e1';
  for (let y = 16; y < 512; y += 128) {
    ctx.fillRect(126, y, 6, 72);
    ctx.fillRect(380, y, 6, 72);
  }

  return c;
}

function createPlainAsphaltCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2b2f37';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 35 + Math.floor(Math.random() * 24);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    ctx.fillRect(x, y, 2, 2);
  }
  return c;
}

function createBikeLaneCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  // Terracotta-red Korean bike lane surface
  ctx.fillStyle = '#9b3a34';
  ctx.fillRect(0, 0, 256, 512);

  for (let i = 0; i < 2500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 512;
    const r = 140 + Math.floor(Math.random() * 28);
    const g = 52 + Math.floor(Math.random() * 18);
    const b = 46 + Math.floor(Math.random() * 18);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Crisp white border lines
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(6, 0, 10, 512);
  ctx.fillRect(240, 0, 10, 512);

  // Forward direction arrow
  ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
  ctx.beginPath();
  ctx.moveTo(128, 70);
  ctx.lineTo(168, 125);
  ctx.lineTo(144, 125);
  ctx.lineTo(144, 175);
  ctx.lineTo(112, 175);
  ctx.lineTo(112, 125);
  ctx.lineTo(88, 125);
  ctx.closePath();
  ctx.fill();

  // Simplified white bicycle/PM icon
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.92)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(88, 355, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(168, 355, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(88, 355);
  ctx.lineTo(125, 315);
  ctx.lineTo(168, 355);
  ctx.moveTo(125, 315);
  ctx.lineTo(115, 290);
  ctx.moveTo(155, 315);
  ctx.lineTo(168, 355);
  ctx.stroke();

  return c;
}

function createSidewalkCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#9aa3af';
  ctx.fillRect(0, 0, 256, 256);

  // Interlocking paver grid
  const cols = 4;
  const rows = 8;
  const w = 256 / cols;
  const h = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const offset = (r % 2) * (w * 0.5);
      const shade = 148 + ((r * 7 + col * 13) % 24);
      ctx.fillStyle = `rgb(${shade},${shade + 3},${shade + 8})`;
      ctx.fillRect(col * w + offset - w * 0.5 + 2, r * h + 2, w - 4, h - 4);
      ctx.fillRect(col * w + offset + w * 0.5 + 2, r * h + 2, w - 4, h - 4);
    }
  }

  // Korean yellow tactile braille strip along road-side edge (u near 0.1)
  ctx.fillStyle = '#eab308';
  ctx.fillRect(14, 0, 26, 256);
  ctx.fillStyle = '#ca8a04';
  for (let y = 8; y < 256; y += 16) {
    ctx.fillRect(18, y, 18, 6);
  }

  return c;
}

function createCrosswalkCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#2b2f37';
  ctx.fillRect(0, 0, 512, 256);

  // Zebra stripes across width
  ctx.fillStyle = '#f8fafc';
  for (let x = 24; x < 490; x += 64) {
    ctx.fillRect(x, 18, 36, 220);
  }

  return c;
}

function createSharrowCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  // Double chevron
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  [54, 92].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(76, y + 26);
    ctx.lineTo(128, y);
    ctx.lineTo(180, y + 26);
    ctx.stroke();
  });

  // PM / Bike outline
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(92, 190, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(164, 190, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(92, 190);
  ctx.lineTo(132, 190);
  ctx.lineTo(154, 145);
  ctx.lineTo(164, 190);
  ctx.stroke();

  return c;
}

function createGrassCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3c6e47';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.5 ? '#487f53' : '#315d3a';
    ctx.fillRect(x, y, 2, 3);
  }
  return c;
}

function createBuildingCanvas(baseHex: string, accentHex: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 512);

  // Horizontal floor bands
  const floors = 8;
  const fh = 512 / floors;
  for (let f = 0; f < floors; f++) {
    const y = f * fh;
    if (f === floors - 1) {
      // Ground floor retail facade
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, y + 6, 256, fh - 6);
      ctx.fillStyle = accentHex;
      ctx.fillRect(0, y, 256, 8);
      // Shop windows
      ctx.fillStyle = '#7dd3fc';
      ctx.fillRect(18, y + 16, 95, fh - 22);
      ctx.fillRect(142, y + 16, 95, fh - 22);
    } else {
      for (let col = 0; col < 4; col++) {
        const wx = 18 + col * 58;
        const wy = y + 12;
        const lit = (f * 3 + col * 5) % 4 !== 0;
        ctx.fillStyle = lit ? '#bae6fd' : '#334155';
        ctx.fillRect(wx, wy, 40, fh - 22);
        // Window frame
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.strokeRect(wx, wy, 40, fh - 22);
      }
    }
  }
  return c;
}

function createSignCanvas(type: SignTextureType): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 256);

  if (type === 'bike_lane') {
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(10, 10, 236, 236);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.strokeRect(18, 18, 220, 220);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('자전거·PM', 128, 92);
    ctx.fillText('전용도로', 128, 138);
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#bae6fd';
    ctx.fillText('우측 전용차로 이용', 128, 195);
  } else if (type === 'bike_end') {
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(10, 10, 236, 236);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 8;
    ctx.strokeRect(18, 18, 220, 220);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('자전거도로 끝', 128, 86);
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = '#991b1b';
    ctx.fillText('차도 우측', 128, 145);
    ctx.fillText('가장자리 통행', 128, 184);
  } else if (type === 'no_sidewalk') {
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(10, 10, 236, 236);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(22, 22, 212, 212);
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(128, 95, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(92, 58);
    ctx.lineTo(164, 132);
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('인도 주행금지', 128, 184);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('적발시 벌금 3만원', 128, 216);
  } else {
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(10, 10, 236, 236);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.strokeRect(18, 18, 220, 220);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('횡단보도', 128, 86);
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('하차(E) 후', 128, 142);
    ctx.fillText('끌고 보행!', 128, 182);
  }

  return c;
}

function createPoliceSideCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 128);

  // Korean police navy & yellow stripe
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(0, 82, 512, 46);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 72, 512, 10);

  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('POLICE  경찰', 256, 52);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('PM 교통안전 단속반 · 112', 256, 114);
  return c;
}

function createContactShadowCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.24)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

function createSchoolBannerCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 112);
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('푸른솔 학교 정문', 256, 62);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('SCHOOL GOAL · 안전 등교 완료!', 256, 102);
  return c;
}

export function createPixelArtTexture(pixels: string[]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      ctx.fillStyle = pixels[y * 16 + x] || '#0f172a';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export function createTextureLibrary(maxAnisotropy: number): TextureLibrary {
  const asphalt = finalizeColorTexture(createAsphaltCanvas(), maxAnisotropy, 1, 1);
  const intersectionAsphalt = finalizeColorTexture(
    createPlainAsphaltCanvas(),
    maxAnisotropy,
    2,
    2
  );
  const bikeLane = finalizeColorTexture(createBikeLaneCanvas(), maxAnisotropy, 1, 1);
  const sidewalk = finalizeColorTexture(createSidewalkCanvas(), maxAnisotropy, 1, 1);
  const crosswalk = finalizeColorTexture(createCrosswalkCanvas(), maxAnisotropy, 1, 1);

  const sharrowDecal = new THREE.CanvasTexture(createSharrowCanvas());
  sharrowDecal.colorSpace = THREE.SRGBColorSpace;
  sharrowDecal.anisotropy = Math.min(maxAnisotropy, 16);

  const grass = finalizeColorTexture(createGrassCanvas(), maxAnisotropy, 14, 14);
  const policeSide = finalizeColorTexture(createPoliceSideCanvas(), maxAnisotropy, 1, 1);
  const schoolBanner = finalizeColorTexture(
    createSchoolBannerCanvas(),
    maxAnisotropy,
    1,
    1
  );

  const contactShadow = new THREE.CanvasTexture(createContactShadowCanvas());
  contactShadow.colorSpace = THREE.SRGBColorSpace;

  const buildings = [
    finalizeColorTexture(createBuildingCanvas('#cbd5e1', '#0ea5e9'), maxAnisotropy, 1, 1),
    finalizeColorTexture(createBuildingCanvas('#94a3b8', '#f59e0b'), maxAnisotropy, 1, 1),
    finalizeColorTexture(createBuildingCanvas('#e2e8f0', '#10b981'), maxAnisotropy, 1, 1),
    finalizeColorTexture(createBuildingCanvas('#64748b', '#ef4444'), maxAnisotropy, 1, 1),
  ];

  const signs: Record<SignTextureType, THREE.CanvasTexture> = {
    bike_lane: finalizeColorTexture(createSignCanvas('bike_lane'), maxAnisotropy, 1, 1),
    bike_end: finalizeColorTexture(createSignCanvas('bike_end'), maxAnisotropy, 1, 1),
    no_sidewalk: finalizeColorTexture(createSignCanvas('no_sidewalk'), maxAnisotropy, 1, 1),
    crosswalk_walk: finalizeColorTexture(
      createSignCanvas('crosswalk_walk'),
      maxAnisotropy,
      1,
      1
    ),
  };

  return {
    asphalt,
    intersectionAsphalt,
    bikeLane,
    sidewalk,
    crosswalk,
    sharrowDecal,
    grass,
    policeSide,
    schoolBanner,
    contactShadow,
    buildings,
    signs,
    dispose() {
      asphalt.dispose();
      intersectionAsphalt.dispose();
      bikeLane.dispose();
      sidewalk.dispose();
      crosswalk.dispose();
      sharrowDecal.dispose();
      grass.dispose();
      policeSide.dispose();
      schoolBanner.dispose();
      contactShadow.dispose();
      buildings.forEach((b) => b.dispose());
      Object.values(signs).forEach((s) => s.dispose());
    },
  };
}
