import * as thre from 'three';
import React, {useRef, useState, useMemo} from 'react'

class Vertex {
  static all = [];

  constructor(pos, fixed, pos0, vel, force) {
    this.pos = pos;     // thre.Vector3
    this.fixed = fixed;
    this.pos0 = pos0;
    this.vel = vel;
    this.force =force;
    this.vs =[];  // neighbor vertices
    this.es = [];   // neighbor edges
    this.fs = [];   // incident faces

    this.id = Vertex.all.length;
    Vertex.all.push(this);
  }

  facesOnTheOtherSide() {
    // const fs = [];
    // for (const f of Face.all) {
    //   let onTheOtherSide = true;
    //   for (const v of f.vs) {
    //     if (!v.vs.includes(v)) {
    //       onTheOtherSide = false;
    //       break;
    //     }
    //   }
    //   if (onTheOtherSide) fs.push(f);
    // }
    // return fs;
  }
}

class Edge {
  static all = [];

  constructor(vs, lMax, maxContraction, edgeChannel, edgeActive, l) {
    this.vs = [];
    this.lMax = lMax;
    this.maxContraction = maxContraction;
    this.edgeChannel = edgeChannel;
    this.edgeActive = edgeActive;
    this.l = l;

    for (let iv of vs) {
      this.vs.push(Vertex.all[iv]);
    }
    Vertex.all[vs[0]].vs.push(Vertex.all[vs[1]]);
    Vertex.all[vs[1]].vs.push(Vertex.all[vs[0]]);
    Vertex.all[vs[0]].es.push(this);
    Vertex.all[vs[1]].es.push(this);

    this.id = Edge.all.length;
    Edge.all.push(this);
  }

}




class Model {
  static k = 200000;
  static h = 0.001;
  static dampingRatio = 0.992;
  static contractionInterval = 0.075;
  static contractionSteps = 4;
  static maxMaxContraction = Math.round(Model.contractionInterval * Model.contractionSteps * 100) /100;
  static contractionPercentRate = 5e-4 ;  // contraction percentage change ratio, per time step
  static gravityFactor = 9.8;
  static gravity = 1;     // if gravity is on
  static defaultMinLength = 1.2;
  static defaultMaxLength = Model.defaultMinLength / (1 - Model.maxMaxContraction);
  static frictionFactor = 0.8;
  static numStepsAction = 2 / Model.h;
  static defaultNumActions = 1;
  static defaultNumChannels = 4;

  constructor() {
    this.viewer = null;

    this.Vertex = Vertex;
    this.Edge = Edge;
    this.Model = Model;
    this.controls = null;
    this.sharedData = null;

    this.reset();

    this.loadData();
    this.resetSelection();
    this.recordV();
  }

  reset() {
    // input data
    this.v = [];  // vertex positions: nV x 3
    this.e = [];  // edge positions: nE x 2
    this.v0 = [];
    this.fixedVs = [];  // id of vertices that are fixed
    this.lMax = []; // maximum length
    this.edgeActive = [];  // if beam is active: nE
    this.edgeChannel = [];  // id of beam edgeChannel: nE
    this.script = [];    // nTimeSteps x nChannels

    // update at every step
    this.maxContraction = [];  // percentage of maxMaxContraction: nE
    this.vel = [];  // vertex velocities: nV x 3
    this.f = [];  // vertex forces: nV x 3
    this.l = [];    // current length of beams: nE

    // interface
    this.vStatus = [];    // 0: none, 1: hovered; 2: selected
    this.eStatus = [];    // 0: none, 1: hovered; 2: selected
    this.fStatus = [];    // 0: none, 1: hovered; 2: selected

    // statistics
    this.iAction = 0;
    this.numSteps = 0;
    this.timeStart = new Date();

    // status
    this.editing = false;
    this.simulate = true;
    this.gravity = true;
    this.directional = false;
    this.euler = new thre.Euler(0, 0, 0);

    // channel status
    this.numChannels = Model.defaultNumChannels;
    this.numActions = Model.defaultNumActions;
    this.inflateChannel = new Array(this.numChannels).fill(false);
    this.contractionPercent = new Array(this.numChannels).fill(1);  // contraction percentage of each channel, 0-1

  }

