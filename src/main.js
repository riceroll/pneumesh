import {Model} from './model.js'
import Viewer from './viewer.js'
import GUI from './gui';
import React, {useRef} from "react";


function Main() {
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
    numChannels: 4
  };
  model.sharedData = sharedData;
  window.sharedData = sharedData;


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
    }
  , false)

  return (
    [
      <Viewer key={'viewer'} model={model} sharedData={sharedData}/>,
      <GUI id={'hehe'}key={'gui'} model={model} sharedData={sharedData}/>
    ]
  )

}

export default Main;
