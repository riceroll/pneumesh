import './style.css';
import React, {useRef, useState, useMemo, useReducer} from 'react'
import {makeStyles, Grid, List, ListItem, ListItemIcon, ListItemText, Divider,
        Icon, Slider, Switch, Typography, IconButton}
        from '@material-ui/core'
import { extend, Canvas, useFrame, useThree, useResource, useUpdate } from 'react-three-fiber'
import {
  AccessAlarm, Publish, GetApp, ChevronLeft, ExitToApp, Edit, GpsFixed, GpsNotFixed,
  RadioButtonChecked, RadioButtonUnchecked, FilterCenterFocus, AddCircleOutlineRounded, VerticalAlignCenter,
  SettingsEthernet, WbSunny, FiberManualRecord, Lock, LockOpen, AddCircleOutline, ChangeHistory, HighlightOff,
  Link, LinkOff, Visibility, OpenWith, ColorLens, Palette, ArrowDownward, Comment, Computer, HelpOutline
} from "@material-ui/icons";

const cBackground = "rgba(200, 200, 200, 0.6)";
const cTransparent = "rgba(200, 200, 200, 0.0)";

const cHovered = "rgba(250, 250, 250, 0.9)";
const cHighlight = "rgba(250, 100, 50, 0.9)";
const cOff = "rgba(150, 150, 150, 1)";

const cChannels = [
  "rgb(100, 150, 220)",
  "rgb(240, 240, 20)",
  "rgb(200, 100, 200)",
  "rgb(100, 200, 130)",
  "rgb(200, 100, 100)",
  "rgb(200, 100, 100)",
  "rgb(200, 100, 100)",
  "rgb(200, 100, 100)",
  "rgb(200, 100, 100)",
  "rgb(200, 100, 100)",
  "rgb(200, 100, 100)",
  "rgb(200, 100, 100)",
  "rgb(200, 100, 100)",
  "rgb(200, 100, 100)",
  "rgb(200, 100, 100)",
];

const widthBlock = 5;   // vh
const heightBlock = 5;    // vh
const paddingBlock = 1;   // vh
const marginBlock = 0.5;     // vh
const paddingBlocks = 0.5;
const widthSlider = 20;
const marginSlider = 0.1;
const widthSliders = (widthSlider + marginSlider * 2);


const useStyles = makeStyles((theme) => ({
  mainGUI: {
    position: "absolute",
    right: "1.5vh",
    top: "1.5vh",
    width: "28vh",
    height: "auto",
    background: cBackground,
    "& .MuiList-root" : {
      "& .MuiListItem-root" : {
        minHeight: "6vh"
      }
    }
  },
  editingGUI: {
    position: "absolute",
    right: "30vh",
    top: "1.5vh",
    width: "30vh",
    // height: "30vh",
    background: cBackground,
  },
  scriptGUI: {
    position: "absolute",
    left: "2vh",
    bottom: "2vh",
    background: cBackground,
  },
  editingScriptGUI: {
    position: "absolute",
    right: "30vh",
    top: "44vh",
    width: "30vh",
    background: cBackground,
  },
  help: {
    position: "absolute",
    cursor: "pointer",
    right: "10px",
    bottom: "10px",
    width: "40px",
    height: "40px",
    alignContent: "center",
    background: cBackground,
  },
  examples: {
    position: "absolute",
    width: "130px",
    right: "60px",
    bottom: "10px",
    height: "40px",
    background: cBackground,
    cursor: "pointer",

  }
}))

