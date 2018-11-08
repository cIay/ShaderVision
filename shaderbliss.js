let fragShaders = null;
let flags = {
  execNewShaders: false,
  resetFBO: false,
  resetAudio: false,
};
let state = {
  audioSource: null, // 'video', 'mic', 'none'
  mediaType: null // 'video', 'image'
  /*
  uniformFlags: {
    fft: true,
    time: true,
    energy: true
  }
  */
}

if (document.readyState == 'loading') {
  document.addEventListener('readystatechange', main);
}
else {
  main();
}


function main() {
  const elements = {
    video: document.getElementsByTagName('video')[0],
    image: document.getElementsByTagName('img')[0],
    media: null,
    canvas: null
  };

  if (elements.video) {
    state.mediaType = 'video';
    elements.media = elements.video;
  }
  else if (elements.image) {
    state.mediaType = 'image';
    elements.media = elements.image;
  }

  //console.log("video source: " + elements.video.src);
  //console.log("video readyState: " + elements.video.readyState);

  const observers = {
    resizeObserver: null,
    attributeObserver: null,
    childObserver: null
  }

  initCanvas(elements);

  const gl = elements.canvas.getContext('webgl2', {
    preserveDrawingBuffer: true
  });
  if (!gl) {
    alert('ShaderBliss: Unable to initialize WebGL. Your browser or machine may not support it.'); 
    return;
  }

  let recorder = new Recorder(elements.canvas);
  let audio = new AudioProcessor();

  initObservers(observers, elements);

  document.addEventListener('keypress', (e) => {
    if (e.key == 'r') {
      if (fragShaders) {
        recorder.toggleRecording();
      }
    }
    else if (e.key == 's') {
      if (fragShaders) {
        recorder.takeScreenshot();
      }
    }
    else if (e.key == 'x') {
      chrome.runtime.sendMessage({requestShaders: true});
    }
    /*
    else if (e.key == 'p') {
      console.log(elements.media);
      //console.log(elements.video.readyState);
      //resetPage(elements, oldAttributes);   
    }
    */
  });

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.target == 'canvas') {
      if (request.ping) {
        sendResponse({pong: true});
      }

      else if (request.shaders && request.settings) {
        applySettings(request.settings, audio, recorder);
        initMediaStream(elements, audio, recorder);

        if (fragShaders === null) {
          showCanvas(elements);
          hideMedia(elements);
          fragShaders = request.shaders.contents;
          execShaders(gl, request.shaders.settings, elements, audio, recorder);
        }
        else {
          flags.execNewShaders = true;
          // wait for previous render loop to return
          (function waitThenExecute() {
            if (flags.execNewShaders) {
              setTimeout(waitThenExecute, 50);
            }
            else {
              fragShaders = request.shaders.contents;
              execShaders(gl, request.shaders.settings, elements, audio, recorder);
            }
          })();
        }
      }
    }
  });
}


function execShaders(gl, settings, elements, audio, recorder) {
  console.log("ShaderBliss: Executing");

  function endProgram() {
    fragShaders = null;
    showMedia(elements);
    hideCanvas(elements);
    console.log("ShaderBliss: Dead");
  }
  const programInfo = initPrograms(gl);
  if (programInfo === null) {
    endProgram();
    return;
  }

  const buffer = initBuffer(gl);
  const texture = initTexture(gl);
  const freqTexture = initTexture(gl); 
  const timeTexture = initTexture(gl);
  let pingPongData = initFboPingPong(gl, programInfo);
  flags.resetFBO = false;

  let prevTime = 0.0;
  let prevEnergy = 0.0;
  let energyArray = [];

  // Draw the scene repeatedly
  function render(time) {
    //time *= 0.001;  // convert to seconds
    const deltaTime = time - prevTime;
    prevTime = time;

    if (flags.execNewShaders) {
      clearScene(gl);
      flags.execNewShaders = false;
      return;
    }

    if (flags.resetFBO) {
      //console.log("resetFBO");
      pingPongData = initFboPingPong(gl, programInfo);
      flags.resetFBO = false;
    }

    if (flags.resetAudio) {
      //console.log("resetAudio");
      initMediaStream(elements, audio, recorder);
      flags.resetAudio = false;
    }

    let energy = audio.smoothEnergy(energyArray, prevEnergy);
    prevEnergy = energy;

    updateAudio(gl, freqTexture, timeTexture, audio);

    if (!updateTexture(gl, texture, elements.media)) {
      if (elements.media.currentSrc) {
        chrome.runtime.sendMessage({tabUrl: elements.media.currentSrc});
      }
      endProgram();
      return;
    }
    
    const uniforms = {
      time: time,
      deltaTime: deltaTime,
      energy: energy
    };
    drawScene(gl, programInfo, buffer, pingPongData, uniforms);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

function initBuffer(gl) {
  buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const positions = [-1.0, -1.0, 
                      1.0, -1.0, 
                      -1.0, 1.0, 
                      1.0, -1.0, 
                      1.0, 1.0, 
                      -1.0, 1.0];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW );
  return buffer;
}


function initTexture(gl) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  // Turn off mips and set wrapping to clamp to edge so it
  // will work regardless of the dimensions of the video.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  return texture;
}

