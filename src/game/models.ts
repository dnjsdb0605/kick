import * as THREE from 'three';
import { ScooterType } from '../types/game';

export interface KickboardRig {
  root: THREE.Group;
  scooterGroup: THREE.Group;
  steeringGroup: THREE.Group;
  frontWheel: THREE.Mesh;
  rearWheel: THREE.Mesh;
  riderGroup: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  tailLightMat: THREE.MeshStandardMaterial;
  updateAnimation(
    dt: number,
    speedMps: number,
    steerAngle: number,
    isBraking: boolean,
    isDismounted: boolean,
    leanAngle: number
  ): void;
}

export function createKickboardRig(
  contactShadowTex: THREE.Texture,
  scooterType: ScooterType = 'standard',
  customPixelTex?: THREE.Texture
): KickboardRig {
  const root = new THREE.Group();

  // Contact shadow grounding plane
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 2.2),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.48,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.025;
  root.add(shadowPlane);

  const scooterGroup = new THREE.Group();
  root.add(scooterGroup);

  // Per-scooter palette & materials
  const primaryHex =
    scooterType === 'ssing'
      ? 0xfacc15
      : scooterType === 'premium'
      ? 0x0f172a
      : scooterType === 'custom'
      ? 0x1e293b
      : 0x334155;
  const accentHex =
    scooterType === 'ssing'
      ? 0x18181b
      : scooterType === 'premium'
      ? 0xf59e0b
      : scooterType === 'custom'
      ? 0xec4899
      : 0x06b6d4;

  const matteRubberMat = new THREE.MeshStandardMaterial({
    color: 0x16191f,
    roughness: 0.88,
    metalness: 0.05,
  });
  const alloyMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    roughness: scooterType === 'premium' ? 0.22 : 0.3,
    metalness: scooterType === 'ssing' ? 0.35 : 0.82,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    roughness: 0.25,
    metalness: 0.55,
  });
  const deckGripMat =
    scooterType === 'custom' && customPixelTex
      ? new THREE.MeshStandardMaterial({
          map: customPixelTex,
          roughness: 0.55,
          metalness: 0.1,
        })
      : new THREE.MeshStandardMaterial({
          color: scooterType === 'premium' ? 0x18181b : 0x1e293b,
          roughness: 0.92,
          metalness: 0.05,
        });

  const headLightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: scooterType === 'premium' ? 0xfef08a : 0xe0f2fe,
    emissiveIntensity: scooterType === 'premium' ? 2.2 : 1.6,
    roughness: 0.2,
  });
  const tailLightMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.7,
    roughness: 0.3,
  });

  // 1. Deck (wider rugged deck for premium)
  const deckW = scooterType === 'premium' ? 0.3 : 0.24;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.06, 0.94), alloyMat);
  deck.position.set(0, 0.16, 0.02);
  deck.castShadow = true;
  scooterGroup.add(deck);

  const gripPad = new THREE.Mesh(
    new THREE.BoxGeometry(deckW - 0.03, 0.016, 0.76),
    deckGripMat
  );
  gripPad.position.set(0, 0.196, 0.02);
  scooterGroup.add(gripPad);

  // Side accent trim strips
  const sideStripL = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, 0.038, 0.82),
    accentMat
  );
  sideStripL.position.set(-(deckW / 2 + 0.008), 0.16, 0.02);
  const sideStripR = sideStripL.clone();
  sideStripR.position.x = deckW / 2 + 0.008;
  scooterGroup.add(sideStripL, sideStripR);

  // Premium rear kicktail / spoiler
  if (scooterType === 'premium') {
    const kicktail = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.05, 0.16),
      accentMat
    );
    kicktail.rotation.x = 0.48;
    kicktail.position.set(0, 0.22, 0.46);
    scooterGroup.add(kicktail);
  }

  // Rear fender + tail light
  const rearFender = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.145, 0.09, 14, 1, false, 0, Math.PI * 0.75),
    matteRubberMat
  );
  rearFender.rotation.z = Math.PI / 2;
  rearFender.rotation.x = Math.PI * 0.65;
  rearFender.position.set(0, 0.15, 0.49);
  scooterGroup.add(rearFender);

  const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.032, 0.025), tailLightMat);
  tailLight.position.set(0, 0.22, 0.56);
  scooterGroup.add(tailLight);

  // Rear wheel + alloy hub
  const wheelRadius = scooterType === 'premium' ? 0.145 : 0.13;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.072, 20);
  wheelGeo.rotateZ(Math.PI / 2);
  const rearWheel = new THREE.Mesh(wheelGeo, matteRubberMat);
  rearWheel.position.set(0, wheelRadius, 0.48);
  rearWheel.castShadow = true;
  const rearHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.072, 0.078, 14).rotateZ(Math.PI / 2),
    accentMat
  );
  rearWheel.add(rearHub);
  scooterGroup.add(rearWheel);

  // 2. Steering Assembly (fork, wheel, stem, handlebar, accessories)
  const steeringGroup = new THREE.Group();
  steeringGroup.position.set(0, 0.16, -0.44);
  scooterGroup.add(steeringGroup);

  const frontWheel = new THREE.Mesh(wheelGeo, matteRubberMat);
  frontWheel.position.set(0, wheelRadius - 0.16, -0.04);
  frontWheel.castShadow = true;
  const frontHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.072, 0.078, 14).rotateZ(Math.PI / 2),
    accentMat
  );
  frontWheel.add(frontHub);
  steeringGroup.add(frontWheel);

  // Angled stem (thicker/twin fork on premium)
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(
      scooterType === 'premium' ? 0.032 : 0.026,
      scooterType === 'premium' ? 0.038 : 0.032,
      1.08,
      12
    ),
    alloyMat
  );
  stem.rotation.x = 0.14;
  stem.position.set(0, 0.52, 0.05);
  stem.castShadow = true;
  steeringGroup.add(stem);

  // Type-specific front features
  if (scooterType === 'ssing') {
    // Shared scooter front wire basket + IoT QR lock unit
    const basket = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.18, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6, metalness: 0.5 })
    );
    basket.position.set(0, 0.78, -0.04);
    basket.castShadow = true;
    steeringGroup.add(basket);

    const qrBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.06, 0.09),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 })
    );
    qrBox.position.set(0, 1.07, 0.12);
    steeringGroup.add(qrBox);
  } else if (scooterType === 'premium') {
    // Dual front gold suspension struts
    [-0.07, 0.07].forEach((sx) => {
      const strut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.34, 10),
        accentMat
      );
      strut.position.set(sx, 0.14, -0.02);
      steeringGroup.add(strut);
    });
  } else if (scooterType === 'custom' && customPixelTex) {
    // Front stem pixel art shield plate!
    const badgePlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.24, 0.025),
      new THREE.MeshStandardMaterial({ map: customPixelTex, roughness: 0.45 })
    );
    badgePlate.rotation.x = 0.14;
    badgePlate.position.set(0, 0.72, 0.03);
    steeringGroup.add(badgePlate);
  }

  // Folding clamp accent
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.09, 0.09), accentMat);
  clamp.position.set(0, 0.12, 0.0);
  steeringGroup.add(clamp);

  // Handlebar
  const handlebar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.56, 12).rotateZ(Math.PI / 2),
    alloyMat
  );
  handlebar.position.set(0, 1.04, 0.13);
  steeringGroup.add(handlebar);

  const gripGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.13, 12).rotateZ(Math.PI / 2);
  const gripL = new THREE.Mesh(gripGeo, matteRubberMat);
  gripL.position.set(-0.23, 1.04, 0.13);
  const gripR = new THREE.Mesh(gripGeo, matteRubberMat);
  gripR.position.set(0.23, 1.04, 0.13);
  steeringGroup.add(gripL, gripR);

  // Display + LED headlight(s)
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.06), matteRubberMat);
  dash.position.set(0, 1.06, 0.13);
  steeringGroup.add(dash);

  if (scooterType === 'premium') {
    [-0.06, 0.06].forEach((hx) => {
      const hl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.024, 0.045, 12).rotateX(Math.PI / 2),
        headLightMat
      );
      hl.position.set(hx, 0.96, 0.08);
      steeringGroup.add(hl);
    });
  } else {
    const headlight = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.04, 12).rotateX(Math.PI / 2),
      headLightMat
    );
    headlight.position.set(0, 0.96, 0.08);
    steeringGroup.add(headlight);
  }

  // 3. Articulated Rider with Safety Helmet
  const riderGroup = new THREE.Group();
  root.add(riderGroup);

  const jacketMat = new THREE.MeshStandardMaterial({
    color: 0x2563eb,
    roughness: 0.72,
    metalness: 0.05,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
    metalness: 0.05,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xf1c27d,
    roughness: 0.65,
  });
  const helmetMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.22,
    metalness: 0.15,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.15,
    metalness: 0.6,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.6,
  });
  const backpackMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.8,
  });

  // Legs (pivoted at hip)
  const makeLeg = (xOffset: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOffset, 0.78, 0);
    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.065, 0.44, 6, 10),
      pantsMat
    );
    thigh.position.set(0, -0.26, 0);
    thigh.castShadow = true;
    legPivot.add(thigh);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.22), shoeMat);
    shoe.position.set(0, -0.54, -0.04);
    shoe.castShadow = true;
    legPivot.add(shoe);
    return legPivot;
  };
  const leftLeg = makeLeg(-0.085);
  const rightLeg = makeLeg(0.085);
  riderGroup.add(leftLeg, rightLeg);

  // Torso + safety reflector vest accent + backpack
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.46, 0.2), jacketMat);
  torso.position.set(0, 1.03, 0);
  torso.castShadow = true;
  riderGroup.add(torso);

  const vestStripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.33, 0.05, 0.21),
    new THREE.MeshStandardMaterial({
      color: 0xa3e635,
      emissive: 0x4d7c0f,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    })
  );
  vestStripe.position.set(0, 0.96, 0);
  riderGroup.add(vestStripe);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.13), backpackMat);
  backpack.position.set(0, 1.04, 0.15);
  backpack.castShadow = true;
  riderGroup.add(backpack);

  // Head + Helmet (Safety gear!)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 14), skinMat);
  head.position.set(0, 1.38, -0.01);
  head.castShadow = true;
  riderGroup.add(head);

  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.148, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    helmetMat
  );
  helmet.position.set(0, 1.4, -0.01);
  helmet.castShadow = true;
  riderGroup.add(helmet);

  const helmetVisor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.09), visorMat);
  helmetVisor.position.set(0, 1.41, -0.13);
  riderGroup.add(helmetVisor);

  // Arms (pivoted at shoulders)
  const makeArm = (xOffset: number) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(xOffset, 1.22, 0);
    const armMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.048, 0.36, 6, 8),
      jacketMat
    );
    armMesh.position.set(0, -0.2, 0);
    armMesh.castShadow = true;
    armPivot.add(armMesh);
    return armPivot;
  };
  const leftArm = makeArm(-0.2);
  const rightArm = makeArm(0.2);
  riderGroup.add(leftArm, rightArm);

  let walkPhase = 0;
  let dismountBlend = 0;

  return {
    root,
    scooterGroup,
    steeringGroup,
    frontWheel,
    rearWheel,
    riderGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    tailLightMat,
    updateAnimation(dt, speedMps, steerAngle, isBraking, isDismounted, leanAngle) {
      // Spin wheels based on distance
      const wheelRotDelta = (speedMps * dt) / 0.13;
      frontWheel.rotation.x -= wheelRotDelta;
      rearWheel.rotation.x -= wheelRotDelta;

      // Brake tail light intensity
      tailLightMat.emissiveIntensity = isBraking ? 2.6 : 0.7;

      // Steer handlebar
      steeringGroup.rotation.y = THREE.MathUtils.damp(
        steeringGroup.rotation.y,
        steerAngle,
        14,
        dt
      );

      // Smoothly blend between mounted riding pose (0) and walking-beside-kickboard pose (1)
      dismountBlend = THREE.MathUtils.damp(
        dismountBlend,
        isDismounted ? 1 : 0,
        10,
        dt
      );

      // Lean scooter slightly on turns while mounted
      scooterGroup.rotation.z = leanAngle * (1 - dismountBlend);

      // Position rider: on deck (x=0, y=0.20, z=0.14) vs beside scooter on right/left (x=-0.42, y=0, z=0.05)
      riderGroup.position.x = THREE.MathUtils.lerp(0, -0.44, dismountBlend);
      riderGroup.position.y = THREE.MathUtils.lerp(0.2, 0, dismountBlend);
      riderGroup.position.z = THREE.MathUtils.lerp(0.14, 0.04, dismountBlend);
      riderGroup.rotation.z = leanAngle * 0.75 * (1 - dismountBlend);

      if (dismountBlend > 0.35) {
        // Walking stride animation while pushing kickboard
        if (Math.abs(speedMps) > 0.15) {
          walkPhase += dt * Math.abs(speedMps) * 3.8;
        }
        const stride = Math.sin(walkPhase) * (Math.abs(speedMps) > 0.15 ? 0.45 : 0.02);
        leftLeg.rotation.x = stride;
        rightLeg.rotation.x = -stride;
        // Right hand reaches toward handlebar to push kickboard, left arm swings
        rightArm.rotation.x = 0.65;
        rightArm.rotation.z = -0.25;
        leftArm.rotation.x = -stride * 0.7;
        leftArm.rotation.z = 0.05;
      } else {
        // Mounted riding stance: one foot forward, one back, both hands on grips
        leftLeg.rotation.x = 0.18;
        rightLeg.rotation.x = -0.24;
        leftArm.rotation.x = 0.88;
        leftArm.rotation.z = 0.08;
        rightArm.rotation.x = 0.88;
        rightArm.rotation.z = -0.08;
      }
    },
  };
}