  loadDict(data) {
    // load a dictionary
    let v = [];
    let e = Array.from(data.e);
    let f = Array.from(data.f);
    let p = Array.from(data.p);
    for (let i=0; i<data.v.length; i++) {
      v.push(new thre.Vector3(data.v[i][0], data.v[i][1], data.v[i][2]));
    }
    this.reset();
    if (data.lMax) {
      let lMax = data.lMax;
      let maxContraction = data.maxContraction;
      let fixedVs = data.fixedVs;
      let edgeChannel = data.edgeChannel;
      let edgeActive = data.edgeActive;
      this.loadData(v, e, f, p, lMax, maxContraction, fixedVs, edgeChannel, edgeActive);
    }
    else {
      this.loadData(v, e, f, p);
    }
    this.resetSelection();
    this.recordV();
  }

  loadData(v, e, f, p, lMax=null, maxContraction=null, fixedVs=null, edgeChannel=null, edgeActive=null, script=[]){
    if (v && e) {
      this.v = v;
      this.e = e;
    }
    else{
      this.v.push(new thre.Vector3(1, -1/Math.sqrt(3), 0.2));
      this.v.push(new thre.Vector3(0, 2/Math.sqrt(3), 0.2));
      this.v.push(new thre.Vector3(-1, -1/Math.sqrt(3), 0.2));
      this.v.push(new thre.Vector3(0, 0, 4/Math.sqrt(6) + 0.2));

      this.e.push([0, 1]);
      this.e.push([1, 2]);
      this.e.push([2, 0]);
      this.e.push([0, 3]);
      this.e.push([1, 3]);
      this.e.push([2, 3]);
    }
    // rescale
    let currentLm = this.v[0].distanceTo(this.v[1]) / (1 - Model.maxMaxContraction);
    for (let i=0; i<this.v.length; i++) {
      this.v[i].divideScalar(currentLm);
      this.v[i].multiplyScalar(Model.defaultMaxLength);
    }

    this.recordV();

    if (fixedVs) this.fixedVs = fixedVs;
    if (lMax) this.lMax = lMax;
    if (maxContraction) this.maxContraction = maxContraction;
    if (edgeActive) this.edgeActive = edgeActive;
    if (edgeChannel) this.edgeChannel = edgeChannel;
    if (script) this.script = script;
    this.resetSelection();

    this.precompute();
  }

  saveData() {
    let data = {};
    data.v = [];
    for (let v of this.v) {
      data.v.push([v.x, v.y, v.z]);
    }
    data.e = this.e;
    data.lMax = this.lMax;
    data.maxContraction = this.maxContraction;
    data.fixedVs =this.fixedVs;
    data.edgeChannel = this.edgeChannel;
    data.edgeActive = this.edgeActive;
    return data;
  }

  resetSelection() {

    this.vStatus = new Array(this.v.length).fill(0);
    this.eStatus = new Array(this.e.length).fill(0);
    this.fStatus = new Array(this.f.length).fill(0);
  }

  recordV() {
    this.v0 = [];
    let bbox = this.bbox();
    let zOffset = -bbox[5];

    for (let v of this.v) {
      let vv = v.clone();
      vv.z += zOffset;
      this.v0.push(vv);
    }
  }

  resetV() {
    this.iAction = 0;
    this.numSteps = 0;

    for (let i=0; i<this.v.length; i++) {
      this.v[i].copy(this.v0[i]);
    }

    this.numSteps = 0;
  }

