import './js/handsfree'
import * as THREE from 'three';

import { drawFirstFrame } from './js/firstFrame';
import { setupRenderTargets } from './js/renderTargets';
import { setupStats, updateStats } from './js/stats';
import { setupUI } from './js/ui';
import { setupMap } from './js/map';
import { setupKeyboard } from './js/keyboard';
import { setupMouse } from './js/mouse';
import { setupMIDI } from './js/midi';

import { simulationUniforms, displayUniforms } from './js/uniforms';
import { simulationMaterial, displayMaterial } from './js/materials';
import parameterValues from './js/parameterValues';

let currentRenderTargetIndex = 0;  // render targets are invisible meshes that allow shaders to generate textures for computation, not display
const pingPongSteps = 60;          // number of times per frame that the simulation is run before being displayed
global.isPaused = false;

let clock = new THREE.Clock();

setupEnvironment();         // set up the camera, scene, and other stuff ThreeJS needs to
setupStats(pingPongSteps);  // set up the FPS and iteration counters
setupUI();                  // set up the Tweakpane UI
setupMap();                 // set up the live parameter map picker
setupKeyboard();            // set up keyboard commands
setupMouse();               // set up mouse controls
setupMIDI();                // set up MIDI mappings
update();                   // kick off the main render loop

//==============================================================
//  ENVIRONMENT (scene, camera, display mesh, etc)
//  - ThreeJS needs a few fundamental elements in order to
//    display something on the screen: a camera, a renderer,
//    and a scene containing one or more meshes.
//  - In this sketch, we're creating a flat plane and orienting
//    it perpendicular to the camera, taking up the entire
//    viewing area (the screen). The reaction-diffusion output
//    is rendered to this mesh as a texture, making it look
//    perfectly 2D.
//==============================================================
function setupEnvironment() {
  // Set up the camera and scene
  global.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  global.scene = new THREE.Scene();

  // Create a plane and orient it perpendicular to the camera so it seems 2D
  global.displayMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2,2), displayMaterial);
  scene.add(displayMesh);

  // Set up the renderer (a WebGL context inside a <canvas>)
  global.renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
  renderer.setSize(parameterValues.canvas.width, parameterValues.canvas.height);

  // Uncomment this line to see how many shader varyings your GPU supports.
  // console.log(renderer.capabilities.maxVaryings);

  global.canvas = renderer.domElement;

  // Grab the container DOM element and inject the <canvas> element generated by the renderer
  document.getElementById('container').appendChild(canvas);

  // Update the renderer dimensions whenever the browser is resized
  window.addEventListener('resize', resetTextureSizes, false);
  resetTextureSizes();

  // Set up and render the first frame
  drawFirstFrame();
}

  export function resetTextureSizes() {
    parameterValues.canvas.width = canvas.clientWidth;
    parameterValues.canvas.height = canvas.clientHeight;

    // Resize render targets
    setupRenderTargets();

    // Reset the resolution in the simulation code to match new container size
    simulationUniforms.resolution.value = new THREE.Vector2(parameterValues.canvas.width, parameterValues.canvas.height);

    // Resize the buffer canvas
    global.bufferCanvas = document.querySelector('#buffer-canvas');
    bufferCanvas.width = parameterValues.canvas.width;
    bufferCanvas.height = parameterValues.canvas.height;
  }


//==============================================================
//  UPDATE
//  - Main program loop, runs once per frame no matter what.
//==============================================================
function update() {
  if(!isPaused) {
    // Activate the simulation shaders
    displayMesh.material = simulationMaterial;

    // Run the simulation multiple times by feeding the result of one iteration (a render target's texture) into the next render target
    for(let i=0; i<pingPongSteps; i++) {
      var nextRenderTargetIndex = currentRenderTargetIndex === 0 ? 1 : 0;

      simulationUniforms.previousIterationTexture.value = renderTargets[currentRenderTargetIndex].texture;  // grab the result of the last iteration
      renderer.setRenderTarget(renderTargets[nextRenderTargetIndex]);                                       // prepare to render into the next render target
      renderer.render(scene, camera);                                                                       // run the simulation shader on that texture
      simulationUniforms.previousIterationTexture.value = renderTargets[nextRenderTargetIndex].texture;     // save the result of this simulation step for use in the next step
      displayUniforms.textureToDisplay.value = renderTargets[nextRenderTargetIndex].texture;                // pass this result to the display material too
      displayUniforms.previousIterationTexture.value = renderTargets[currentRenderTargetIndex].texture;     // pass the previous iteration result too for history-based rendering effects

      currentRenderTargetIndex = nextRenderTargetIndex;
    }

    // Activate the display shaders
    displayUniforms.time.value = clock.getElapsedTime();
    displayMesh.material = displayMaterial;

    // Render the latest iteration to the screen
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  }

  // Tick the FPS and iteration counters
  updateStats(isPaused);

  // Kick off next frame
  requestAnimationFrame(update);
}