export interface PoliceCarRig {
  root: THREE.Group;
  wheels: THREE.Mesh[];
  redBeaconMat: THREE.MeshStandardMaterial;
  blueBeaconMat: THREE.MeshStandardMaterial;
  redLight: THREE.PointLight;
  blueLight: THREE.PointLight;
  updateLights(elapsed: number, chasing: boolean, speedMps: number, dt: number): void;
}

export function createPoliceCarRig(
  liveryTex: THREE.Texture,
  contactShadowTex: THREE.Texture
): PoliceCarRig {
  const root = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 5.2),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.52,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  root.add(shadow);

  const whiteBodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.25,
    metalness: 0.15,
    clearcoat: 0.8,
  });
  const navyTrimMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a,
    roughness: 0.35,
    metalness: 0.2,
  });
  const liveryMat = new THREE.MeshStandardMaterial({
    map: liveryTex,
    roughness: 0.3,
    metalness: 0.1,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.1,
    metalness: 0.85,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.85,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.25,
    metalness: 0.85,
  });

  // Lower chassis
  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.62, 4.3), whiteBodyMat);
  lowerBody.position.set(0, 0.56, 0);
  lowerBody.castShadow = true;
  lowerBody.receiveShadow = true;
  root.add(lowerBody);

  // Side livery panels
  const sidePanelGeo = new THREE.PlaneGeometry(2.6, 0.56);
  const leftPanel = new THREE.Mesh(sidePanelGeo, liveryMat);
  leftPanel.rotation.y = -Math.PI / 2;
  leftPanel.position.set(-0.975, 0.56, 0);
  const rightPanel = new THREE.Mesh(sidePanelGeo, liveryMat);
  rightPanel.rotation.y = Math.PI / 2;
  rightPanel.position.set(0.975, 0.56, 0);
  root.add(leftPanel, rightPanel);

  // Hood navy stripe & bumpers
  const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.04, 1.15), navyTrimMat);
  hoodStripe.position.set(0, 0.875, -1.45);
  root.add(hoodStripe);

  const bumperGeo = new THREE.BoxGeometry(1.98, 0.22, 0.18);
  const frontBumper = new THREE.Mesh(bumperGeo, navyTrimMat);
  frontBumper.position.set(0, 0.34, -2.14);
  const rearBumper = new THREE.Mesh(bumperGeo, navyTrimMat);
  rearBumper.position.set(0, 0.34, 2.14);
  root.add(frontBumper, rearBumper);

  // Cabin + greenhouse glass
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.56, 2.1), whiteBodyMat);
  cabin.position.set(0, 1.14, 0.15);
  cabin.castShadow = true;
  root.add(cabin);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.44, 2.14), glassMat);
  windshield.position.set(0, 1.13, 0.15);
  root.add(windshield);

  // Headlights & Taillights
  const hlMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfef9c3,
    emissiveIntensity: 1.4,
  });
  const tlMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0xef4444,
    emissiveIntensity: 1.0,
  });
  [-0.68, 0.68].forEach((x) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.06), hlMat);
    hl.position.set(x, 0.6, -2.15);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tlMat);
    tl.position.set(x, 0.62, 2.15);
    root.add(hl, tl);
  });

  // Roof Lightbar (Red & Blue Beacons)
  const barBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.22, 0.06, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 })
  );
  barBase.position.set(0, 1.45, 0.05);
  root.add(barBase);

  const redBeaconMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 0.4,
    roughness: 0.15,
  });
  const blueBeaconMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    emissive: 0x3b82f6,
    emissiveIntensity: 0.4,
    roughness: 0.15,
  });
  const redBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.2), redBeaconMat);
  redBeacon.position.set(-0.3, 1.52, 0.05);
  const blueBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.2), blueBeaconMat);
  blueBeacon.position.set(0.3, 1.52, 0.05);
  root.add(redBeacon, blueBeacon);

  const redLight = new THREE.PointLight(0xff2222, 0, 16, 2);
  redLight.position.set(-0.4, 1.75, 0.05);
  const blueLight = new THREE.PointLight(0x2266ff, 0, 16, 2);
  blueLight.position.set(0.4, 1.75, 0.05);
  root.add(redLight, blueLight);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 18).rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.26, 12).rotateZ(Math.PI / 2);
  const wheels: THREE.Mesh[] = [];
  const wheelCoords: [number, number, number][] = [
    [-0.92, 0.34, -1.32],
    [0.92, 0.34, -1.32],
    [-0.92, 0.34, 1.32],
    [0.92, 0.34, 1.32],
  ];
  wheelCoords.forEach(([x, y, z]) => {
    const w = new THREE.Mesh(wheelGeo, tireMat);
    w.position.set(x, y, z);
    w.castShadow = true;
    w.add(new THREE.Mesh(rimGeo, rimMat));
    wheels.push(w);
    root.add(w);
  });

  return {
    root,
    wheels,
    redBeaconMat,
    blueBeaconMat,
    redLight,
    blueLight,
    updateLights(elapsed, chasing, speedMps, dt) {
      const spin = (speedMps * dt) / 0.34;
      wheels.forEach((w) => {
        w.rotation.x -= spin;
      });
      if (chasing) {
        const flash = Math.sin(elapsed * 16) > 0;
        redBeaconMat.emissiveIntensity = flash ? 4.2 : 0.2;
        blueBeaconMat.emissiveIntensity = flash ? 0.2 : 4.2;
        redLight.intensity = flash ? 6 : 0;
        blueLight.intensity = flash ? 0 : 6;
      } else {
        redBeaconMat.emissiveIntensity = 0.5;
        blueBeaconMat.emissiveIntensity = 0.5;
        redLight.intensity = 0;
        blueLight.intensity = 0;
      }
    },
  };
}

