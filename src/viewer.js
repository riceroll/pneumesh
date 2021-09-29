import logo from './logo.svg';
import './style.css';
import React, {useRef, useState, useMemo, useEffect, useReducer} from 'react'
import * as THREE from 'three'
import { extend, Canvas, useFrame, useThree, useResource, useUpdate } from 'react-three-fiber'

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {TransformControls, Stats} from "drei";
// import { EffectComposer, Outline } from 'react-postprocessing'
extend({OrbitControls})

const cWhite = new THREE.Color(0.6, 0.6, 0.6);
const cChannels = [
  new THREE.Color(0.1, 0.3, 0.6),
  new THREE.Color(0.5, 0.4, 0.1),
  new THREE.Color(0.5, 0.1, 0.5),
  new THREE.Color(0.1, 0.5, 0.2),
  new THREE.Color(0.6, 0.1, 0.4),
];
const cPureWhite = new THREE.Color(1, 1, 1);
const cBlack = new THREE.Color(0.05, 0.05, 0.05);
const cSelected = new THREE.Color(0.9, 0.0, 0.0);
const cHovered = new THREE.Color(0.9, 0.05, 0.0);
const cFixed = new THREE.Color(0.2, 0.6, 0.6);
const cPassive = new THREE.Color(0.15, 0.15, 0.15);
const dIn = 0.05;     // diameter of the inner piston
const dOut = 0.065;    // diameter of the outer piston
const dConstraint = 0.06;    // diameter of the constraint
const lConstraint = 0.04;    // length of the constraint
const lPiston = 0.527;       // length of each half piston
const lTube = 0.330;         // length of tube of each joint
const dTube = 0.026;  // diameter of joint tubes
const dJoint = 0.06;    // diameter of the joint ball
const fps = 30;
const viewChannel = false;
window.fps = fps;

function Ball({v, d, c, model, handleClick, handlePointerOver, handlePointerOut, setOControls, translating}) {

  const mesh=useRef();
  const material = useRef();
  const transControls = useRef();
  const [dragging, setDragging] = useState(false);
  const prevPos = new THREE.Vector3();

  useFrame((state)=>{

    if (mesh.current === null)  return;

    mesh.current.position.copy(v);
    material.current.color.copy(c);


    if (translating) {
      const controls = transControls.current;
      if (dragging)  {
        v.copy(controls.worldPosition.clone().add(controls.position));
        mesh.current.position.copy(v);
      }
      else {
        transControls.current.position.copy(v);
      }
    }
  });

  useEffect(()=>{
    const callbackDraggingChanged = (e) => {
      setOControls(!e.value);
      setDragging(e.value);

      const controls = e.target;
      if (e.value ===false) {
        controls.object.position.multiplyScalar(0);
        model.simulate=true;
        model.recordHistory();
      }
      else {
        // model.simulate=false;
        prevPos.copy(controls.worldPosition);
      }
    }

    const controls = transControls.current;
    controls.position.copy(v);
    if (controls) {
      controls.addEventListener('dragging-changed', callbackDraggingChanged);
      return () => {
        controls.removeEventListener('dragging-changed', callbackDraggingChanged);
      }
    }
  })

  return(
    <TransformControls
      ref={transControls}
      enabled={translating}
      showX={translating}
      showY={translating}
      showZ={translating}
      mode={"translate"}
      space={"local"}
    >
      <mesh
        ref={mesh}
        position={v}
        castShadow={true}
        scale={[d, d, d]}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereBufferGeometry args={[1, 20, 20]}/>
        {
          viewChannel?
          <meshBasicMaterial
          ref={material}
          color={cBlack}
          transparent={true}
          opacity={0.4}
        />
        :
            <meshLambertMaterial
              ref={material}
              color={c}
            />
        }
      </mesh>
    </TransformControls>
  )
}