function initFboPingPong(gl, programInfo) {
  if (programInfo.length == 1) {
    return null;
  }

  const pingPongData = {
    textures: [],
    framebuffers: []
  };
  for (let i = 0; i < 2; i++) {
    const texture = initTexture(gl);
    pingPongData.textures.push(texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                  gl.canvas.width, gl.canvas.height, 0,
                  gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fbo = gl.createFramebuffer();
    pingPongData.framebuffers.push(fbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, 
                            gl.TEXTURE_2D, texture, 0);
  }

  return pingPongData;
}


// Copy the video texture
function updateTexture(gl, texture, media) {
  const level = 0;
  const internalFormat = gl.RGBA;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  if (media.nodeName == 'VIDEO' && media.readyState < 3) {
    return true;
  }
  try {
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  srcFormat, srcType, media);
  }
  catch (err) {
    console.log("ShaderBliss: " + err);
    return false;
  }
  return true;
}

function updateAudio(gl, freqTexture, timeTexture, audio) {
  if (state.audioSource == 'video' || state.audioSource == 'mic') {
    audio.analyser.getByteFrequencyData(audio.frequencyData);
    audio.analyser.getByteTimeDomainData(audio.timeDomainData);
  }
  else {
    audio.frequencyData.fill(0);
    audio.timeDomainData.fill(0);
  }

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, freqTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, audio.frequencyData.length, 1, 0,
                gl.LUMINANCE, gl.UNSIGNED_BYTE, audio.frequencyData);
  
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, timeTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, audio.timeDomainData.length, 1, 0,
                gl.LUMINANCE, gl.UNSIGNED_BYTE, audio.timeDomainData);

  gl.activeTexture(gl.TEXTURE0);
}

function clearScene(gl) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
  gl.clearDepth(1.0);                 // Clear everything
  gl.enable(gl.DEPTH_TEST);           // Enable depth testing
  gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

  // Clear the canvas before we start drawing on it.
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

function drawScene(gl, programInfo, buffer, pingPongData, uniforms) {

  function bindAndDraw(programIndex, fbo) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.uniform1i(programInfo[programIndex].uniformLocations.texture, 0);
    gl.uniform2f(programInfo[programIndex].uniformLocations.resolution, 
                 gl.canvas.width, gl.canvas.height);
    //if (state.audioSource) {
      gl.uniform1i(programInfo[programIndex].uniformLocations.freqData, 1);
      gl.uniform1i(programInfo[programIndex].uniformLocations.timeData, 2);
      gl.uniform1f(programInfo[programIndex].uniformLocations.energy, uniforms.energy);
    //}
    gl.uniform1f(programInfo[programIndex].uniformLocations.time, uniforms.time);
    gl.uniform1f(programInfo[programIndex].uniformLocations.deltaTime, uniforms.deltaTime);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);  
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // Apply each shader by fbo ping-ponging
  for (let i = 0; i < programInfo.length; i++) {
    {
      const numComponents = 2;
      const type = gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(programInfo[i].attribLocations.vertexPosition,
                             numComponents, type, normalize, stride, offset);
      gl.enableVertexAttribArray(programInfo[i].attribLocations.vertexPosition);
    }

    // Tell WebGL to use our program when drawing
    gl.useProgram(programInfo[i].program);
    // Tell WebGL we want to affect texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    
    if (i != programInfo.length-1) {
      bindAndDraw(i, pingPongData.framebuffers[i%2]);
      gl.bindTexture(gl.TEXTURE_2D, pingPongData.textures[i%2]);
    }
    else if (programInfo.length > 1) {
      gl.bindTexture(gl.TEXTURE_2D, pingPongData.textures[(i+1)%2]);
    }
  }
  bindAndDraw(programInfo.length-1, null);

}