function SettingActive({model, updateGUI}) {
  const icons = [];

  let passive =
    ![...Array(model.e.length).keys()].every(ie=>(
      (model.eStatus[ie] !== 2) || (model.eStatus[ie] === 2 && model.edgeActive[ie] === true)
    ));

  let active =
    ![...Array(model.e.length).keys()].every(ie=>(
      (model.eStatus[ie] !== 2) || (model.eStatus[ie] === 2 && model.edgeActive[ie] === false)
    ));

  icons.push(
    <Grid item key={"active"} style={{width: "50%", textAlign: "center"}}>
    <IconButton
      size={"small"}
      onClick={()=> {
          for (let ie = 0; ie < model.e.length; ie++) {
            if (model.eStatus[ie] === 2) {
              model.edgeActive[ie] = true;
              model.lMax[ie] = model.Model.defaultMaxLength;
            }
          }
          updateGUI();
          setTimeout(model.forceUpdate, 50);
        }
      }
    >
      <WbSunny/>
    </IconButton>
    </Grid>
  )

  icons.push(
    <Grid item key={"passive"} style={{width: "50%", textAlign: "center"}}>
    <IconButton
      size={"small"}
      onClick={()=> {
          for (let ie = 0; ie < model.e.length; ie++) {
            if (model.eStatus[ie] === 2) {
              model.edgeActive[ie] = false;
            }
          }
          updateGUI();
          setTimeout(model.forceUpdate, 50);
        }
      }
    >
      <FiberManualRecord/>
    </IconButton>
    </Grid>
  )


  return (
    <ListItem>
      <ListItemText style={{width: "50%"}}>
        Active / Passive
      </ListItemText>
      <Grid container style={{width: "50%"}}>
        {icons}
      </Grid>
    </ListItem>
  )
}

function SettingChannel({n, model, updateGUI}) {
  const icons = [];

  for (let i=0; i<n; i++) {
    let checked =
      ![...Array(model.e.length).keys()].every(ie=>(
        (model.eStatus[ie] !== 2) || ((model.eStatus[ie] === 2) && (model.edgeChannel[ie] !== i))
      ))

    const color = cChannels[i];

    icons.push(
      <Grid key={i} item style={{width: `${1/n * 100}%`, textAlign: "center"}} >
        <IconButton
          size={"small"}
          onClick={()=> {
              for (let ie = 0; ie < model.e.length; ie++) {
                if (model.eStatus[ie] === 2) {
                  model.edgeChannel[ie] = i;
                }
              }
              updateGUI();

            }
          }
        >
          {checked? <RadioButtonChecked style={{"color": color}}/> :  <RadioButtonUnchecked style={{"color": color}}/>}
        </IconButton>
      </Grid>
    )
  }

  return (
  <ListItem>
    <Grid container styles={{width: "50%"}}>
      {icons}
    </Grid>
  </ListItem>
  )
}

function ControlChannel({n, model, updateGUI}) {
  const switches = [];

  for (let i=0; i<n; i++) {
    switches.push(
      <Grid key={i} item style={{width: `${1/n * 100}%`, textAlign: "center"}}>
        <Switch
          size={"small"}
          checked={Boolean(model.inflateChannel[i])}
          onClick={(e)=>{
            console.log(e.target.checked);
            model.inflateChannel[i] = e.target.checked;
            updateGUI();
          }}
        />
        </Grid>
    );
  }


  return(
    <ListItem>
      <Grid container styles={{width: "100%"}} alignItems={"center"}>
        {switches}
      </Grid>
    </ListItem>
  )
}

const Examples = () => {
  const [hovered, setHovered] = useState(false);

  return (
    <Grid
      container
      style={{
        height: "39px",
        border: `3px solid ${hovered?cHighlight:cTransparent}`,

      }}
      onPointerOver={()=>{setHovered(true)}}
      onPointerOut={()=>{setHovered(false)}}
      onClick={()=>{window.open('https://climbing-mat-e4b.notion.site/Web-PneuMesh-Examples-23cc48c3172849cc95b53ba68cc9d251','_blank').focus()}}
    >
      <Grid
        container
        xs={4}
        alignItems={"center"}
      >

        <ExitToApp
          style={{height: "30px", width: "30px"}}
        />
      </Grid>

      <Grid
        container
        xs={8}
        alignItems={"center"}
      >
        <div>Examples</div>
      </Grid>

    </Grid>
  )
}