function Joint({v, iv, model, setOControls, sharedData}) {
  const selected = (model.vStatus[iv] === 2);
  const hovered = (model.vStatus[iv] === 1);
  const fixed = false;
  const [translating, setTranslating] = useState(false);
  const color = new THREE.Color();

  useFrame((sate)=>{
    const selected = (model.vStatus[iv] === 2);
    const hovered = (model.vStatus[iv] === 1);
    const fixed = model.fixedVs[iv];
    color.copy(selected?cSelected:hovered?cHovered:fixed?cFixed:cWhite);
    if (sharedData.movingJoint && model.vStatus[iv] === 2 && !translating) {
      setTranslating(true);
    }
    if ((!sharedData.movingJoint || model.vStatus[iv] !== 2) && translating) {
      setTranslating(false);
    }
  });

  const handleClick = (e)=>{
    if (sharedData.removingJoint) {
      model.removeJoint(iv);
      model.precompute();
      model.recordV();
      model.forceUpdate();
    }
    else if(sharedData.addingJoint){
      model.addJoint(iv);
      model.precompute();
      model.recordV();
      model.forceUpdate();
    }
    else if (sharedData.movingJoint) {
      model.vStatus.fill(0);
      model.vStatus[iv] = 2;
    }
    else {
      model.vStatus[iv] = 2;
    }
    sharedData.updateGUI();
    e.stopPropagation();
  }

  const handlePointerOver = (e)=>{
    if (model.vStatus[iv] !== 2) model.vStatus[iv] = 1;
    e.stopPropagation();
  }
  const handlePointerOut = (e)=>{
    if (model.vStatus[iv] !== 2) model.vStatus[iv] = 0;
    e.stopPropagation();
  }

  return(
    <Ball key={"ball"} v={v} d={dJoint}
          model={model}
          handleClick={handleClick}
          handlePointerOver={handlePointerOver}
          handlePointerOut={handlePointerOut}
          setOControls={setOControls}
          translating={translating}
          c={color}/>
  )
}

function Cylinder({v0, v1, d, c, opacity, transparent, handleClick, handlePointerOver, handlePointerOut }) {
  const mesh = useRef();
  const material = useRef();

  const update = (v0, v1)=>{
    const pos = v0.clone().add(v1).divideScalar(2);
    const vec = v1.clone().sub(v0);
    const axis = new THREE.Vector3(0, 1, 0);

    const l = vec.length();
    vec.normalize();

    const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, vec);
    const euler = new THREE.Euler().setFromQuaternion(quaternion);
    return [pos, l, euler]
  }

  const [pos, l, euler] = update(v0, v1);

  useFrame((state)=>{
    if (mesh.current === null)  return;   // TODO: why?

    const [pos, l, euler] = update(v0, v1);
    mesh.current.position.copy(pos);
    mesh.current.rotation.copy(euler);
    mesh.current.scale[1] = l;
    material.current.color.copy(c);
  })

  return (
    <mesh
      ref={mesh}
      position={[pos.x, pos.y, pos.z]}
      rotation={euler}
      castShadow={true}
      scale={[d, l, d]}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <cylinderBufferGeometry args={[1, 1, 1, 20]} />
      {
        viewChannel?
        <meshBasicMaterial
        ref={material}
        color={c}
        opacity={opacity}
        transparent={transparent}
      />
      :
          <meshLambertMaterial
            ref={material}
            color={c}
          />
      }
    </mesh>
  )
}

