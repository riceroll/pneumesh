import {Model} from './model.js'
import Viewer from './viewer.js'
import GUI from './gui';
import React, {useRef} from "react";

let model = new Model();
window.model = model;

const sharedData = {
  updateGUI: null,
  GUIHovered: false,
  unSelect: false,
  addingJoint: false,
  movingJoint: false,
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

  }
  , false)


function Main() {
  return (
    [
      <Viewer key={'viewer'} model={model} sharedData={sharedData}/>,
      <GUI id={'hehe'} key={'gui'} model={model} sharedData={sharedData}/>
    ]
  )

}

export default Main;