function initPrograms(gl) {
  // Vertex shader program
  const vsSource = `
    attribute vec4 aVertexPosition;

    void main(void) {
      gl_Position = aVertexPosition;
    }
  `;

  if (fragShaders.length == 0) {
    return null;
    //fragShaders.push(fsSource);
  }

  const shaderPrograms = [];
  const programInfo = [];
  for (let i = 0; i < fragShaders.length; i++) {
    shaderPrograms.push(initShaderProgram(gl, vsSource, fragShaders[i]));
    if (shaderPrograms[i] == null) {
      return null;
    }
    programInfo.push({
      program: shaderPrograms[i],
      attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderPrograms[i], 'aVertexPosition')
      },
      uniformLocations: {
        texture: gl.getUniformLocation(shaderPrograms[i], 'texture'),
        resolution: gl.getUniformLocation(shaderPrograms[i], 'resolution'),
        freqData: gl.getUniformLocation(shaderPrograms[i], 'freqData'),
        timeData: gl.getUniformLocation(shaderPrograms[i], 'timeData'),
        energy: gl.getUniformLocation(shaderPrograms[i], 'energy'),
        time: gl.getUniformLocation(shaderPrograms[i], 'time'),
        deltaTime: gl.getUniformLocation(shaderPrograms[i], 'deltaTime')
      }
    });
  }

  return programInfo;
}