export function createTrafficCar(
  colorHex: number,
  contactShadowTex: THREE.Texture
): { root: THREE.Group; wheels: THREE.Mesh[] } {
  const root = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 4.9),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  root.add(shadow);

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: 0.28,
    metalness: 0.45,
    clearcoat: 0.7,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.12,
    metalness: 0.85,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.7,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.88 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.58, 4.1), paintMat);
  body.position.set(0, 0.54, 0);
  body.castShadow = true;
  root.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.52, 2.05), paintMat);
  cabin.position.set(0, 1.06, 0.14);
  cabin.castShadow = true;
  root.add(cabin);

  const windows = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.4, 1.92), glassMat);
  windows.position.set(0, 1.07, 0.14);
  root.add(windows);

  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 4.18), trimMat);
  bumper.position.set(0, 0.34, 0);
  root.add(bumper);

  // Lights
  const hlMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfef3c7,
    emissiveIntensity: 1.1,
  });
  const tlMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0xef4444,
    emissiveIntensity: 0.9,
  });
  [-0.64, 0.64].forEach((x) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.06), hlMat);
    hl.position.set(x, 0.56, -2.06);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.06), tlMat);
    tl.position.set(x, 0.58, 2.06);
    root.add(hl, tl);
  });

  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16).rotateZ(Math.PI / 2);
  const wheels: THREE.Mesh[] = [];
  (
    [
      [-0.88, 0.32, -1.25],
      [0.88, 0.32, -1.25],
      [-0.88, 0.32, 1.25],
      [0.88, 0.32, 1.25],
    ] as [number, number, number][]
  ).forEach(([x, y, z]) => {
    const w = new THREE.Mesh(wheelGeo, tireMat);
    w.position.set(x, y, z);
    w.castShadow = true;
    wheels.push(w);
    root.add(w);
  });

  return { root, wheels };
}