const Help = () => {
  const [hovered, setHovered] = useState(false);

  return (
    <Grid
      style={{
        height: "30px",
        width: "30px",
        border: `3px solid ${hovered?cHighlight:cTransparent}`,
        padding: "2px",
      }}
      onPointerOver={()=>{setHovered(true)}}
      onPointerOut={()=>{setHovered(false)}}
      onClick={()=>{window.open('https://climbing-mat-e4b.notion.site/Web-PneuMesh-Tutorial-e1182476d3d34b85b9619df3419c7c40','_blank').focus()}}
    >
      <HelpOutline
        style={{height: "30px", width: "30px"}}
      />
    </Grid>
  )
}

function TemporalControl({model, sharedData, updateGUI, classes}) {
  model.precompute();
  const widthBlocks = (widthBlock + marginBlock * 2) * model.numActions + paddingBlocks * 2;

  const Block = ({model, iChannel, iAction}) => {
    const [hovered, setHovered] = useState(false);
    const isOn = model.script[iChannel][iAction];
    const [actuating, setActuating] = useState(iAction===model.iAction);

    return (
      <Grid item
            key={iAction}
            className={classes.scriptBlock}
            style={{
              cursor: "pointer",
              background: cChannels[iChannel],
              width: `${widthBlock}vh`,
              height: `${heightBlock}vh`,
              padding: `${paddingBlock}vh`,
              margin: `${marginBlock}vh`,
              border: `${hovered?"4px":"2px"} solid ${model.iAction===iAction?cHighlight:cHovered}`,
              opacity: `${isOn?1:hovered?0.8:0.1}`
            }}
            onPointerOver={()=>{setHovered(true)}}
            onPointerOut={()=>{setHovered(false)}}
            onClick={()=>{model.script[iChannel][iAction]=!isOn}}
      >
      </Grid>
    )
  }

  const Row = ({model, iChannel}) => {
    const blocks = [];
    for (let iAction=0; iAction<model.numActions; iAction++) {
      const isOn=true;
      blocks.push(
        <Block key={iAction} model={model} isOn={isOn} iChannel={iChannel} iAction={iAction} />
      );
    }

    return(
      <Grid container item spacing={0}>
        {/*<React.Fragment>*/}
          {blocks}
        {/*</React.Fragment>*/}
      </Grid>
    )
  }

  const rows = [];
  for (let iChannel=0; iChannel<model.numChannels; iChannel++) {
    rows.push(<Row key={iChannel} iChannel={iChannel} model={model}/>)
  }

  return ([
    <Grid key={'buttons'} container item spacing={0} style={{padding:`${paddingBlocks}vh`, width: `${widthBlocks}vh`}}>
      {rows}
    </Grid>,

    ]
  );
}