function Beam({v0, v1, ie, model, sharedData
              }) {
  let vec = v1.clone().sub(v0);
  let l = vec.length();
  vec.normalize();
  const vecPiston = vec.clone().multiplyScalar(lPiston);
  const vecTube = vec.clone().multiplyScalar(lTube);
  const vecConstraint = vec.clone().multiplyScalar(lConstraint);

  const vOut0 = vecTube.clone().add(v0);
  const vOut1 = vOut0.clone().add(vecPiston);
  const vIn0 = v1.clone().sub(vecTube);
  const vIn1 = vIn0.clone().sub(vecPiston);
  const vTube00 = v0.clone();
  const vTube01 = v0.clone().add(vecTube);
  const vTube11 = v1.clone();
  const vTube10 = v1.clone().sub(vecTube);
  const vConstraint0 = vIn0.clone().sub(vec.clone().multiplyScalar(
    model.lMax[ie] * (model.Model.maxMaxContraction - model.maxContraction[ie])));
  const vConstraint1 = vConstraint0.clone().add(vecConstraint);

  const cOut = new THREE.Color();
  const cIn = new THREE.Color();
  const cJoint = new THREE.Color();
  const cBeam = new THREE.Color();
  const cInner = new THREE.Color();

  const changeColor =()=>{
    const c = cChannels[model.edgeChannel[ie]];
    if (sharedData.showChannel) {
      const selected = (model.eStatus[ie] === 2);
      const hovered = (model.eStatus[ie] === 1);
      cOut.copy(selected ? cSelected : hovered ? cHovered : c);
      cIn.copy(selected ? cSelected : hovered ? cHovered : c);
      cJoint.copy(selected ? cSelected : hovered ? cHovered : c);
      cBeam.copy(selected ? cSelected : hovered ? cHovered : c);
    }
    else {
      const selected = (model.eStatus[ie] === 2);
      const hovered = (model.eStatus[ie] === 1);
      cOut.copy(selected ? cSelected : hovered ? cHovered : cBlack);
      cIn.copy(selected ? cSelected : hovered ? cHovered : cWhite);
      cJoint.copy(selected ? cSelected : hovered ? cHovered : cWhite);
      cBeam.copy(selected ? cSelected : hovered ? cHovered : cPassive);
      cInner.copy(c);
    }
    cInner.copy(c);
    if (viewChannel) {
      cOut.copy(cBlack);
      cIn.copy(cBlack);
      cJoint.copy(cBlack);
    }
  }
  changeColor();

  useFrame((state)=>{
    let vec = v1.clone().sub(v0);
    let l = vec.length();
    vec.normalize();
    const vecPiston = vec.clone().multiplyScalar(lPiston);
    const vecTube = vec.clone().multiplyScalar(lTube);
    const vecConstraint = vec.clone().multiplyScalar(lConstraint);
    vOut0.copy(vecTube.clone().add(v0));
    vOut1.copy(vOut0.clone().add(vecPiston));
    vIn0.copy(v1.clone().sub(vecTube));
    vIn1.copy(vIn0.clone().sub(vecPiston));
    vTube00.copy(v0.clone());
    vTube01.copy(v0.clone().add(vecTube));
    vTube11.copy(v1.clone());
    vTube10.copy(v1.clone().sub(vecTube));
    vConstraint0.copy(vIn0.clone().sub(vec.clone().multiplyScalar(
      model.lMax[ie] * (model.Model.maxMaxContraction - model.maxContraction[ie]) )));
    vConstraint1.copy(vConstraint0.clone().add(vecConstraint));
    try {
      changeColor();
    } catch(error) {
      console.log('error: changeColor');
    }
  });

  const handleClick = (e)=>{
    model.eStatus[ie] = 2;
    e.stopPropagation();
  }
  const handlePointerOver = (e)=>{
    if (model.eStatus[ie] !== 2) {model.eStatus[ie] = 1;}
    e.stopPropagation();

    if (sharedData.showInfo) sharedData.infoPanel.style.display = 'block';
    sharedData.infoPanel.style.left = String(e.clientX) + 'px';
    sharedData.infoPanel.style.top = String(e.clientY) + 'px';
    while (sharedData.infoPanel.firstChild) sharedData.infoPanel.removeChild(sharedData.infoPanel.firstChild);
    sharedData.infoPanel.appendChild(sharedData.infoPanel.ownerDocument.createTextNode(
      "L: " + String(Math.round(model.l[ie] * 1000) / 1000 / 1.2 * 93 ) + "mm",
    ));
    sharedData.infoPanel.appendChild(sharedData.infoPanel.ownerDocument.createElement("br"));
    sharedData.infoPanel.appendChild(sharedData.infoPanel.ownerDocument.createTextNode(
      "S: " + String(Math.round(model.l[ie] * 1000) / 1000 / 1.2 * 62 ) + "mm",
    ));
  }
  const handlePointerOut = (e)=>{
    if (model.eStatus[ie] !== 2) {model.eStatus[ie] = 0;}
    e.stopPropagation();
    sharedData.infoPanel.style.display = "none";
  }

  const opacity = viewChannel? 0.15 : 1.0;
  const transpacency = viewChannel;

  const cylinders = [
    <Cylinder key="out" v0={vOut0} v1={vOut1} d={dOut} c={cOut} opacity={opacity} transparent={transpacency}
              handleClick={handleClick} handlePointerOver={handlePointerOver} handlePointerOut={handlePointerOut}/>,
    <Cylinder key="in" v0={vIn0} v1={vIn1} d={dIn} c={cIn} opacity={opacity} transparent={transpacency}
              handleClick={handleClick} handlePointerOver={handlePointerOver} handlePointerOut={handlePointerOut}/>,
    <Cylinder key="joint0" v0={vTube00} v1={vTube01} d={dTube} c={cJoint} opacity={opacity} transparent={transpacency}
              handleClick={handleClick} handlePointerOver={handlePointerOver} handlePointerOut={handlePointerOut}/>,
    <Cylinder key="joint1" v0={vTube10} v1={vTube11} d={dTube} c={cJoint} opacity={opacity} transparent={transpacency}
              handleClick={handleClick} handlePointerOver={handlePointerOver} handlePointerOut={handlePointerOut}/>
    ];

  if (viewChannel) {
    cylinders.push(
      <Cylinder key="inner" v0={vTube00} v1={vTube11} d={dTube * 0.5} c={cInner} opacity={2} transparent={false}
              handleClick={handleClick} handlePointerOver={handlePointerOver} handlePointerOut={handlePointerOut}/>)
  }

  if (model.maxContraction[ie] !== model.Model.maxMaxContraction) {
    cylinders.push(<Cylinder key="constraint" v0={vConstraint0} v1={vConstraint1} d={dConstraint} c={cBlack}/>);
  }

  if (model.edgeActive[ie]) {
    return (cylinders)
  }
  else {
    return (
      [<Cylinder key="beam" v0={v0} v1={v1} d={dTube} c={cBeam} opacity={opacity} transparent={false}
                handleClick={handleClick} handlePointerOver={handlePointerOver}
                 handlePointerOut={handlePointerOut}/>]
    )
  }

}