// Initialize a shader program, so WebGL knows how to draw our data
function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (vertexShader == null || fragmentShader == null) {
    return null;
  }

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('ShaderBliss: Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

// Creates a shader of the given type, uploads the source and compiles it
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('ShaderBliss: An error occurred compiling the shader: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}






/* Canvas injection & formatting */

function setDimensions(elements) {
  const canvasScaling = 1.0;

  let mediaWidth, mediaHeight;
  if (state.mediaType == 'video') {
    mediaWidth = elements.media.videoWidth;
    mediaHeight = elements.media.videoHeight;
  }
  else if (state.mediaType == 'image') {
    mediaWidth = elements.media.width;
    mediaHeight = elements.media.height;  
  }

  //console.log("mediaWidth: " + mediaWidth);
  //console.log("mediaHeight: " + mediaHeight);


  if (elements.canvas.width != mediaWidth || elements.canvas.height != mediaHeight) {
    flags.resetFBO = true;
  }
  
  elements.canvas.width = mediaWidth * canvasScaling;
  elements.canvas.height = mediaHeight * canvasScaling;
  //const ratio = elements.video.videoWidth / elements.video.videoHeight;
  elements.canvas.style.width = elements.media.clientWidth + "px";
  elements.canvas.style.height = elements.media.clientHeight + "px";
  /*
  console.log("canvas width: " + elements.canvas.width);
  console.log("canvas height: " + elements.canvas.height);
  console.log("canvas style width: " + elements.canvas.style.width);
  console.log("canvas style height: " + elements.canvas.style.height);
  */
}

function showCanvas(elements) {
  if (elements.canvas) {
    elements.canvas.style.visibility = '';
  }
}

function hideCanvas(elements) {
  if (elements.canvas) {
    elements.canvas.style.visibility = 'hidden';
  }
}

function showMedia(elements) {
  if (elements.media) {
    elements.media.style.visibility = '';
  }
}

function hideMedia(elements) {
  ////if (elements.video.parentElement.nodeName == 'BODY')
  ////elements.video.style.display = 'none';
  if (state.mediaType == 'video') {
    if (!elements.video.controls) {
      elements.media.style.visibility = 'hidden';
    }
  }
  else if (state.mediaType == 'image') {
    elements.media.style.visibility = 'hidden';
  }
}

function reStyle(elements) {
  if (state.mediaType == 'video') {
    if (elements.video.controls) {
      elements.video.style.position = 'static';
      elements.video.parentNode.style.display = 'flex';
      elements.video.parentNode.style.alignItems = 'center';
      elements.video.parentNode.style.justifyContent = 'center';
      elements.video.parentNode.style.height = '100vh';
      elements.video.parentNode.style.margin = '0';
    }
  }
}

function initCanvas(elements) {
  if (elements.canvas !== null) {
    elements.canvas.parentNode.removeChild(elements.canvas);
  }
  elements.canvas = document.createElement('canvas');
  elements.canvas.id = 'shaderbliss-canvas';
  elements.canvas.style.margin = '0px auto';
  elements.canvas.style.display = 'block';
  elements.canvas.style.visibility = 'hidden';
  elements.canvas.style.objectFit = 'contain'
  ////elements.canvas.className = elements.video.className;
  ////elements.canvas.style.cssText = window.getComputedStyle(elements.video).cssText;
  elements.canvas.style.position = 'absolute';
  setDimensions(elements);
  reStyle(elements);
  elements.media.insertAdjacentElement('beforebegin', elements.canvas);
}



function initResizeObserver(resizeObserver, elements) {

  if (resizeObserver) {
    resizeObserver.disconnect();
  }

  let handleResize = function(entry) {
    //console.log("resize!");
    //console.log(entry);
    setDimensions(elements);
  };

  resizeObserver = new ResizeObserver(function(entries) {
    if (fragShaders) {
      entries.forEach(handleResize);
    }
  });
  resizeObserver.observe(elements.media);

  return resizeObserver;
}


function initAttributeObserver(attributeObserver, elements) {

  if (attributeObserver) {
    attributeObserver.disconnect();
  }

  let handleMutation = function(mutation) {
    // video style change.. make sure it is still hidden
    if (mutation.type == 'attributes' && mutation.attributeName == 'style') {
      //console.log('style!');
      attributeObserver.disconnect();
      hideMedia(elements);
      attributeObserver.observe(elements.video, {attributes: true});
    }
    // video source change, so ensure correct dimensions
    if (mutation.type == 'attributes' && mutation.attributeName == 'src') {
      //console.log('src!');
      if (elements.video.readyState == 0) {
        //console.log("HAVE NOTHING");
        attributeObserver.disconnect();
        elements.video.addEventListener('loadedmetadata', (e) => {
          //console.log('loadedmetadata');
          setDimensions(elements);
          e.target.removeEventListener(e.type, arguments.callee);
        });
        attributeObserver.observe(elements.video, {attributes: true});
      }
      else {
        //console.log('HAVE METADATA');
        setDimensions(elements);
      }
    }
  }

  attributeObserver = new MutationObserver(function(mutationsList) {
    if (fragShaders) {
      mutationsList.forEach(handleMutation);
    }
  });
  attributeObserver.observe(elements.video, {attributes: true}); ////attributeOldValue: true

  return attributeObserver;
}


function initChildObserver(childObserver, elements) {

  if (childObserver) {
    childObserver.disconnect();
  }

  let handleMutation = function(mutation) {
    if (mutation.type == 'childList' && mutation.addedNodes.length > 0) {
      for (let node of mutation.addedNodes) {
        // switch to the new video
        if (node.nodeName == 'VIDEO') {
          //console.log('new video...');
          elements.video = node;
          flags.resetAudio = true;
          resizeObserver.disconnect();
          resizeObserver.observe(elements.video);
          attributeObserver.disconnect();
          attributeObserver.observe(elements.video, {attributes: true});
          break;
        }
      }
    }
  }

  childObserver = new MutationObserver(function(mutationsList) {
    if (fragShaders) {
      mutationsList.forEach(handleMutation);
    }
  });
  childObserver.observe(elements.video.parentElement, {childList: true});

  return childObserver;
}

function initObservers(observers, elements) {
  observers.resizeObserver = initResizeObserver(observers.resizeObserver, elements);
  if (state.mediaType == 'video') {
    observers.attributeObserver = initAttributeObserver(observers.attributeObserver, elements);
    observers.childObserver = initChildObserver(observers.childObserver, elements);
  }
}






function Recorder(canvas) {
// Public:
  this.recordingFlag = false;
  this.options = {
    videoBitsPerSecond: null,
    audioBitsPerSecond: null,
    mimeType: 'video/webm; codecs="vp8"' // alternative: vp9,opus
  };

  this.setOptions = (videoBitrate, audioBitrate) => {
    this.options.videoBitsPerSecond = videoBitrate;
    this.options.audioBitsPerSecond = audioBitrate;
  };

  this.setStream = (audioStream) => {
    this.stream = canvas.captureStream(60); // fps
    if (audioStream) {
      let track = audioStream.getAudioTracks()[0];
      this.stream.addTrack(track);
    }
  };

  this.toggleRecording = () => {
    if (!this.recordingFlag) {
      if (this.stream) {
        this.recordingFlag = true;
        startRecording();
      }
    }
    else {
      this.recordingFlag = false;
      stopRecording();
    }
  };

  this.takeScreenshot = () => {
    chrome.runtime.sendMessage({tabUrl: canvas.toDataURL('image/png')});
  };

// Private:
  let mediaRecorder;

  let recIcon = document.createElement('img');
  recIcon.id = 'shaderbliss-rec';
  recIcon.src = chrome.runtime.getURL("images/rec64.png");
  recIcon.style.position = 'absolute';
  recIcon.style.top = '0%';
  recIcon.style.left = '0%';
  recIcon.style.transform = 'scale(0.7)';
  recIcon.style.padding = '4px';


  let startRecording = () => {
    mediaRecorder = new MediaRecorder(this.stream, this.options);
    let recordedBlobs = [];

    mediaRecorder.onstop = () => {
      const buf = new Blob(recordedBlobs, {type: this.options.mimeType});
      const recSource = window.URL.createObjectURL(buf);
      chrome.runtime.sendMessage({tabUrl: recSource});
    }

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedBlobs.push(event.data);
      }
    }

    const timeslice = 3000; // ms
    mediaRecorder.start(timeslice);

    console.log("ShaderBliss: Started recording");
    canvas.insertAdjacentElement('afterend', recIcon);
  };

  let stopRecording = () => {
    mediaRecorder.stop();
    console.log("ShaderBliss: Stopped recording");
    canvas.parentElement.removeChild(recIcon);
  };
}