  precompute() {
    const copyArrays = (oldValue, newValue)=>{
      for (let i=0; i<Math.min(oldValue.length, newValue.length); i++) {
        newValue[i] = oldValue[i];
      }
      return newValue;
    }

    this.l = [];
    for (let i=0; i<this.e.length; i++) {
      let e = this.e[i];
      this.l.push(this.v[e[0]].distanceTo(this.v[e[1]]));
    }

    if (this.vel.length !== this.v.length) {
      this.vel = [];
      for (let i=0; i<this.v.length; i++) {
        this.vel.push(new thre.Vector3());
      }
    }
    if (this.maxContraction.length !== this.e.length) {
      const newValue = new Array(this.e.length).fill(Model.maxMaxContraction);
      this.maxContraction = copyArrays(this.maxContraction, newValue);
    }
    if (this.fixedVs.length !== this.v.length) {
      const newValue = new Array(this.v.length).fill(false);
      this.fixedVs = copyArrays(this.fixedVs, newValue);
    }
    if (this.lMax.length !== this.e.length) {
      const newValue = new Array(this.e.length).fill(Model.defaultMaxLength);
      this.lMax = copyArrays(this.lMax, newValue);
    }
    if (this.edgeActive.length !== this.e.length) {
      const newValue = new Array(this.e.length).fill(true);
      this.edgeActive = copyArrays(this.edgeActive, newValue);
    }
    if (this.edgeChannel.length !== this.e.length) {
      const newValue = new Array(this.e.length).fill(0);
      this.edgeChannel = copyArrays(this.edgeChannel, newValue);
    }
    if ((this.script.length !== this.numChannels)
      || (this.script.length && this.script[0].length !== this.numActions))
    {
      const newValue = Array(this.numChannels).fill(false).map(_=>Array(this.numActions).fill(false));
      if (this.script.length === 0) this.script = newValue;

      for (let iChannel=0; iChannel<Math.min(this.script.length, newValue.length); iChannel++) {
        for (let iAction=0; iAction<Math.min(this.script[0].length, newValue[0].length); iAction++) {
          newValue[iChannel][iAction] = this.script[iChannel][iAction];
        }
      }
      this.script = newValue;
    }

  }

  update() {
    // initialize forces
    this.f = [];
    for (let i=0; i<this.v.length; i++) {
      this.f.push(new thre.Vector3());
    }

    // length maxContraction
    for (let i=0; i<this.e.length; i++) {
      let e = this.e[i];
      let v0 = this.v[e[0]];
      let v1 = this.v[e[1]];

      let vec = v1.clone().sub(v0); // from 0 to 1

      let l0 = this.lMax[i];
      if (this.edgeActive[i]) {
        let iChannel = this.edgeChannel[i];
        let lMax = l0;
        let lMin = lMax * (1 - this.maxContraction[i]);
        l0 = lMax - this.contractionPercent[iChannel] * (lMax - lMin);
      }

      let d = vec.length() - l0;
      let f = (d) * Model.k;
      f = vec.normalize().multiplyScalar(f);  // from 0 to 1
      this.f[e[0]].add(f);
      this.f[e[1]].add(f.negate());
    }

    // gravity
    for (let i=0; i<this.v.length; i++) {
      if (this.gravity) {
        this.f[i].add(new thre.Vector3(0, 0, -Model.gravityFactor * Model.gravity));
      }
    }

    // friction
  }

  runScript() {
    if (this.script.length === 0) return 0;

    if (this.numSteps > ((this.iAction + 1) % this.numActions) * Model.numStepsAction ) {
      this.iAction = Math.floor(this.numSteps / Model.numStepsAction) % this.numActions;

      for (let iChannel=0; iChannel<this.numChannels; iChannel++) {
        this.inflateChannel[iChannel] = this.script[iChannel][this.iAction];
      }
    }
  }