export function createPedestrian(
  shirtColor: number,
  pantsColor: number,
  contactShadowTex: THREE.Texture
): {
  root: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
} {
  const root = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.4,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.78 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.68 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });

  const legGeo = new THREE.CapsuleGeometry(0.06, 0.52, 4, 8);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.085, 0.36, 0);
  leftLeg.castShadow = true;
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.085, 0.36, 0);
  rightLeg.castShadow = true;
  root.add(leftLeg, rightLeg);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.48, 0.2), shirtMat);
  torso.position.set(0, 0.96, 0);
  torso.castShadow = true;
  root.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 10), skinMat);
  head.position.set(0, 1.34, 0);
  head.castShadow = true;
  root.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.132, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMat
  );
  hair.position.set(0, 1.36, 0);
  root.add(hair);

  const armGeo = new THREE.CapsuleGeometry(0.045, 0.36, 4, 8);
  const leftArm = new THREE.Mesh(armGeo, shirtMat);
  leftArm.position.set(-0.22, 0.96, 0);
  leftArm.castShadow = true;
  const rightArm = new THREE.Mesh(armGeo, shirtMat);
  rightArm.position.set(0.22, 0.96, 0);
  rightArm.castShadow = true;
  root.add(leftArm, rightArm);

  return { root, leftLeg, rightLeg, leftArm, rightArm };
}

