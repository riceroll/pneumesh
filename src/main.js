import {Model} from './model.js'
import Viewer from './viewer.js'
import GUI from './gui';
import React, {useRef} from "react";

// parse parameter
const queryString = window.location.search;
let urlParser = new URLSearchParams(queryString);
window.urlParser = urlParser;
let initFileName = urlParser.get('load');
let initFileDir = "./examples/" + initFileName + ".json";


// init Model
let model = new Model();
window.model = model;


// init sharedData
const sharedData = {
  updateGUI: null,
  GUIHovered: false,
  unSelect: false,
  addingJoint: false,
  movingJoint: false,
  movingBody: false,
  removingJoint: false,
  showChannel: false,
  editingScript: false,
  numActions: 20,
  numChannels: 4,
  infoPanel: null,
  showInfo: false
};
model.sharedData = sharedData;
window.sharedData = sharedData;

sharedData.infoPanel = document.getElementById('infoPanel');
if (!sharedData.infoPanel) {
  sharedData.infoPanel = document.createElement('div');
  document.body.appendChild(sharedData.infoPanel);
}
sharedData.infoPanel.id = 'infoPanel';
sharedData.infoPanel.style.background = 'rgba(255, 255, 255, 0.9)';
sharedData.infoPanel.style.position = 'absolute';
sharedData.infoPanel.style.padding = '10px';
sharedData.infoPanel.appendChild(sharedData.infoPanel.ownerDocument.createTextNode(" "));


// events
window.addEventListener('pointerdown', (e)=>{
  sharedData.unSelect = true;
}, false);

window.addEventListener('pointermove', (e)=>{
  sharedData.unSelect = false;
}, false);

window.addEventListener('pointerup', (e)=>{
  if (sharedData.unSelect) {
    if (!sharedData.GUIHovered) {
      if (model.vStatus.every(b => b !== 1) && model.eStatus.every(b => b !== 1) && model.fStatus.every(b => b !== 1)) {
        model.vStatus.fill(0);
        model.eStatus.fill(0);
        model.fStatus.fill(0);
      }
    }

    if (sharedData.updateGUI) setTimeout(() => {
      sharedData.updateGUI()
    }, 10);
  }

}, false);

window.addEventListener('keydown', (e)=>{
    if (e.code === "KeyA" && (e.metaKey || e.ctrlKey)) {
      model.eStatus.fill(2);
      model.vStatus.fill(2);
    }

    if (e.code === "KeyZ" && (e.metaKey || e.ctrlKey) && (!e.shiftKey)) {
      model.undo();
      setTimeout(()=>{window.updateModel()}, 10);
    }

    if (e.code === "KeyZ" && (e.metaKey || e.ctrlKey) && (e.shiftKey)) {
      model.redo();
      setTimeout(()=>{window.updateModel()}, 10);
    }

    if (e.code === "KeyA" && model.editing) {
      const iJoints = [];
      for (let i=0; i<model.v.length; i++) {
        if (model.vStatus[i] === 2) iJoints.push(i);
      }
      if (iJoints.length !== 1) return;
      model.addJoint(iJoints[0]);
      model.precompute();
      model.recordV();
      model.forceUpdate();
      model.resetSelection();
    }


    if (e.code === "KeyM" && model.editing) {
      let val = !sharedData.movingJoint;
      sharedData.movingJoint = val;
      if (val) {
        sharedData.removingJoint = false;
        sharedData.addingJoint = false;
      }
      model.simulate = false;
      model.resetSelection();
      window.updateGUI();
    }

    if (e.code === "KeyD" && model.editing) {
      const iJoints = [];
      for (let i=0; i<model.v.length; i++) {
        if (model.vStatus[i] === 2) iJoints.push(i);
      }
      if (iJoints.length !== 1) return;
      model.removeJoint(iJoints[0]);
      model.precompute();
      model.recordV();
      model.forceUpdate();
      model.resetSelection();
    }

    if (e.code === "KeyC" && model.editing) {
      const iJoints = [];
      for (let i=0; i<model.v.length; i++) {
        if (model.vStatus[i] === 2) iJoints.push(i);
      }
      model.addEdges(iJoints);
      model.precompute();
      model.resetSelection();
      model.forceUpdate();
    }

    if (e.code === "KeyT" && model.editing) {
      const iJoints = [];
      for (let i=0; i<model.v.length; i++) {
        if (model.vStatus[i] === 2) iJoints.push(i);
      }
      model.addTet(iJoints);
      model.precompute();
      model.forceUpdate();
      model.resetSelection();
    }

    if (e.code === "KeyF") {
      for (let i=0; i<model.v.length; i++) {
        if (model.vStatus[i] === 2) model.fixedVs[i] = true;
      }
      model.forceUpdate();
    }

    if (e.code === "KeyU") {
      for (let i=0; i<model.v.length; i++) {
        if (model.vStatus[i] === 2) model.fixedVs[i] = false;
      }
      model.forceUpdate();
    }

    if (e.code === "KeyE") {
      model.editing = !model.editing;

      if (model.editing) {
        sharedData.editingScript = false;
        model.simulate = false;
        model.Model.gravity = false;
        sharedData.movingJoint = false;
        sharedData.removingJoint = false;
        sharedData.addingJoint = false;
        model.center();
        for (let i=0; i<model.v.length; i++) {
          model.vel *= 0;
        }
      }
      if (!model.editing) {
        sharedData.movingJoint = false;
        sharedData.removingJoint = false;
        sharedData.addingJoint = false;
        model.Model.gravity = true;
        model.simulate = true;
      }

      model.controls.current.target = model.centroid();

      window.updateGUI();
      model.forceUpdate();
    }

  }
  , false)

// initial load
fetch(initFileDir).then(r => r.text()).then(t =>{
  try {
    let data = JSON.parse(t);
    model.loadDict(data);
    window.data = data;
    model.loadDict(data);
    model.simulate = true;
    model.Model.gravity = true;
    model.forceUpdate();
    sharedData.showChannel = true;
  }
  catch (e) {

  }
})



function Main() {
  return (
    [
      <Viewer key={'viewer'} model={model} sharedData={sharedData}/>,
      <GUI id={'hehe'} key={'gui'} model={model} sharedData={sharedData}/>
    ]
  )

}

export default Main;