function Triangle({vertices, c, opacity, handleClick, handlePointerOver, handlePointerOut}) {
  const mesh = useRef();
  const [,forceUpdate] = useReducer(x=>x+1, 0);
  let vs = [];
  for (let v of vertices) {
    vs.push(v.x, v.y, v.z);
  }
  const f32array = Float32Array.from(vs);

  return (
    <mesh
      ref={mesh}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <bufferGeometry attach={"geometry"}>
        <bufferAttribute
          attachObject={["attributes", "position"]}
          args={[f32array,3]}
        />
      </bufferGeometry>
      <meshBasicMaterial
        color={c}
        opacity={opacity}
        transparent={true}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}

function Face({vertices, model, sharedData, i}) {

  const color = new THREE.Color();
  color.copy(model.fStatus[i] === 2 ? cSelected : model.fStatus[i] === 1 ? cHovered : cBlack);

  const handleClick = (e)=>{
    if (model.editing) {
      // model.fStatus[i] = 2;
      e.stopPropagation();
      if (sharedData.addingJoint) {
        model.addPolytope(i);
        model.forceUpdate();
      }
    }
  }

  const handlePointerOver = (e)=>{
    if (model.editing) {
      if (model.fStatus[i] !== 2) model.fStatus[i] = 1;
      e.stopPropagation();
    }
  }

  const handlePointerOut = (e)=>{
    if (model.editing) {
      if (model.fStatus[i] !== 2) model.fStatus[i] = 0;
      e.stopPropagation();
    }
  }

  const [,forceUpdate] = useReducer(x=>x+1, 0);

  useFrame( ()=>{
    if (model.editing) forceUpdate();
  })

  return (
    <Triangle vertices={vertices} c={color} opacity={model.editing?0.2:0}
              handleClick={handleClick} handlePointerOver={handlePointerOver} handlePointerOut={handlePointerOut}
    />
  )
}

function PneuMesh({
  model,
  sharedData,
  setOControls
}) {

  const [clock] = React.useState(new THREE.Clock());
  useFrame((state)=>{
    const timeUntilNextFrame = (1000 / fps) - clock.getDelta();
    setTimeout(()=>
      {
        state.ready=true;
        state.invalidate();
      },
      Math.max(0, timeUntilNextFrame)
    )
    state.ready=false;
    const nStepsPerSecond = 1 / model.Model.h;
    model.step(Math.floor((1.5 / model.Model.h ) / fps));
    if (model.iAction !== model.iActionPrev) {
      sharedData.updateGUI();
      model.iActionPrev = model.iAction;
    }
  }, 0)


  const joints=[];
  const beams=[];
  const faces = [];

  for (let [i, v] of model.v.entries()) {
    joints.push(
      <Joint
        key={("J" + String(i))}
        v={v}
        iv={i}
        model={model}
        setOControls={setOControls}
        sharedData={sharedData}
      />
    )
  }

  for (let [i, e] of model.e.entries()) {
    const v0 = model.v[e[0]];
    const v1 = model.v[e[1]];
    beams.push(
      <Beam
        key={("B"+String(i))}
        v0={v0}
        v1={v1}
        ie={i}
        model={model}
        sharedData={sharedData}
        selected={e.selected}
        hovered={e.hovered}
      />
      )
  }

  // for (let [i, f] of model.faces.entries()) {
  //   const vertices = f.map(iv=>model.v[iv]);
  //   faces.push(
  //     <Face key={"F" + String(i)} vertices={vertices} sharedData={sharedData} model={model} i={i}/>
  //   );
  // }

  return ([...joints, ...beams])
}


function DLight() {
  const light = new THREE.DirectionalLight(new THREE.Color(1,1,1), 1.5);
  light.position.set(0, 0, 5);
  light.castShadow = true;
  let mapSize = 30
  light.shadow.mapSize.width = 20 * mapSize;
  light.shadow.mapSize.height = 20 * mapSize;
  light.shadow.camera.top = -3 * mapSize;
  light.shadow.camera.right = 3 * mapSize;
  light.shadow.camera.left = -3 * mapSize;
  light.shadow.camera.bottom = 3 * mapSize;
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = 500;
  return (<primitive object={light}/>)
}

const Controls = ({oControls}) => {

  const {
    camera,
    gl: { domElement },
  } = useThree();
  /* Invoke the OrbitControls' update function on every frame */
  useFrame(() => oControls.current.update())

  return <orbitControls ref={oControls} args={[camera, domElement]}/>
}

function Viewer({model, sharedData}) {
  const oControls = useRef();
  model.controls = oControls;
  const [, forceUpdate] = useReducer(x => { return (x+1)}, 0);
  model.forceUpdate = forceUpdate;
  window.updateModel = forceUpdate;
  model.recordHistory();

  function setOControls(s){
    oControls.current.enabled = s
  }

  return (
      <Canvas
        shadowMap={true}
        concurrent={true}
        onCreated={({gl, camera}) => {
          // let intensity = 0.92
          let intensity = 1.0
          gl.setClearColor(new THREE.Color(intensity, intensity, intensity))
          gl.setPixelRatio(window.devicePixelRatio);  // required
          gl.shadowMap.enabled=true;  // default
          gl.shadowMap.type=THREE.PCFSoftShadowMap; // default
        }}
        camera={{
          fov: 45,
          position:[0, -20, 1],
          up:[0, 0, 1]
        }}

        gl={{antialias:true}}
      >
        <Controls oControls={oControls}/>
        <ambientLight
          color={new THREE.Color(1, 1, 1)}
          intensity={0.5}
        />

        <DLight/>

        <mesh
          position={[0, 0, 0]}
          receiveShadow={true}
          visible={true}
        >
          <planeGeometry args={[10000, 10000]}/>
          <shadowMaterial opacity={0.3}/>
        </mesh>

        <gridHelper
          args={[100, 100]}
          rotation-x={-Math.PI/2}
          position-z={0}
          visible={true}
        />

        <PneuMesh model={model} sharedData={sharedData} setOControls={setOControls}/>
        {/*<Stats/>*/}

      </Canvas>
  );
}

export default Viewer;