export interface TrafficSignalRig {
  root: THREE.Group;
  setPhase(
    carGreen: boolean,
    carYellow: boolean,
    pedState: 'green' | 'blinking' | 'red',
    blinkOn: boolean
  ): void;
}

export interface CornerPedSignalRig {
  root: THREE.Group;
  setPedStates(
    ewCrosswalkPed: 'green' | 'blinking' | 'red',
    nsCrosswalkPed: 'green' | 'blinking' | 'red',
    blinkOn: boolean
  ): void;
}

export function createTrafficSignalPole(): TrafficSignalRig {
  const root = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.38,
    metalness: 0.78,
  });
  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.5,
  });

  // Main upright pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 5.6, 12), poleMat);
  pole.position.set(0, 2.8, 0);
  pole.castShadow = true;
  root.add(pole);

  // Horizontal arm extending over road
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 4.6, 10), poleMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(2.2, 5.25, 0);
  arm.castShadow = true;
  root.add(arm);

  // Vehicle traffic signal box (double-sided for high visibility)
  const carBox = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.58, 0.42), housingMat);
  carBox.position.set(2.7, 5.25, 0);
  root.add(carBox);

  const carRedMat = new THREE.MeshStandardMaterial({
    color: 0x450a0a,
    emissive: 0xef4444,
    emissiveIntensity: 0.1,
  });
  const carYellowMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.1,
  });
  const carGreenMat = new THREE.MeshStandardMaterial({
    color: 0x052e16,
    emissive: 0x22c55e,
    emissiveIntensity: 1.8,
  });

  const bulbGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.46, 14).rotateX(Math.PI / 2);
  const redBulb = new THREE.Mesh(bulbGeo, carRedMat);
  redBulb.position.set(2.15, 5.25, 0);
  const yellowBulb = new THREE.Mesh(bulbGeo, carYellowMat);
  yellowBulb.position.set(2.7, 5.25, 0);
  const greenBulb = new THREE.Mesh(bulbGeo, carGreenMat);
  greenBulb.position.set(3.25, 5.25, 0);
  root.add(redBulb, yellowBulb, greenBulb);

  // Large double-sided Pedestrian signal box mounted on pole
  const pedBox = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.04, 0.36), housingMat);
  pedBox.position.set(0, 2.75, 0);
  root.add(pedBox);

  const pedRedMat = new THREE.MeshStandardMaterial({
    color: 0x450a0a,
    emissive: 0xff2222,
    emissiveIntensity: 2.0,
  });
  const pedGreenMat = new THREE.MeshStandardMaterial({
    color: 0x052e16,
    emissive: 0x10b981,
    emissiveIntensity: 0.1,
  });

  const pedLensGeo = new THREE.BoxGeometry(0.38, 0.38, 0.4);
  const pedRed = new THREE.Mesh(pedLensGeo, pedRedMat);
  pedRed.position.set(0, 3.0, 0);
  const pedGreen = new THREE.Mesh(pedLensGeo, pedGreenMat);
  pedGreen.position.set(0, 2.5, 0);
  root.add(pedRed, pedGreen);

  return {
    root,
    setPhase(carGreen, carYellow, pedState, blinkOn) {
      carRedMat.emissiveIntensity = !carGreen && !carYellow ? 3.0 : 0.08;
      carYellowMat.emissiveIntensity = carYellow ? 3.0 : 0.08;
      carGreenMat.emissiveIntensity = carGreen ? 3.0 : 0.08;

      if (pedState === 'green') {
        pedRedMat.emissiveIntensity = 0.08;
        pedGreenMat.emissiveIntensity = 3.2;
      } else if (pedState === 'blinking') {
        pedRedMat.emissiveIntensity = 0.08;
        pedGreenMat.emissiveIntensity = blinkOn ? 3.2 : 0.15;
      } else {
        pedRedMat.emissiveIntensity = 3.0;
        pedGreenMat.emissiveIntensity = 0.08;
      }
    },
  };
}