  step(n=1, scripting = true) {

    for (let iStep=0; iStep<n; iStep++) {
      this.precompute();
      if (!this.simulate) {return}

      if (scripting) {
        this.runScript();
      }
      this.update();

      if (this.editing) {
        // this.center();
      }

      // update contraction percentage
      for (let i=0; i<this.inflateChannel.length; i++) {
        if (this.inflateChannel[i]) {
          this.contractionPercent[i] -= Model.contractionPercentRate;
          if (this.contractionPercent[i] < 0) {
            this.contractionPercent[i] = 0;
          }
        }
        else {
          this.contractionPercent[i] += Model.contractionPercentRate;
          if (this.contractionPercent[i] > 1) {
            this.contractionPercent[i] = 1;
          }
        }
      }

      for (let i=0; i<this.v.length; i++) {
        if (this.fixedVs[i]) continue;

        if (this.sharedData.movingJoint && this.vStatus[i] !== 2) continue;

        this.vel[i].add(this.f[i].clone().multiplyScalar(Model.h));
        if (this.v[i].z <= 0) {
          // friction
          if (this.directional) {
            if (this.vel[i].x < 0) this.vel[i].x *= (1 - Model.frictionFactor);
            if (this.vel[i].y < 0) this.vel[i].y *= (1 - Model.frictionFactor);
          }
          else {
            this.vel[i].x *= (1 - Model.frictionFactor);
            this.vel[i].y *= (1 - Model.frictionFactor);
          }
        }

        this.vel[i].multiplyScalar(Model.dampingRatio);   // damping
        while (this.vel[i].length() > 5) {
          this.vel[i].multiplyScalar(0.9);
        }

        this.v[i].add(this.vel[i].clone().multiplyScalar(Model.h));

      }

      for (let i=0; i<this.v.length; i++) {
        if (this.v[i].z < 0)
        {
          this.v[i].z = 0;
          this.vel[i].z = -this.vel[i].z;
        }
      }

      this.numSteps += 1;
    }

    return this.v;
  }

  // addPolytope(iFace) {
  //   let face = this.faces[iFace];
  //   let v0 = this.v[face[0]];
  //   let v1 = this.v[face[1]];
  //   let v2 = this.v[face[2]];
  //   let centroid = v0.clone().add(v1).add(v2).divideScalar(3);
  //   let vec01 = v1.clone().sub(v0);
  //   let vec12 = v2.clone().sub(v1);
  //   let height = Math.sqrt(3) / 2 * Model.defaultMinLength;
  //   let v4 = centroid.add(vec01.cross(vec12).normalize().multiplyScalar(height));
  //   this.v.push(v4);
  //   this.f.push(new thre.Vector3());
  //   this.vel.push(new thre.Vector3());
  //
  //   let iv4 = this.v.length - 1;
  //
  //   let e0 = [face[0], iv4];
  //   let e1 = [face[1], iv4];
  //   let e2 = [face[2], iv4];
  //   this.e.push(e0, e1, e2);
  //
  //   let face0 = [face[2], face[1], face[0]];
  //   let face1 = [face[0], face[1], iv4];
  //   let face2 = [face[1], face[2], iv4];
  //   let face3 = [face[2], face[0], iv4];
  //   this.faces.push(face0, face1, face2, face3);
  //
  //   this.precompute();
  //   this.recordV();
  //
  //   this.updateDataStructure();
  // }

  addJoint(iJoint) {
    let v = new thre.Vector3();
    v.copy(this.v[iJoint]);
    let vec = new thre.Vector3(Model.defaultMinLength, 0, 0);
    v = v.add(vec);
    this.v.push(v);

    let e = [iJoint, this.v.length - 1];
    this.e.push(e);
  }

  addEdges(iJoints) {
    for (let i=0; i<iJoints.length; i++) {
      for (let j=i+1; j<iJoints.length; j++) {
        let notExist = true;
        for (let e of this.e) {
          if (e.includes(iJoints[i]) && e.includes(iJoints[j])) {
            notExist = false;
            break;
          }
        }
        if (notExist) this.e.push([iJoints[i], iJoints[j]]);
      }
    }
  }

  removeJoint(iJoint) {
    if ([0,1,2,3].includes(iJoint)) return;

    this.updateDataStructure();

    const ies = [];   // ids of edges to remove

    const v = Vertex.all[iJoint];
    for (let ee of v.es) {
      ies.push(ee);
    }

    Vertex.all = Vertex.all.filter(vv=>vv !== v);
    Edge.all = Edge.all.filter(ee=>!ies.includes(ee));

    this.updateFromDataStructure();
  }

  removeEdge(iEdge) {

  }

