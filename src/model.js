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
  static history = [];
  static iHistory = -1;

  static configure() {
    let setting = (json) => {
      let data = JSON.parse(json);
      Model.k = data.k;
      Model.h = data.h;
      Model.dampingRatio = data.dampingRatio;
      Model.contractionInterval = data.contractionInterval;
      Model.contractionLevels = data.contractionLevels;
      Model.maxMaxContraction = Math.round(Model.contractionInterval * (Model.contractionLevels - 1) * 100) /100;
      Model.contractionPercentRate = data.contractionPercentRate;
      Model.gravityFactor = data.gravityFactor;
      Model.gravity = Boolean(data.gravity);
      Model.defaultMinLength = data.defaultMinLength;
      Model.defaultMaxLength = Model.defaultMinLength / (1 - Model.maxMaxContraction);
      Model.frictionFactor = data.frictionFactor;
      Model.numStepsAction = data.numStepsActionMultiplier / Model.h;
      Model.defaultNumActions = data.defaultNumActions;
      Model.defaultNumChannels = data.defaultNumChannels;
      Model.angleThreshold = data.angleThreshold;
      Model.angleCheckFrequency = Model.numStepsAction * data.angleCheckFrequencyMultiplier;  // every # steps check angle thresholds
    }

    function readTextFile(file)
    {
      let rawFile = new XMLHttpRequest();
      rawFile.open("GET", file, false);
      rawFile.onreadystatechange = function ()
      {
        if(rawFile.readyState === 4)
        {
          if(rawFile.status === 200 || rawFile.status === 0)
          {
            let allText = rawFile.responseText;
            setting(allText);
          }
        }
      }
      rawFile.send(null);
    }

    readTextFile("config.json")
  }

  constructor() {
    this.viewer = null;

    this.Vertex = Vertex;
    this.Edge = Edge;
    this.Model = Model;
    this.controls = null;
    this.sharedData = null;

    Model.configure();
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
    this.c = [];  // instances of v of corners: nC x 3, e.g. <AOB -> [iO, iA, iB]
    this.a0 = [];   // corner angles: nC
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
    Model.gravity = true;
    this.directional = false;
    this.euler = new thre.Euler(0, 0, 0);

    // channel status
    this.numChannels = Model.defaultNumChannels;
    this.numActions = Model.defaultNumActions;
    this.inflateChannel = new Array(this.numChannels).fill(false);
    this.contractionPercent = new Array(this.numChannels).fill(1);  // contraction percentage of each channel, 0-1
  }

  loadDict(data) {
    console.log(data);
    // load a dictionary
    let v = [];
    let e = Array.from(data.e);
    let f = [];
    let p = [];
    // f = Array.from(data.f);
    // p = Array.from(data.p);
    for (let i=0; i<data.v.length; i++) {
      v.push(new thre.Vector3(data.v[i][0], data.v[i][1], data.v[i][2]));
    }
    this.reset();
    let lMax, maxContraction, fixedVs, edgeChannel, edgeActive, script
    if (data.lMax) { lMax = data.lMax;}
    if (data.maxContraction) {maxContraction = data.maxContraction;}
    if (data.fixedVs)  {fixedVs = data.fixedVs;}
    if (data.edgeChannel)  edgeChannel = data.edgeChannel;
    if (data.edgeActive)  edgeActive = data.edgeActive;
    if (data.script) script = data.script;
    if (data.numChannels) this.numChannels = data.numChannels;
    if (data.numActions) this.numActions = data.numActions;
    this.loadData(v, e, f, p, lMax, maxContraction, fixedVs, edgeChannel, edgeActive, script);

    if (!(data.lMax || data.maxContraction || data.fixedVs)) {
      this.loadData(v, e, f, p);
    }
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

    if (fixedVs) this.fixedVs = fixedVs;
    if (lMax) this.lMax = lMax;
    if (maxContraction) this.maxContraction = maxContraction;
    if (edgeActive) this.edgeActive = edgeActive;
    if (edgeChannel) this.edgeChannel = edgeChannel;
    if (script) this.script = script;

    this.updateCorners();
    this.precompute();

    this.initCheck();
    this.resetSelection();
    this.recordV();
  }

  saveData() {
    let data = {};
    data.v = [];
    for (let v of this.v) {
      data.v.push([v.x, v.y, v.z]);
    }
    data.v0 = [];
    for (let v0 of this.v0) {
      data.v0.push([v0.x, v0.y, v0.z]);
    }

    data.e = [];
    for (let i=0; i<this.e.length; i++) {
      data.e.push(this.e[i].slice());
    }
    data.fixedVs = this.fixedVs.slice();
    data.lMax = this.lMax.slice();
    data.edgeChannel = this.edgeChannel.slice();
    data.edgeActive = this.edgeActive.slice();
    data.script = [];
    for (let i=0; i<this.script.length; i++) {
      const actions = this.script[i].slice();
      data.script.push(actions);
    }

    data.maxContraction = this.maxContraction.slice();
    data.vStatus = this.vStatus.slice();
    data.eStatus = this.eStatus.slice();
    data.fStatus = this.fStatus.slice();

    data.euler = this.euler.clone();

    data.numChannels = this.numChannels;
    data.numActions = this.numActions;
    data.inflateChannel = this.inflateChannel.slice();
    data.contractionPercent = this.contractionPercent.slice();

    return data;
  }

  sameData(data, prevData) {
    let same = true;

    if (JSON.stringify(data.e) !== JSON.stringify(prevData.e)) same = false;
    if (JSON.stringify(data.fixedVs) !== JSON.stringify(prevData.fixedVs)) same = false;
    if (JSON.stringify(data.lMax) !== JSON.stringify(prevData.lMax)) same = false;
    if (JSON.stringify(data.edgeChannel) !== JSON.stringify(prevData.edgeChannel)) same = false;
    if (JSON.stringify(data.edgeActive) !== JSON.stringify(prevData.edgeActive)) same = false;
    if (JSON.stringify(data.script) !== JSON.stringify(prevData.script)) same = false;
    if (JSON.stringify(data.maxContraction) !== JSON.stringify(prevData.maxContraction)) same = false;
    if (data.euler.x !== prevData.euler.x) same = false;
    if (data.euler.y !== prevData.euler.y) same = false;
    if (data.euler.z !== prevData.euler.z) same = false;

    if (data.numChannels !== prevData.numChannels) same = false;
    if (data.numActions !== prevData.numActions) same = false;

    return same;
  }

  recordHistory() {
    const data = this.saveData();

    if (this.Model.iHistory !== -1) {
      if (this.sameData(data, this.Model.history[this.Model.iHistory])) {
        return;
      }
    }

    console.log('record');

    Model.history = Model.history.slice(0, Model.iHistory + 1);

    Model.history.push(this.saveData());
    if (Model.history.length > 50) {
      Model.history.shift();
    }
    Model.iHistory = Model.history.length - 1;
  }
  
  applyHistory(i, update=true) {
    if (i === -1) return;

    const data = Model.history[i];

    this.v = [];
    for (let v of data.v) {
      this.v.push(new thre.Vector3(v[0], v[1], v[2]));
    }
    this.v0 = [];
    for (let v0 of data.v0) {
      this.v0.push(new thre.Vector3(v0[0], v0[1], v0[2]));
    }
    this.e = [];
    for (let i=0; i<data.e.length; i++) {
      this.e.push(data.e[i].slice());
    }
    this.fixedVs =data.fixedVs.slice();
    this.lMax = data.lMax.slice();
    this.edgeChannel = data.edgeChannel.slice();
    this.edgeActive = data.edgeActive.slice();
    this.script = [];
    for (let i=0; i<data.script.length; i++) {
      const actions = data.script[i].slice();
      this.script.push(actions);
    }

    this.maxContraction = data.maxContraction.slice();
    this.vStatus = data.vStatus.slice();
    this.eStatus = data.eStatus.slice();
    this.fStatus = data.fStatus.slice();

    this.euler = data.euler.clone();

    this.numChannels = data.numChannels;
    this.numActions = data.numActions;
    this.inflateChannel = data.inflateChannel.slice();
    this.contractionPercent = data.contractionPercent.slice();
  }
  
  undo() {
    if (Model.iHistory - 1 >= 0) {
      Model.iHistory -= 1;
    }
    this.applyHistory(Model.iHistory);
  }
  
  redo() {
    if (Model.iHistory + 1 < Model.history.length) {

      console.log(Model.iHistory);
      Model.iHistory += 1;
      console.log('yes');
      console.log(Model.iHistory);
    }
    this.applyHistory(Model.iHistory);
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

  initCheck() {

    // rescale
    if (false) {
      let minlMax = 1e5;
      for (let i = 0; i < this.e.length; i++) {
        if (this.edgeActive[i]) {
          if (this.l[i] < minlMax) {
            minlMax = this.l[i];
          }
        }
      }
      console.log(`Minimum max length among active beams is ${minlMax}.`)
      for (let i = 0; i < this.v.length; i++) {
        this.v[i].divideScalar(minlMax);
        this.v[i].multiplyScalar(Model.defaultMaxLength);
      }
    }

    // lMax check
    for (let i=0; i<this.e.length; i++) {
      if (this.edgeActive[i]) {
        if (this.lMax[i] !== this.Model.defaultMaxLength) {
          console.log(`An active beam is having wrong max length ${this.lMax[i]}.`)
          this.lMax[i] = this.Model.defaultMaxLength;
        }
      }
    }

  }

  static getAngle(e0, e1, indices=false) {
    // e0, e1: Edge instances
    // indices: return indices of three vertices OAB
    // return: angle between them, (return indices of three vertices OAB)
    let vs0 = e0.vs;
    let vs1 = e1.vs;
    let vs;
    if (vs0[0] === vs1[0]) vs = [vs0[0], vs0[1], vs1[1]];
    else if (vs0[0] === vs1[1]) vs = [vs0[0], vs0[1], vs1[0]];
    else if (vs0[1] === vs1[0]) vs = [vs0[1], vs0[0], vs1[1]];
    else if (vs0[1] === vs1[1]) vs = [vs0[1], vs0[0], vs1[0]];
    else console.error("edges not intersected");

    const O = vs[0].pos.clone();
    const A = vs[1].pos.clone();
    const B = vs[2].pos.clone();

    A.sub(O);
    B.sub(O);
    if (indices) {
      return [A.angleTo(B), [vs[0].id, vs[1].id, vs[2].id] ];
    }

    return A.angleTo(B);
  }

  updateCorners() {
    // update this.c, this.a0
    this.updateDataStructure();

    this.c = [];
    this.a0 = [];
    for (let v of Vertex.all) {
      let es = v.es;
      for (let i=0; i<es.length-1; i++) {
        let e0 = es[i];
        let e1 = es[i+1];

        let [alpha, ids] = Model.getAngle(e0, e1, true);
        this.c.push(ids);
        this.a0.push(alpha);
      }
    }
  }

  checkCorners() {
    // return false if any angle change is larger than threshold
    for (let i=0; i<this.c.length; i++) {
      let [iO, iA, iB] = this.c[i];
      let vec0 = this.v[iA].clone().sub(this.v[iO]);
      let vec1 = this.v[iB].clone().sub(this.v[iO]);
      let alpha = vec0.angleTo(vec1);
      if (Math.abs(alpha - this.a0[i]) > Model.angleThreshold) return false;
    }
    return true;
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
      if (Model.gravity) {
        this.f[i].add(new thre.Vector3(0, 0, -Model.gravityFactor * Model.gravity));
      }
    }
    // friction
  }

  runScript() {
    if (this.script.length === 0) return 0;

    if (this.numSteps > ((this.iAction + 1) % this.numActions) * Model.numStepsAction ) {
      this.iAction = Math.floor(this.numSteps / Model.numStepsAction) % this.numActions;
      if (this.editing) {
        this.iAction = 0;
      }

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


      this.update(); // update lengths and forces

      for (let i=0; i<this.v.length; i++) {
        if (this.fixedVs[i]) continue;

        if (this.sharedData.movingJoint && this.vStatus[i] !== 2) continue;

        this.vel[i].add(this.f[i].clone().multiplyScalar(Model.h));

        if (this.v[i].z <= 0) {
          this.vel[i].x *= (1 - Model.frictionFactor);
          this.vel[i].y *= (1 - Model.frictionFactor);
        }

        this.vel[i].multiplyScalar(Model.dampingRatio);   // damping
        if (this.vel[i].length() > 5) {

          this.vel[i].multiplyScalar(Math.pow(0.9, Math.ceil(Math.log(5/this.vel[i].length()) / Math.log(0.9))));
        }

        this.v[i].add(this.vel[i].clone().multiplyScalar(Model.h));

        if (this.v[i].z <= 0) {
          this.vel[i].z = -this.vel[i].z;
          this.v[i].z = 0;
        }
      }

      if (this.numSteps % Model.angleCheckFrequency === 0) {
        console.assert(this.checkCorners());
      }

      this.numSteps += 1;
    }

    return this.v;
  }

  addJoint(iJoint) {
    let v = new thre.Vector3();
    v.copy(this.v[iJoint]);
    let vec = new thre.Vector3(Model.defaultMinLength, 0, 0);
    v = v.add(vec);
    this.v.push(v);

    let e = [iJoint, this.v.length - 1];
    this.e.push(e);

    this.updateCorners();
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

    this.updateCorners();
  }

  removeJoint(iJoint) {
    if ([0,1,2,3].includes(iJoint)) return;

    this.updateDataStructure();

    const ees = [];   // edges to remove

    const v = Vertex.all[iJoint];
    for (let ee of v.es) {
      ees.push(ee);
    }

    Vertex.all = Vertex.all.filter(vv=>vv !== v);
    Edge.all = Edge.all.filter(ee=>!ees.includes(ee));

    Model.reindexObjects(Vertex)
    Model.reindexObjects(Edge)

    this.updateFromDataStructure();
    this.updateCorners();

    this.forceUpdate();
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

  center(v0=false) {
    // v0 : center v0 of the object if true
    const cent = this.centroid();
    const [xMax, yMax, zMax, xMin, yMin, zMin] = this.bbox();
    const gap = Math.max([zMax - zMin, yMax - yMin, xMax - xMin]);

    for (let i=0; i<this.v.length; i++) {
      this.v[i].x -= cent.x;
      this.v[i].y -= cent.y;
      this.v[i].z -= zMin;
      this.v[i].z += zMax - zMin;
    }

    this.recordV();
  }

  align(x=true, ivs = []) {
    // align the axis of model(from centroid to the centroid of selected front vertices) along x/y axis
    // x: align along x axis if true, otherwise along y axis
    // ivs: indices of front vertices

    if (ivs.length > 0) {
      let centFront = new thre.Vector3(0, 0, 0);
      for (let iv of ivs) {
        const v = this.v[iv];
        centFront.add(v);
      }

      centFront.divideScalar(ivs.length);

      const cent = this.centroid();

      centFront.sub(cent);
      let vec = centFront.clone();
      vec.z = 0;

      // Returns the angle (in radians) from the X axis to a point.
      let rotRadZ = Math.atan2(vec.y, vec.x);

      if (!x) rotRadZ -= Math.PI / 2;

      this.rotateTo(this.euler.x, this.euler.y, this.euler.z-rotRadZ);
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
    }
  }

  unfixAll() {
    this.fixedVs = [];
    this.fixedVs = new Array(this.v.length).fill(false);
  }

  rotateTo(x, y, z) {
    // this.resetV();

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