/**
 * Dual-axis corner pedestrian signal bollard placed at all 4 corners of every intersection.
 * Shows large glowing double-sided Red/Green lenses for BOTH EW and NS crosswalks
 * so players can clearly read the signal from any corner or approach angle.
 */
export function createCornerPedestrianSignalPole(): CornerPedSignalRig {
  const root = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.78,
  });
  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.45,
  });

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.3, 12), poleMat);
  post.position.y = 1.65;
  post.castShadow = true;
  root.add(post);

  // Housing 1: faces North/South (for crossing the EW road: 'ew' crosswalk!)
  const boxEW = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.96, 0.34), housingMat);
  boxEW.position.set(0, 2.55, 0);
  root.add(boxEW);

  const ewRedMat = new THREE.MeshStandardMaterial({
    color: 0x450a0a,
    emissive: 0xff2222,
    emissiveIntensity: 2.5,
  });
  const ewGreenMat = new THREE.MeshStandardMaterial({
    color: 0x052e16,
    emissive: 0x10b981,
    emissiveIntensity: 0.1,
  });
  const lensGeoEW = new THREE.BoxGeometry(0.36, 0.36, 0.38);
  const ewRed = new THREE.Mesh(lensGeoEW, ewRedMat);
  ewRed.position.set(0, 2.78, 0);
  const ewGreen = new THREE.Mesh(lensGeoEW, ewGreenMat);
  ewGreen.position.set(0, 2.32, 0);
  root.add(ewRed, ewGreen);

  // Housing 2: faces East/West (for crossing the NS road: 'ns' crosswalk!), stacked slightly higher
  const boxNS = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.96, 0.54), housingMat);
  boxNS.position.set(0, 3.6, 0);
  root.add(boxNS);

  const nsRedMat = new THREE.MeshStandardMaterial({
    color: 0x450a0a,
    emissive: 0xff2222,
    emissiveIntensity: 2.5,
  });
  const nsGreenMat = new THREE.MeshStandardMaterial({
    color: 0x052e16,
    emissive: 0x10b981,
    emissiveIntensity: 0.1,
  });
  const lensGeoNS = new THREE.BoxGeometry(0.38, 0.36, 0.36);
  const nsRed = new THREE.Mesh(lensGeoNS, nsRedMat);
  nsRed.position.set(0, 3.83, 0);
  const nsGreen = new THREE.Mesh(lensGeoNS, nsGreenMat);
  nsGreen.position.set(0, 3.37, 0);
  root.add(nsRed, nsGreen);

  // Yellow safety cap on top
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.12, 12),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 })
  );
  cap.position.y = 4.14;
  root.add(cap);

  return {
    root,
    setPedStates(ewCrosswalkPed, nsCrosswalkPed, blinkOn) {
      if (ewCrosswalkPed === 'green') {
        ewRedMat.emissiveIntensity = 0.08;
        ewGreenMat.emissiveIntensity = 3.4;
      } else if (ewCrosswalkPed === 'blinking') {
        ewRedMat.emissiveIntensity = 0.08;
        ewGreenMat.emissiveIntensity = blinkOn ? 3.4 : 0.12;
      } else {
        ewRedMat.emissiveIntensity = 3.2;
        ewGreenMat.emissiveIntensity = 0.08;
      }

      if (nsCrosswalkPed === 'green') {
        nsRedMat.emissiveIntensity = 0.08;
        nsGreenMat.emissiveIntensity = 3.4;
      } else if (nsCrosswalkPed === 'blinking') {
        nsRedMat.emissiveIntensity = 0.08;
        nsGreenMat.emissiveIntensity = blinkOn ? 3.4 : 0.12;
      } else {
        nsRedMat.emissiveIntensity = 3.2;
        nsGreenMat.emissiveIntensity = 0.08;
      }
    },
  };
}