  // update the model variables to data structures
  updateDataStructure() {
    Vertex.all = [];
    for (let i = 0; i < this.v.length; i++) {
      new Vertex(this.v[i], this.fixedVs[i], this.v0[i], this.vel[i], this.f[i]);
    }
    Edge.all = [];
    for (let i = 0; i < this.e.length; i++) {
      new Edge(this.e[i], this.lMax[i], this.maxContraction[i], this.edgeChannel[i], this.edgeActive[i], this.l[i]);
    }
  }

  // convert data structures to model variables
  updateFromDataStructure() {
    this.v = [];
    this.fixedVs = [];
    this.v0 = [];
    this.vel = [];
    this.f = [];
    for (let v of Vertex.all) {
      this.v.push(v.pos);
      this.fixedVs.push(v.fixed);
      this.v0.push(v.pos0);
      this.vel.push(v.vel);
      this.f.push(v.f);
    }

    this.e = [];
    this.lMax = [];
    this.maxContraction = [];
    this.edgeChannel = [];
    this.edgeActive = [];
    this.l = [];
    for (let e of Edge.all) {
      let vs = [e.vs[0].id, e.vs[1].id];
      this.e.push(vs);
      this.lMax.push(e.lMax);
      this.maxContraction.push(e.maxContraction);
      this.edgeChannel.push(e.edgeChannel);
      this.edgeActive.push(e.edgeActive);
      this.l.push(e.l);
    }

    this.vStatus = new Array(this.v.length).fill(0);
    this.eStatus = new Array(this.e.length).fill(0);
  }

  static reindexObjects = (cls) => {
    let i = 0;
    for (let o of cls.all) {
      o.id = i;
      i += 1;
    }
  };

  centroid(v0=false) {
    let center = new thre.Vector3(0, 0, 0);
    const vs = v0 ? this.v0 : this.v;
    for (let v of vs) {
      center.add(v);
    }
    center.divideScalar(this.v.length);
    return center;
  }

  center() {
    const cent0 = this.centroid(true);
    const cent = this.centroid(false);
    for (let i=0; i<this.v.length; i++) {
      this.v[i].sub(cent);
      this.v[i].add(cent0);
    }
  }

  stepsPerSecond() {
    let t = new Date();
    return this.numSteps / ((t.getTime() - this.timeStart.getTime()) / 1000);
  }

  bbox() {
    let xMax, yMax, zMax, xMin, yMin, zMin;
    xMax = yMax = zMax = -Infinity;
    xMin = yMin = zMin = Infinity;
    for (let v of this.v) {
      if (v.x > xMax) xMax = v.x;
      if (v.y > yMax) yMax = v.y;
      if (v.z > zMax) zMax = v.z;
      if (v.x < xMin) xMin = v.x;
      if (v.y < yMin) yMin = v.y;
      if (v.z < zMin) zMin = v.z;
    }
    return [xMax, yMax, zMax, xMin, yMin, zMin];
  }

  infoJoints() {
    return 'joints: '+ this.v.length;
  }

  infoBeams() {
    return 'actuators: ' + this.e.length;
  }

  fixJoints(ids) {
    for (let i=0; i<ids.length; i++) {
      let id = ids[i];
      alert('not implemented');
      // if (viewer.typeSelected[i] === "joint") {
      //   this.fixedVs[id] = true;
      // }
    }
  }

  unfixAll() {
    this.fixedVs = [];
    this.fixedVs = new Array(this.v.length).fill(false);
  }

  rotate(x, y, z) {
    this.resetV();

    let center = this.centroid();
    let eulerInverse = new thre.Euler();
    eulerInverse.setFromVector3(this.euler.toVector3().negate(), 'ZYX');
    this.euler =new thre.Euler(x, y, z);

    for (let i=0; i<this.v.length; i++) {
      this.v[i].sub(center);
      this.v[i].applyEuler(eulerInverse);
      this.v[i].applyEuler(this.euler);
      this.v[i].add(center);
    }

    this.recordV();
  }

}

export {Model};