function GUI({model, options, sharedData}) {

  const [, updateGUI] = useReducer(x => x+1, 0);
  sharedData.updateGUI = updateGUI;
  window.updateGUI = updateGUI;
  model.recordHistory();

  const classes = useStyles();

  const load = (e)=>{
    let input = document.createElement('input');
    document.body.appendChild(input);
    input.type = 'file';
    input.id = 'inputFile';
    input.style = 'display:none';

    document.getElementById("inputFile").click();
    document.getElementById("inputFile").onchange = ()=>{

      let reader = new FileReader();
      reader.onload = (event) => {
        let inputFileString = event.target.result;
        window.inputFileString = inputFileString;
        let data = JSON.parse(inputFileString);
        window.data =data;
        model.loadDict(data);
        model.simulate=false;
        model.Model.gravity=true;
        model.forceUpdate();
        updateGUI();
      };
      reader.readAsText(document.getElementById("inputFile").files[0]);
      document.body.removeChild(input);
    };
  }

  const save = (e)=>{
    model.recordV();

    let data = model.saveData();
    let json = JSON.stringify(data);

    let download = document.createElement('a');
    document.body.appendChild(download);
    download.download = 'download.json';
    download.style.display = 'none';
    download.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(json);
    download.click();
    document.body.removeChild(download);
  }

  return (
    [
    <div key={"mainGUI"} className={classes.mainGUI}
         onPointerOver={(e)=>{sharedData.GUIHovered=true}}
         onPointerOut={(e)=>{sharedData.GUIHovered=false}}
    >
      <List>
        <ListItem button
                  onClick={save}>
          <ListItemIcon>
            <GetApp/>
          </ListItemIcon>
          <ListItemText>
            Download
          </ListItemText>
        </ListItem>

        <ListItem button selected={false}
                  onClick={load}>
          <ListItemIcon>
            <Publish/>
          </ListItemIcon>
          <ListItemText>
            Load
          </ListItemText>
        </ListItem>

        <Divider/>
        <Divider/>

        <ListItem button selected={model.editing}
                  onClick={(e)=>{
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

                    updateGUI();
                    model.forceUpdate();
                  }}>
          <ListItemIcon>
            <ChevronLeft/>
          </ListItemIcon>
          <ListItemText>
            Edit Shape (E)
          </ListItemText>
        </ListItem>


        {/*channel color*/}
        <ListItem>
          <ListItemIcon>
            <Palette/>
          </ListItemIcon>
          <ListItemText style={{left: "2px"}}>
            ChannelColor
          </ListItemText>
          <Switch
            i={1}
            checked={sharedData.showChannel}
            onChange={(e)=>{
              sharedData.showChannel = !sharedData.showChannel;
              updateGUI();
            }}
          />
        </ListItem>

        <SettingChannel n={model.numChannels} model={model} updateGUI={updateGUI}/>


        <ListItem>
          <Typography style={{width: "50%"}}>
            Contraction
          </Typography>
          <Slider
            style={{width: "50%"}}
            disabled={
             model.eStatus.includes(2) ?
               ![...Array(model.e.length).keys()].every(ie=>(
                 (model.eStatus[ie]===2 && model.edgeActive[ie]) || (model.eStatus[ie] !==2))) :
                 true
            }
            defaultValue={model.Model.maxMaxContraction}
            aria-labelledby={"discrete-slider-custom"}
            step={model.Model.contractionInterval}
            min={0}
            max={model.Model.maxMaxContraction}
            valueLabelDisplay={"auto"}
            onChange={(e, val)=>{
              for (let i=0; i<model.e.length; i++) {
                if (model.eStatus[i] === 2) {
                  model.maxContraction[i] = val;
                }
              }
            }}
            onPointerUp={()=>{model.forceUpdate();}}
          />
        </ListItem>



        {/*fix joints*/}
        <ListItem>
          <ListItemText style={{width: "50%"}}>
            Fix Joints (F/U)
          </ListItemText>
          <Grid container style={{width: "50%"}}  spacing={0} alignItems={"center"}>
            <Grid item key={"fix"} style={{width: "50%" , textAlign: "center"}}>

              <IconButton
                size={"small"}
                onClick={(e)=>{
                  for (let i=0; i<model.v.length; i++) {
                    if (model.vStatus[i] === 2) model.fixedVs[i] = true;
                  }
                  updateGUI();
                  model.forceUpdate();
                }}>
                <Lock/>
              </IconButton>
            </Grid>

            <Grid item key={"unfix"} style={{width: "50%" , textAlign: "center"}}>
              <IconButton
                size={"small"}
                onClick={(e)=>{
                  for (let i=0; i<model.v.length; i++) {
                    if (model.vStatus[i] === 2) model.fixedVs[i] = false;
                  }
                  updateGUI();
                  model.forceUpdate();
                }}>
                <LockOpen/>
              </IconButton>
            </Grid>
          </Grid>

        </ListItem>


        <Divider/>

        <SettingActive model={model} updateGUI={updateGUI}/>


        <ListItem>
          <Typography style={{width: "50%"}}>
            Length
          </Typography>
            <Slider
              style={{width: "50%"}}
              disabled={
                model.eStatus.includes(2) ?
                  ![...Array(model.e.length).keys()].every(ie=>(
                    (model.eStatus[ie]===2 && !model.edgeActive[ie]) || (model.eStatus[ie] !==2))) :
                  true
              }
              defaultValue={model.Model.defaultMinLength}
              aria-labelledby={"discrete-slider-custom"}
              step={model.Model.contractionInterval * model.Model.defaultMaxLength}
              min={model.Model.defaultMinLength}
              max={model.Model.defaultMaxLength}
              valueLabelDisplay={"auto"}
              // marks={marks}
              onChange={
                (e, val)=>{
                  for (let i=0; i<model.e.length; i++) {
                    if (model.eStatus[i] === 2 && model.edgeActive[i] === false) {
                      model.lMax[i] = val;
                    }
                  }
                  model.forceUpdate();
                }
              }
              onPointerUp={()=>{model.forceUpdate()}}
            />
        </ListItem>




        {/*<ListItem button selected={sharedData.editingScript}*/}
        {/*          onClick={(e)=>{*/}
        {/*            sharedData.editingScript = !sharedData.editingScript;*/}
        {/*            model.editing = false;*/}
        {/*            updateGUI();*/}
        {/*          }}>*/}
        {/*  <ListItemIcon>*/}
        {/*    <ChevronLeft/>*/}
        {/*  </ListItemIcon>*/}
        {/*  <ListItemText>*/}
        {/*    Script & Channel*/}
        {/*  </ListItemText>*/}
        {/*</ListItem>*/}

        {/*<ControlChannel n={model.numChannels} model={model} updateGUI={updateGUI}/>*/}

        <Divider/>
        <Divider/>


        {/*graivty*/}
        <ListItem>
          <ListItemIcon>
            <ArrowDownward/>
          </ListItemIcon>
          <ListItemText>
            Gravity
          </ListItemText>
          <Switch
            i={0}
            checked={model.Model.gravity}
            onChange={(e)=>{
              model.Model.gravity = !model.Model.gravity;
              updateGUI();
            }}
          />
        </ListItem>

        {/*simulation*/}
        <ListItem>
          <ListItemIcon>
            <Computer/>
          </ListItemIcon>
          <ListItemText>
            Simulate
          </ListItemText>
          <Switch
            i={0}
            checked={model.simulate}
            onChange={(e)=>{
              model.simulate = !model.simulate;
              updateGUI();
            }}
          />
        </ListItem>


        {/*# of Actions*/}
        <ListItem>
          <Typography style={{width: "50%"}}>
            # of Actions
          </Typography>
          <Slider
            key={'numActions'}
            style={{width: "50%"}}
            defaultValue={model.Model.defaultNumActions}
            aria-labelledby={"discrete-slider-custom"}
            step={1}
            min={1}
            max={20}
            valueLabelDisplay={"auto"}
            onChange={(e, val)=>{
              model.numActions = val;
              model.precompute();
              updateGUI();
            }}
          />
        </ListItem>

        <Divider/>


        {/*<ListItem>*/}
        {/*  <Typography style={{width: "50%"}}>*/}
        {/*    Friction*/}
        {/*  </Typography>*/}
        {/*  <Slider*/}
        {/*    style={{width: "50%"}}*/}
        {/*    defaultValue={model.Model.frictionFactor}*/}
        {/*    aria-labelledby={"discrete-slider-custom"}*/}
        {/*    step={0.1}*/}
        {/*    min={0}*/}
        {/*    max={1}*/}
        {/*    valueLabelDisplay={"auto"}*/}
        {/*    // marks={marks}*/}
        {/*  />*/}
        {/*</ListItem>*/}

        <Divider/>

        <ListItem button
                  onClick={(e)=>{
                    model.controls.current.target = model.centroid();
                    model.forceUpdate();
                  }}>
          <ListItemIcon>
            <Visibility/>
          </ListItemIcon>
          <ListItemText>
            Look At Center
          </ListItemText>
        </ListItem>



        {/*<ListItem>*/}
        {/*  <ListItemText>*/}
        {/*    Length Info*/}
        {/*  </ListItemText>*/}
        {/*  <Switch*/}
        {/*    i={2}*/}
        {/*    checked={sharedData.showInfo}*/}
        {/*    onChange={(e)=>{*/}
        {/*      sharedData.showInfo = !sharedData.showInfo;*/}
        {/*      updateGUI();*/}
        {/*    }}*/}
        {/*  />*/}
        {/*</ListItem>*/}

      </List>
    </div>,


    <div key={"editingGUI"} className={classes.editingGUI}
         style={model.editing ? {display: "block"} : {display: "none"}}
         onPointerOver={(e)=>{sharedData.GUIHovered=true}}
         onPointerOut={(e)=>{sharedData.GUIHovered=false}}
    >
        <List>
          {/*<ListItem>*/}
          {/*  <ListItemText>*/}
          {/*    Add Joint*/}
          {/*  </ListItemText>*/}
          {/*  <Switch*/}
          {/*    key={"add_joint"}*/}
          {/*    checked={sharedData.addingJoint}*/}
          {/*    onChange={(e,val)=>{*/}
          {/*      sharedData.addingJoint = val;*/}
          {/*      if (val) {*/}
          {/*        sharedData.removingJoint = false;*/}
          {/*        sharedData.movingJoint = false;*/}
          {/*      }*/}
          {/*      updateGUI();*/}
          {/*    }}*/}
          {/*  />*/}
          {/*</ListItem>*/}

          <ListItem button
                    onClick={(e)=>{
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
                      updateGUI();
                    }}>
            <ListItemIcon>
              <AddCircleOutline />
            </ListItemIcon>
            <ListItemText>
              Add Joint (A)
            </ListItemText>
          </ListItem>

          <ListItem button
                    onClick={(e)=>{
                      const iJoints = [];
                      for (let i=0; i<model.v.length; i++) {
                        if (model.vStatus[i] === 2) iJoints.push(i);
                      }
                      model.addEdges(iJoints);
                      model.precompute();
                      model.forceUpdate();
                      model.resetSelection();
                      updateGUI();
                    }}>
            <ListItemIcon>
              <Link />
            </ListItemIcon>
            <ListItemText>
              Connect Joints (C)
            </ListItemText>
          </ListItem>

          <ListItem button
                    onClick={(e)=>{
                      const iJoints = [];
                      for (let i=0; i<model.v.length; i++) {
                        if (model.vStatus[i] === 2) iJoints.push(i);
                      }
                      model.addTet(iJoints);
                      model.precompute();
                      model.forceUpdate();
                      model.resetSelection();
                      updateGUI();
                    }}>
            <ListItemIcon>
              <ChangeHistory />
            </ListItemIcon>
            <ListItemText>
              Add Tet (T)
            </ListItemText>
          </ListItem>

          <ListItem button
                    onClick={(e)=>{
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
                      updateGUI();
                    }}>
            <ListItemIcon>
              <HighlightOff />
            </ListItemIcon>
            <ListItemText>
              Remove Joint (D)
            </ListItemText>
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <OpenWith />
            </ListItemIcon>
            <ListItemText>
              Move Joint (M)
            </ListItemText>
            <Switch
              key={"add_joint"}
              checked={sharedData.movingJoint}
              onChange={(e,val)=>{
                sharedData.movingJoint = val;
                if (val) {
                  sharedData.removingJoint = false;
                  sharedData.addingJoint = false;
                }
                model.simulate = false;
                model.resetSelection();
                updateGUI();
              }}
            />
          </ListItem>


          <ListItem>
            <ListItemText>
              &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; Move Body
            </ListItemText>
            <Switch
              disabled={!sharedData.movingJoint}
              key={"add_joint"}
              checked={sharedData.movingBody}
              onChange={(e,val)=>{
                sharedData.movingBody = val;
                // model.resetSelection();
                updateGUI();
              }}
            />
          </ListItem>


          {/*<ListItem>*/}
          {/*  <ListItemText>*/}
          {/*    Remove Joint*/}
          {/*  </ListItemText>*/}
          {/*  <Switch*/}
          {/*    key={"remove_joint"}*/}
          {/*    checked={sharedData.removingJoint}*/}
          {/*    onChange={(e,val)=>{*/}
          {/*      sharedData.removingJoint = val;*/}
          {/*      if (val) {*/}
          {/*        sharedData.addingJoint = false;*/}
          {/*        sharedData.movingJoint = false;*/}
          {/*      }*/}
          {/*      updateGUI();*/}
          {/*    }}*/}
          {/*  />*/}
          {/*</ListItem>*/}


          <Divider/>

          <ListItem>
            <ListItemText>
              X:
            </ListItemText>
            <Slider
              key={"sliderX"}
              defaultValue={0}
              arial-labelledby={"continuous-slider"}
              step={0.01}
              min={-Math.PI}
              max={Math.PI}
              valueLabelDisplay={"auto"}
              onMouseDown={(e)=>{
                // model.center();
                // model.Model.gravity = false;
              }}
              onMouseUp={(e)=>{
                // model.center();
                // model.Model.gravity = true;
              }}
              onChange={(e, val)=>{
                model.rotateTo(val, model.euler.y, model.euler.z);
                // model.resetV();
              }}
            />
          </ListItem>


          <ListItem>
            <ListItemText>
              Y:
            </ListItemText>
            <Slider
              key={"sliderY"}
              defaultValue={0}
              arial-labelledby={"continuous-slider"}
              step={0.01}
              min={-Math.PI}
              max={Math.PI}
              valueLabelDisplay={"auto"}
              onMouseDown={(e)=>{
                // model.center();
                // model.Model.gravity = false;
              }}
              onMouseUp={(e)=>{
                // model.center();
                // model.Model.gravity = true;
              }}
              onChange={(e, val)=>{
                model.rotateTo(model.euler.x, val, model.euler.z);
                // model.resetV();
              }}
            />
          </ListItem>

          <ListItem>
            <ListItemText>
              Z:
            </ListItemText>
            <Slider
              key={"sliderZ"}
              defaultValue={0}
              arial-labelledby={"continuous-slider"}
              step={0.01}
              min={-Math.PI}
              max={Math.PI}
              valueLabelDisplay={"auto"}
              onMouseDown={(e)=>{
                // model.center();
                // model.Model.gravity = false;
              }}
              onMouseUp={(e)=>{
                // model.center();
                // model.Model.gravity = true;
              }}
              onChange={(e, val)=>{
                model.rotateTo(model.euler.x, model.euler.y, val);
                // model.resetV();
              }}
            />
          </ListItem>


          <ListItem button
                    onClick={(e)=>{
                      model.numSteps = 0;
                      model.simulate = false;
                      model.v = model.v0;
                      model.center();
                      model.precompute();
                      model.forceUpdate();
                      updateGUI();
                    }}>
            <ListItemIcon>
              <FilterCenterFocus />
            </ListItemIcon>
            <ListItemText>
              Center Model
            </ListItemText>
          </ListItem>


          {/*<ListItem button*/}
          {/*          onClick={(e)=>{*/}
          {/*            model.recordV();*/}
          {/*          }}>*/}
          {/*  <ListItemIcon>*/}
          {/*    <SettingsEthernet />*/}
          {/*  </ListItemIcon>*/}
          {/*  <ListItemText>*/}
          {/*    Record V*/}
          {/*  </ListItemText>*/}
          {/*</ListItem>*/}

          {/*<ListItem button*/}
          {/*          onClick={(e)=>{*/}
          {/*            const iJointsSelected = [];*/}
          {/*            for (let i=0; i<model.v.length; i++) {*/}
          {/*              if (model.vStatus[i] === 2) iJointsSelected.push(i);*/}
          {/*            }*/}

          {/*            model.align(true, iJointsSelected);*/}
          {/*            model.forceUpdate();*/}
          {/*          }}>*/}
          {/*  <ListItemIcon>*/}
          {/*    <VerticalAlignCenter />*/}
          {/*  </ListItemIcon>*/}
          {/*  <ListItemText>*/}
          {/*    Align with X-axis*/}
          {/*  </ListItemText>*/}
          {/*</ListItem>*/}

          {/*<ListItem button*/}
          {/*          onClick={(e)=>{*/}
          {/*            // model.resetV();*/}
          {/*            model.forceUpdate();*/}
          {/*          }}>*/}
          {/*  <ListItemIcon>*/}
          {/*    <SettingsEthernet />*/}
          {/*  </ListItemIcon>*/}
          {/*  <ListItemText>*/}
          {/*    Reset*/}
          {/*  </ListItemText>*/}
          {/*</ListItem>*/}

        </List>


    </div>,

    <div key={"scriptGUI"} className={classes.scriptGUI}
         style={sharedData.editingScript ? {display: "block"} : {display: "block"}}
         onPointerOver={(e)=>{sharedData.GUIHovered=true}}
         onPointerOut={(e)=>{sharedData.GUIHovered=false}}
    >
      <TemporalControl model={model} sharedData={sharedData} classes={classes} updateGUI={updateGUI}/>
    </div>,


    <div key={"editingScriptGUI"} className={classes.editingScriptGUI}
         style={sharedData.editingScript ? {display: "block"} : {display: "none"}}
         onPointerOver={(e)=>{sharedData.GUIHovered=true}}
         onPointerOut={(e)=>{sharedData.GUIHovered=false}}
    >

      <Grid key={'numChannels'} container item spacing={2} alignItems={"center"} style={{
        padding:`${paddingBlocks}vh`, paddingTop:'0', paddingBottom:'0', width: `${widthSliders + 20}vh`
      }}>
        <Grid item style={{margin: `${marginSlider}vh`, width: "10vh", fontSize:"small"}}>
          Channels
        </Grid>
        <Grid item style={{margin:`${marginSlider}vh` , width: `${widthSlider}vh`}}>

          <Slider
            key={'numChannels'}
            defaultValue={model.Model.defaultNumChannels}
            aria-labelledby={"discrete-slider-custom"}
            step={1}
            min={1}
            max={5}
            valueLabelDisplay={"auto"}
            onChange={(e, val)=>{
              model.numChannels = val;
              model.precompute();
              updateGUI();
            }}
          />
        </Grid>
      </Grid>

      <Grid key={'numActions'} container item spacing={2} alignItems={"center"} style={{
        padding:`${paddingBlocks}vh`, paddingTop:'0', paddingBottom:'0', width: `${widthSliders + 20}vh`
      }}>
        <Grid item style={{margin: `${marginSlider}vh`,  width: "10vh", fontSize:"small"}}>
          Actions
        </Grid>
        <Grid item style={{margin:`${marginSlider}vh` , width: `${widthSlider}vh`}}>

          <Slider
            key={'numActions'}
            defaultValue={model.Model.defaultNumActions}
            aria-labelledby={"discrete-slider-custom"}
            step={1}
            min={1}
            max={20}
            valueLabelDisplay={"auto"}
            onChange={(e, val)=>{
              model.numActions = val;
              model.precompute();
              updateGUI();
            }}
          />
        </Grid>
      </Grid>

    </div>,


    <div key={"examples"} className={classes.examples} >
      <Examples/>
    </div>,

    <div key={"help"} className={classes.help} >
      <Help/>
    </div>

  ]
  )
}


export default GUI;