export function createRoadSign(texture: THREE.Texture, height = 2.65): THREE.Group {
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.35,
    metalness: 0.8,
  });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, height, 10), postMat);
  post.position.y = height / 2;
  post.castShadow = true;
  group.add(post);

  const boardBack = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, 1.12, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 })
  );
  boardBack.position.set(0, height - 0.15, 0);
  boardBack.castShadow = true;
  group.add(boardBack);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.06, 1.06),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.35 })
  );
  face.position.set(0, height - 0.15, 0.028);
  group.add(face);

  return group;
}

export function createStreetTree(seed: number): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.92 });
  const leafColors = [0x2f7d44, 0x3b8c52, 0x246a38];
  const foliageMat = new THREE.MeshStandardMaterial({
    color: leafColors[seed % leafColors.length],
    roughness: 0.85,
  });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 2.2, 8), trunkMat);
  trunk.position.y = 1.1;
  trunk.castShadow = true;
  group.add(trunk);

  const canopy1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 1), foliageMat);
  canopy1.position.set(0, 2.75, 0);
  canopy1.castShadow = true;
  const canopy2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 1), foliageMat);
  canopy2.position.set(0.45, 3.35, 0.25);
  canopy2.castShadow = true;
  const canopy3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 1), foliageMat);
  canopy3.position.set(-0.45, 3.25, -0.2);
  canopy3.castShadow = true;

  group.add(canopy1, canopy2, canopy3);
  return group;
}

export function createStreetLamp(): THREE.Group {
  const group = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.35,
    metalness: 0.8,
  });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfef08a,
    emissiveIntensity: 1.2,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 10), metalMat);
  base.position.y = 0.25;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.2, 10), metalMat);
  pole.position.y = 2.6;
  pole.castShadow = true;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.08), metalMat);
  arm.position.set(-0.55, 5.15, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.22), metalMat);
  head.position.set(-1.1, 5.12, 0);
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.16), bulbMat);
  bulb.position.set(-1.1, 5.06, 0);

  group.add(base, pole, arm, head, bulb);
  return group;
}

export interface BicycleRig {
  root: THREE.Group;
  frontWheel: THREE.Mesh;
  rearWheel: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
}

export function createBicycleRig(
  frameColor: number,
  shirtColor: number,
  contactShadowTex: THREE.Texture
): BicycleRig {
  const root = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 2.3),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.44,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  root.add(shadow);

  const frameMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: 0.3,
    metalness: 0.65,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.88 });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.3,
    metalness: 0.8,
  });

  // Wheels (radius 0.34m)
  const tireGeo = new THREE.TorusGeometry(0.32, 0.038, 10, 22);
  tireGeo.rotateY(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10).rotateZ(Math.PI / 2);

  const frontWheel = new THREE.Mesh(tireGeo, tireMat);
  frontWheel.position.set(0, 0.34, -0.56);
  frontWheel.castShadow = true;
  frontWheel.add(new THREE.Mesh(hubGeo, rimMat));

  const rearWheel = new THREE.Mesh(tireGeo, tireMat);
  rearWheel.position.set(0, 0.34, 0.56);
  rearWheel.castShadow = true;
  rearWheel.add(new THREE.Mesh(hubGeo, rimMat));
  root.add(frontWheel, rearWheel);

  // Diamond Frame
  const topTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.62, 8).rotateX(Math.PI / 2),
    frameMat
  );
  topTube.position.set(0, 0.72, -0.02);
  const downTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.7, 8),
    frameMat
  );
  downTube.rotation.x = 0.85;
  downTube.position.set(0, 0.52, -0.18);
  const seatTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.54, 8),
    frameMat
  );
  seatTube.rotation.x = -0.22;
  seatTube.position.set(0, 0.62, 0.22);
  const fork = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.74, 8),
    frameMat
  );
  fork.rotation.x = 0.22;
  fork.position.set(0, 0.68, -0.46);
  const handlebar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.52, 8).rotateZ(Math.PI / 2),
    rimMat
  );
  handlebar.position.set(0, 1.0, -0.38);
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.24), tireMat);
  saddle.position.set(0, 0.9, 0.28);
  root.add(topTube, downTube, seatTube, fork, handlebar, saddle);

  // Cyclist Rider with Helmet
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.72 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.65 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.25 });

  const legGeo = new THREE.CapsuleGeometry(0.055, 0.36, 4, 8);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.1, 0.68, 0.16);
  leftLeg.castShadow = true;
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.1, 0.68, 0.16);
  rightLeg.castShadow = true;
  root.add(leftLeg, rightLeg);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.44, 0.2), shirtMat);
  torso.rotation.x = 0.32;
  torso.position.set(0, 1.12, 0.12);
  torso.castShadow = true;
  root.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skinMat);
  head.position.set(0, 1.44, -0.02);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
    helmetMat
  );
  helmet.position.set(0, 1.46, -0.02);
  root.add(head, helmet);

  const armGeo = new THREE.CapsuleGeometry(0.042, 0.36, 4, 8);
  const armL = new THREE.Mesh(armGeo, shirtMat);
  armL.rotation.x = 1.05;
  armL.position.set(-0.19, 1.12, -0.14);
  const armR = new THREE.Mesh(armGeo, shirtMat);
  armR.rotation.x = 1.05;
  armR.position.set(0.19, 1.12, -0.14);
  root.add(armL, armR);

  return { root, frontWheel, rearWheel, leftLeg, rightLeg };
}