function AudioProcessor() {

  this.context = new AudioContext();

  this.analyser = this.context.createAnalyser();
  
  this.setBuffers = (fftSize, smoothingFactor) => {
    this.analyser.fftSize = fftSize;
    this.analyser.smoothingTimeConstant = smoothingFactor;
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeDomainData = new Uint8Array(this.analyser.frequencyBinCount);

    this.energyBuf = new Float32Array(128);
    this.energySmoothingFactor = 1.0 - smoothingFactor;
    this.energySmoothingMemory = 12;
  }

  this.connectSource = (mediaSource) => {
    this.source = mediaSource;
    if (mediaSource.mediaStream) {
      this.source.connect(this.analyser);
      this.stream = mediaSource.mediaStream;
    }
    else if (mediaSource.mediaElement) {
      this.source.connect(this.analyser);
      this.analyser.connect(this.context.destination);
      let dest = this.context.createMediaStreamDestination();
      this.source.connect(dest);
      this.stream = dest.stream;
    }
  };

  this.smoothEnergy = (energyArray, prevEnergy) => {
    let energy = calcEnergy();

    if (energyArray.length == this.energySmoothingMemory) {
      energyArray.shift();
    }
    energyArray.push(energy);

    let cur, prev = prevEnergy;
    for (let i = 0; i < energyArray.length; i++) {
      cur = this.energySmoothingFactor*energyArray[i] + (1.0-this.energySmoothingFactor)*prev;
      prev = cur;
    }

    return cur;
  };

  let calcEnergy = () => {
    this.analyser.getFloatTimeDomainData(this.energyBuf);
    let e = this.energyBuf.reduce(function(acc, val) {
      let amp = Math.abs(val);
      return acc + amp*amp;
    });
    return e / this.energyBuf.length;
  };
}


function initMediaStream(elements, audio, recorder) {

  if (state.audioSource == 'mic') {
    let contraints = {
      channelCount : {ideal: 2},
      autoGainControl: false,
      echoCancellation: false,
      noiseSuppression: false
    };

    //console.log(navigator.mediaDevices.getSupportedConstraints());
    navigator.mediaDevices.getUserMedia({audio: contraints}).then((stream) => {
      try {
        audio.connectSource(audio.context.createMediaStreamSource(stream));
      } catch {}
      recorder.setStream(audio.stream);
    });
  }
  else if (state.audioSource == 'video' && state.mediaType == 'video') {
    try {
      audio.connectSource(audio.context.createMediaElementSource(elements.video));
    } catch {}
    recorder.setStream(audio.stream);
  }
  else {
    recorder.setStream();
  }
}

function applySettings(settings, audio, recorder) {
  state.audioSource = settings.audioSource;
  recorder.setOptions(settings.videoBitrate, settings.audioBitrate);
  audio.setBuffers(settings.fftSize, settings.smoothingFactor);
}