export interface PhoneWalkerRig {
  root: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  headGroup: THREE.Group;
}

export function createPhoneWalkerRig(
  shirtColor: number,
  pantsColor: number,
  contactShadowTex: THREE.Texture
): PhoneWalkerRig {
  const root = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.95),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.42,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.78 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.68 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });

  const legGeo = new THREE.CapsuleGeometry(0.06, 0.52, 4, 8);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.085, 0.36, 0);
  leftLeg.castShadow = true;
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.085, 0.36, 0);
  rightLeg.castShadow = true;
  root.add(leftLeg, rightLeg);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.48, 0.2), shirtMat);
  torso.position.set(0, 0.96, 0);
  torso.castShadow = true;
  root.add(torso);

  // Head tilted down staring at smartphone!
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.34, 0);
  headGroup.rotation.x = 0.42;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 10), skinMat);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.132, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMat
  );
  hair.position.y = 0.02;
  headGroup.add(head, hair);
  root.add(headGroup);

  // Arms raised holding glowing smartphone in front
  const armGeo = new THREE.CapsuleGeometry(0.044, 0.32, 4, 8);
  const leftArm = new THREE.Mesh(armGeo, shirtMat);
  leftArm.rotation.x = 0.95;
  leftArm.rotation.z = -0.22;
  leftArm.position.set(-0.18, 0.96, -0.14);
  const rightArm = new THREE.Mesh(armGeo, shirtMat);
  rightArm.rotation.x = 0.95;
  rightArm.rotation.z = 0.22;
  rightArm.position.set(0.18, 0.96, -0.14);
  root.add(leftArm, rightArm);

  // Glowing smartphone screen
  const phone = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.16, 0.015),
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x38bdf8,
      emissiveIntensity: 2.2,
      roughness: 0.15,
    })
  );
  phone.rotation.x = -0.75;
  phone.position.set(0, 0.96, -0.28);
  root.add(phone);

  return { root, leftLeg, rightLeg, headGroup };
}

export function createSchoolCampus(
  schoolBannerTex: THREE.Texture,
  buildingTex: THREE.Texture
): THREE.Group {
  const group = new THREE.Group();

  // School courtyard paved pad
  const yard = new THREE.Mesh(
    new THREE.BoxGeometry(28, 0.16, 22),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 })
  );
  yard.position.set(0, 0.08, 0);
  yard.receiveShadow = true;
  group.add(yard);

  // Main School Building (red-brick & glass facade with central clock tower)
  const brickMat = new THREE.MeshStandardMaterial({ color: 0x9f4a3c, roughness: 0.78 });
  const glassFacadeMat = new THREE.MeshStandardMaterial({
    map: buildingTex,
    roughness: 0.35,
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });

  const mainHall = new THREE.Mesh(new THREE.BoxGeometry(24, 10, 9), [
    brickMat,
    brickMat,
    roofMat,
    roofMat,
    glassFacadeMat,
    brickMat,
  ]);
  mainHall.position.set(0, 5.16, 5.5);
  mainHall.castShadow = true;
  mainHall.receiveShadow = true;
  group.add(mainHall);

  // Central Clock Tower
  const tower = new THREE.Mesh(new THREE.BoxGeometry(5.5, 4.5, 5.5), brickMat);
  tower.position.set(0, 12.2, 5.5);
  tower.castShadow = true;
  group.add(tower);

  const clockFace = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 0.12, 20).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0xfefce8,
      emissive: 0xfef08a,
      emissiveIntensity: 0.45,
    })
  );
  clockFace.position.set(0, 12.4, 2.72);
  group.add(clockFace);

  // Front School Gate Pillars & Overhead Arch ("푸른솔 학교 정문") facing North (-Z toward street)
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.65 });
  [-4.4, 4.4].forEach((px) => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 4.4, 1.1), pillarMat);
    pillar.position.set(px, 2.36, -9.8);
    pillar.castShadow = true;
    group.add(pillar);
  });

  const archBeam = new THREE.Mesh(
    new THREE.BoxGeometry(10.2, 1.6, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 })
  );
  archBeam.position.set(0, 4.9, -9.8);
  archBeam.castShadow = true;
  group.add(archBeam);

  const bannerFace = new THREE.Mesh(
    new THREE.PlaneGeometry(9.6, 1.35),
    new THREE.MeshStandardMaterial({ map: schoolBannerTex, roughness: 0.35 })
  );
  bannerFace.rotation.y = Math.PI; // Faces -Z (toward the street/bike lane)
  bannerFace.position.set(0, 4.9, -10.27);
  group.add(bannerFace);

  const bannerFront = bannerFace.clone();
  bannerFront.rotation.y = 0;
  bannerFront.position.set(0, 4.9, -9.33);
  group.add(bannerFront);

  return group;
}
