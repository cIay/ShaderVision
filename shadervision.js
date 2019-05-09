let fragShaders = null;
let flags = {
  execNewShaders: false,
  killProgram: false,
  resetFBO: false,
  resetAudio: false,
  takeScreenshot: false
};
let state = {
  audioSource: null, // 'video', 'mic', or 'none'
  mediaType: null // 'video' or 'image'
}

if (document.readyState == 'loading') {
  document.addEventListener('readystatechange', main);
}
else {
  main();
}

/*
function attachPlayListeners(videos, elements) {
  for (let i = 0; i < videos.length; i++) {
    videos[i].addEventListener('play', function() {
      state.mediatype = 'video';
      elements.video = videos[i];
      elements.media = elements.video;
    });
  }
}
*/

function main() {

  function getLargestElement(elementList) {
    if (elementList[0]) {
      var largestElement = elementList[0];
      let dimensions = largestElement.width * largestElement.height;
      for (let i = 1; i < elementList.length; i++) {
        let curDimensions = elementList[i].width * elementList[i].height;
        if (curDimensions > dimensions) {
          largestElement = elementList[i];
          dimensions = curDimensions;
        }
      }
      return largestElement;
    }
    else {
      return null;
    }
  }

  const elements = {
    video: getLargestElement(document.getElementsByTagName('video')),
    image: getLargestElement(document.getElementsByTagName('img')),
    media: null,
    canvas: null
  };

  if (elements.video) {
    state.mediaType = 'video';
    elements.media = elements.video;
    //attachPlayListeners(document.getElementsByTagName('video'), elements);
  }
  else if (elements.image) {
    state.mediaType = 'image';
    elements.media = elements.image;
  }
  else {
    return;
  }



  function testOrigin(media) {
    const pageOrigin = location.origin;
    const sourceOrigin = (media.currentSrc) ? (new URL(media.currentSrc)).origin : null;
    if (pageOrigin == 'file://' && state.mediaType == 'video')
      return false;
    else
      return pageOrigin == sourceOrigin;
  }

  if (!testOrigin(elements.media)) {
    chrome.runtime.sendMessage({tabUrl: elements.media.currentSrc});
    return;
  }

  initCanvas(elements);

  const gl = elements.canvas.getContext('webgl2', {
    powerPreference: "high-performance",
    preserveDrawingBuffer: false
  });
  if (!gl) {
    alert('ShaderVision: Unable to initialize WebGL. Your browser or machine may not support it.'); 
    return;
  }
  //gl.hint(); gl.getParameter();

  let recorder = new Recorder(elements.canvas);
  let audio = new AudioProcessor();


  const observers = {
    resizeObserver: null,
    attributeObserver: null,
    childObserver: null
  }
  initObservers(observers, elements);

  document.addEventListener('keydown', (e) => {
    if (e.altKey) {
      switch (e.key) {
        case 'r':
          if (fragShaders) {
            recorder.toggleRecording();
          }
          break;

        case 's':
          if (fragShaders) {
            flags.takeScreenshot = true;
          }
          break;

        case 'k':
          if (fragShaders) {
            flags.killProgram = true;
          }
          break;

        case 'a':
          chrome.runtime.sendMessage({requestShaders: true});
      }
    }
  });

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.target != 'canvas') {
      return;
    }

    if (request.ping) {
      sendResponse({pong: true});
      return;
    }

    if (!request.shaders || !request.settings) {
      return;
    }

    //console.log(request);

    applySettings(request.settings, audio, recorder);
    initMediaStream(elements, audio, recorder);

    const bufferInfo = initBufferInfo(request.shaders.bufNums);
  
    if (fragShaders === null) {
      showCanvas(elements);
      hideMedia(elements);
      fragShaders = request.shaders.contents;
      execShaders(gl, request.settings, request.textures, bufferInfo,
                  elements, audio, recorder);
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
          execShaders(gl, request.settings, request.textures, bufferInfo,
                      elements, audio, recorder);
        }
      })();
    }
  });
}


function execShaders(gl, settings, images, bufferInfo, elements, audio, recorder) {
  console.log("ShaderVision: Running...");
  const fps = null;
  const mipmapsFlag = false;
  const maxRenders = null;
  const textureUnitMap = {
    frame: 0,
    prevFrame: 1,
    curFrame: 2,
    freqData: 3,
    timeData: 4,
    tex: 5,
    buf: 5+images.length
  };

  function endProgram(options) {
    fragShaders = null;
    if (options) {
      if (options.showMedia)
        showMedia(elements);
      if (options.hideCanvas)
        hideCanvas(elements);
      if (options.removeCanvas)
        removeCanvas(elements);
    }
    console.log("ShaderVision: Dead");
  }
  setDimensions(elements);

  const programInfo = initPrograms(gl, images.length, bufferInfo);
  if (programInfo === null) {
    endProgram({showMedia: true, hideCanvas: true});
    return;
  }
  initVertexArray(gl, programInfo);

  const uniforms = {
    mouse: {x: 0.0, y: 0.0},
    bass: 0,
    avgBass: 0,
    mid: 0,
    avgMid: 0,
    treb: 0,
    avgTreb: 0,
    energy: 0,
    avgEnergy: 0,
    time: 0,
    timeDelta: 0,
    drawCount: 0
  };
  initMouseListener(elements, uniforms.mouse);

  gl.activeTexture(gl.TEXTURE0);
  const minification = (mipmapsFlag) ? gl.NEAREST_MIPMAP_LINEAR : null;
  const frameTextures = [initTexture(gl, minification), 
                         initTexture(gl, minification)];
  const freqTexture = initTexture(gl); 
  const timeTexture = initTexture(gl);

  let pingPongData = initFramebuffers(gl, programInfo, 2);
  let bufferData = initFramebuffers(gl, programInfo, bufferInfo.numBuffers*2);
  flags.resetFBO = false;

  initImageTextures(gl, images, textureUnitMap, mipmapsFlag);
  
  const initialTime = performance.now();
  let prevTime = 0.0;
  // Draw the scene repeatedly
  function render() {
    uniforms.time = performance.now() - initialTime;
    uniforms.time *= 0.001;  // convert to seconds
    uniforms.timeDelta = uniforms.time - prevTime;
    prevTime = uniforms.time;

    if (maxRenders && maxRenders <= uniforms.drawCount) {
      endProgram();
      return;
    }

    if (flags.killProgram) {
      flags.killProgram = false;
      endProgram({showMedia: true, hideCanvas: true});
      return;
    }

    if (flags.execNewShaders) {
      clearScene(gl);
      flags.execNewShaders = false;
      return;
    }

    if (flags.resetFBO) {
      //console.log("resetFBO");
      pingPongData = initFramebuffers(gl, programInfo, 2);
      bufferData = initFramebuffers(gl, programInfo, bufferInfo.numBuffers*2);
      flags.resetFBO = false;
    }

    if (flags.resetAudio) {
      //console.log("resetAudio");
      initMediaStream(elements, audio, recorder);
      flags.resetAudio = false;
    }

    updateAudio(gl, freqTexture, timeTexture, audio, textureUnitMap, uniforms);

    if (!updateTexture(gl, frameTextures[uniforms.drawCount%2], elements.media, mipmapsFlag)) {
      //if (elements.media.currentSrc)
        //chrome.runtime.sendMessage({tabUrl: elements.media.currentSrc});
      endProgram({showMedia: true, removeCanvas: true});
      return;
    }
    // update prevFrame
    gl.activeTexture(gl.TEXTURE0+textureUnitMap['prevFrame']);
    gl.bindTexture(gl.TEXTURE_2D, frameTextures[(uniforms.drawCount+1)%2]);
    // update curFrame
    gl.activeTexture(gl.TEXTURE0+textureUnitMap['curFrame']);
    gl.bindTexture(gl.TEXTURE_2D, frameTextures[uniforms.drawCount%2]);


    drawScene(gl, programInfo, uniforms, pingPongData, bufferData, bufferInfo, textureUnitMap);


    if (flags.takeScreenshot) {
      recorder.takeScreenshot();
      flags.takeScreenshot = false;
    }
    
    uniforms.drawCount++;

    if (fps)
      setTimeout(render, 1000/fps);
    else
      requestAnimationFrame(render);
  }

  if (fps)
    render();
  else
    requestAnimationFrame(render);
}

function initVertexArray(gl, programInfo) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const positions = [-1.0, -1.0, 
                      1.0, -1.0, 
                      -1.0, 1.0, 
                      1.0, -1.0, 
                      1.0, 1.0, 
                      -1.0, 1.0];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  for (let i = 0; i < programInfo.length; i++) {
    gl.vertexAttribPointer(programInfo[i].attribLocations.vertexPosition,
                           2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo[i].attribLocations.vertexPosition);
  }
}


function initTexture(gl, minification, wrap) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  if (!wrap) {
    wrap = gl.MIRRORED_REPEAT;
  }
  if (!minification) {
    minification = gl.LINEAR;
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minification);

  return texture;
}

function initImageTextures(gl, images, textureUnitMap, mipmapsFlag) {
  if (!images) {
    return;
  }
  const minification = (mipmapsFlag) ? gl.NEAREST_MIPMAP_LINEAR : null;
  for (let i = 0; i < images.length; i++) {
    if (!images[i]) {
      continue;
    }
    const img = new Image();
    img.src = images[i];
    img.addEventListener('load', function() {
      gl.activeTexture(gl.TEXTURE0+textureUnitMap['tex']+i);
      initTexture(gl, minification);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      if (mipmapsFlag)
        gl.generateMipmap(gl.TEXTURE_2D);
    });
  }
}

function initBufferInfo(bufferList) {
  const bufferMap = new Map();
  const bufferMapKeys = [];
  for (let i = 0; i < bufferList.length; i++) {
    if (bufferList[i] !== null) {
      bufferMap.set(bufferList[i], i);
      bufferMapKeys.push(bufferList[i]);
    }
  }
  const numBuffers = bufferMapKeys.length;
  return {
    bufferList: bufferList,
    bufferMap: bufferMap,
    bufferMapKeys: bufferMapKeys,
    numBuffers: numBuffers
  };
}

function initFramebuffers(gl, programInfo, numBuffers) {

  const fboData = {
    textures: [],
    framebuffers: []
  };

  for (let i = 0; i < numBuffers; i++) {

    const texture = initTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                  gl.canvas.width, gl.canvas.height, 0,
                  gl.RGBA, gl.UNSIGNED_BYTE, null);
    fboData.textures.push(texture);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    fboData.framebuffers.push(fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, 
                            gl.TEXTURE_2D, texture, 0);
  }

  return fboData;
}


// Copy the video/image texture
function updateTexture(gl, texture, media, mipmapsFlag) {
  const level = 0;
  const internalFormat = gl.RGBA;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  if (media.nodeName == 'VIDEO' && media.readyState < 3) {
    return true;
  }
  try {
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  srcFormat, srcType, media);
    if (mipmapsFlag)
      gl.generateMipmap(gl.TEXTURE_2D);
  }
  catch (err) {
    console.log(err);
    return false;
  }
  return true;
}

function updateAudio(gl, freqTexture, timeTexture, audio, textureUnitMap, uniforms) {
  if (state.audioSource == 'video' || state.audioSource == 'mic') {
    audio.analyser.getByteFrequencyData(audio.frequencyData);
    audio.analyser.getByteTimeDomainData(audio.timeDomainData);
    audio.instantAnalyser.getByteFrequencyData(audio.instantFrequencyData);

    uniforms.bass = audio.sumSubBand(0, 300);
    uniforms.mid = audio.sumSubBand(300, 4000);
    uniforms.treb = audio.sumSubBand(4000, audio.nyquist);
    uniforms.energy = audio.sumSubBand(0, audio.nyquist);
    audio.pushAllEnergy(uniforms.bass, uniforms.mid, uniforms.treb, uniforms.energy);
    uniforms.avgBass = audio.averageEnergyHistory(audio.lowHistory);
    uniforms.avgMid = audio.averageEnergyHistory(audio.midHistory);
    uniforms.avgTreb = audio.averageEnergyHistory(audio.highHistory);
    uniforms.avgEnergy = audio.averageEnergyHistory(audio.totalHistory);
  }
  else {
    audio.frequencyData.fill(0);
    audio.timeDomainData.fill(0);
    audio.instantFrequencyData.fill(0);
  }

  gl.activeTexture(gl.TEXTURE0+textureUnitMap['freqData']);
  gl.bindTexture(gl.TEXTURE_2D, freqTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, audio.frequencyData.length, 1, 0,
                gl.LUMINANCE, gl.UNSIGNED_BYTE, audio.frequencyData);
  
  gl.activeTexture(gl.TEXTURE0+textureUnitMap['timeData']);
  gl.bindTexture(gl.TEXTURE_2D, timeTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, audio.timeDomainData.length, 1, 0,
                gl.LUMINANCE, gl.UNSIGNED_BYTE, audio.timeDomainData);
}

function clearScene(gl) {
  // Clear to black, fully opaque
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

function drawScene(gl, programInfo, uniforms, pingPongData, bufferData, bufferInfo, textureUnitMap) {

  const bufferList = bufferInfo.bufferList;
  const bufferMap = bufferInfo.bufferMap;
  const bufferMapKeys = bufferInfo.bufferMapKeys;
  const numBuffers = bufferInfo.numBuffers;
  const numImages = textureUnitMap['buf'] - textureUnitMap['tex'];
  const offset1 = (uniforms.drawCount%2) * numBuffers;
  const offset2 = ((uniforms.drawCount+1)%2) * numBuffers;
  const offsets = new Array(numBuffers);
  offsets.fill(offset2);
  let bufferCount = 0;
  let pingPongCount = 0;

  function setUniforms(i) {
    gl.uniform1i(programInfo[i].uniformLocations.frame, textureUnitMap['frame']);
    gl.uniform1i(programInfo[i].uniformLocations.curFrame, textureUnitMap['curFrame']);
    gl.uniform1i(programInfo[i].uniformLocations.prevFrame, 
                 (uniforms.drawCount > 0) ? textureUnitMap['prevFrame'] : textureUnitMap['frame']);
    gl.uniform1i(programInfo[i].uniformLocations.thisBuf, 
                 (uniforms.drawCount > 0 && programInfo[i].buffer !== null)
                  ? textureUnitMap['buf']+bufferMapKeys.indexOf(programInfo[i].buffer)+offset2
                  : textureUnitMap['frame']);
    gl.uniform2f(programInfo[i].uniformLocations.resolution, 
                 gl.canvas.width, gl.canvas.height);
    gl.uniform2f(programInfo[i].uniformLocations.mouse, 
                 uniforms.mouse.x, uniforms.mouse.y);
    gl.uniform1i(programInfo[i].uniformLocations.freqData, textureUnitMap['freqData']);
    gl.uniform1i(programInfo[i].uniformLocations.timeData, textureUnitMap['timeData']);
    gl.uniform1f(programInfo[i].uniformLocations.bass, uniforms.bass);
    gl.uniform1f(programInfo[i].uniformLocations.avgBass, uniforms.avgBass);
    gl.uniform1f(programInfo[i].uniformLocations.mid, uniforms.mid);
    gl.uniform1f(programInfo[i].uniformLocations.avgMid, uniforms.avgMid);
    gl.uniform1f(programInfo[i].uniformLocations.treb, uniforms.treb);
    gl.uniform1f(programInfo[i].uniformLocations.avgTreb, uniforms.avgTreb);
    gl.uniform1f(programInfo[i].uniformLocations.energy, uniforms.energy);
    gl.uniform1f(programInfo[i].uniformLocations.avgEnergy, uniforms.avgEnergy);
    gl.uniform1f(programInfo[i].uniformLocations.time, uniforms.time);
    gl.uniform1f(programInfo[i].uniformLocations.timeDelta, uniforms.timeDelta);
    gl.uniform1i(programInfo[i].uniformLocations.drawCount, uniforms.drawCount);
    for (let j = 0; j < numImages; j++) {
      gl.uniform1i(programInfo[i].uniformLocations[`tex${j+1}`], textureUnitMap['tex']+j);
    }
    for (let j = 0; j < numBuffers; j++) {
      //const bufStr = `buf${bufferMap[bufferMapKeys[j]]+1}`;
      const bufStr = `buf${bufferMapKeys[j]+1}`;
      const textureUnit = (uniforms.drawCount > 0) ? (textureUnitMap['buf']+j+offsets[j]) : textureUnitMap['frame'];
      gl.uniform1i(programInfo[i].uniformLocations[bufStr], textureUnit);
    }
  }

  function bindAndDraw(i, fbo) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    setUniforms(i);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }


  for (let i = 0; i < programInfo.length; i++) {

    gl.useProgram(programInfo[i].program);

    if (i != programInfo.length-1) {
      if (programInfo[i].buffer !== null) {
        bindAndDraw(i, bufferData.framebuffers[bufferCount+offset2]);
        gl.activeTexture(gl.TEXTURE0+textureUnitMap['buf']+bufferCount+offset1);
        gl.bindTexture(gl.TEXTURE_2D, bufferData.textures[bufferCount+offset2]);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, bufferData.textures[bufferCount+offset2]);
        offsets[bufferCount] = offset1;
        bufferCount++;
      }
      else {
        bindAndDraw(i, pingPongData.framebuffers[pingPongCount%2]);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, pingPongData.textures[pingPongCount%2]);
        pingPongCount++;
      }
    }
  }
  let i = programInfo.length-1;
  bindAndDraw(i, null);
  if (programInfo[i].buffer !== null) {
    //gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, gl.canvas.width, gl.canvas.height, 0);
    bindAndDraw(i, bufferData.framebuffers[bufferCount+offset2]);
    gl.activeTexture(gl.TEXTURE0+textureUnitMap['buf']+bufferCount+offset1);
    gl.bindTexture(gl.TEXTURE_2D, bufferData.textures[bufferCount+offset2]);
  }
  gl.activeTexture(gl.TEXTURE0);
}

function initPrograms(gl, numImages, bufferInfo) {

  if (fragShaders.length == 0) {
    return null;
  }

  let parser = new Parser();
  // Vertex shader program
  const vsSource = parser.getSource(fragShaders[0]);

  const programInfo = [];
  for (let i = 0; i < fragShaders.length; i++) {
    let shaderProgram = initShaderProgram(gl, vsSource, fragShaders[i]);
    if (shaderProgram == null) {
      return null;
    }
    programInfo.push({
      program: shaderProgram,
      attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition')
      },
      uniformLocations: {
        frame: gl.getUniformLocation(shaderProgram, 'frame'),
        curFrame: gl.getUniformLocation(shaderProgram, 'curFrame'),
        prevFrame: gl.getUniformLocation(shaderProgram, 'prevFrame'),
        thisBuf: gl.getUniformLocation(shaderProgram, 'thisBuf'),
        resolution: gl.getUniformLocation(shaderProgram, 'resolution'),
        mouse: gl.getUniformLocation(shaderProgram, 'mouse'),
        freqData: gl.getUniformLocation(shaderProgram, 'freqData'),
        timeData: gl.getUniformLocation(shaderProgram, 'timeData'),
        bass: gl.getUniformLocation(shaderProgram, 'bass'),
        avgBass: gl.getUniformLocation(shaderProgram, 'avgBass'),
        mid: gl.getUniformLocation(shaderProgram, 'mid'),
        avgMid: gl.getUniformLocation(shaderProgram, 'avgMid'),
        treb: gl.getUniformLocation(shaderProgram, 'treb'),
        avgTreb: gl.getUniformLocation(shaderProgram, 'avgTreb'),
        energy: gl.getUniformLocation(shaderProgram, 'energy'),
        avgEnergy: gl.getUniformLocation(shaderProgram, 'avgEnergy'),
        time: gl.getUniformLocation(shaderProgram, 'time'),
        timeDelta: gl.getUniformLocation(shaderProgram, 'timeDelta'),
        drawCount: gl.getUniformLocation(shaderProgram, 'drawCount')
      },
      buffer: bufferInfo.bufferList[i]
    });
    for (let j = 0; j < numImages; j++) {
      programInfo[i].uniformLocations[`tex${j+1}`] = gl.getUniformLocation(shaderProgram, `tex${j+1}`);
    }
    for (let j = 0; j < bufferInfo.numBuffers; j++) {
      const bufStr = `buf${bufferInfo.bufferMapKeys[j]+1}`;
      programInfo[i].uniformLocations[bufStr] = gl.getUniformLocation(shaderProgram, bufStr);
    }
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
    alert("ShaderVision: Unable to initialize the shader program: " + gl.getProgramInfoLog(shaderProgram));
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
    alert("ShaderVision: An error occurred compiling the shader: " + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}






/* Canvas injection & formatting */

function setDimensions(elements) {
  if (state.mediaType == 'video') {
    var mediaWidth = elements.media.videoWidth;
    var mediaHeight = elements.media.videoHeight;
  }
  else if (state.mediaType == 'image') {
    var mediaWidth = elements.media.width;
    var mediaHeight = elements.media.height;
  }
  //console.log(`width: ${mediaWidth}`);
  //console.log(`height: ${mediaHeight}`);

  if (elements.canvas.width != mediaWidth || elements.canvas.height != mediaHeight) {
    flags.resetFBO = true;
  }
  
  elements.canvas.width = mediaWidth;
  elements.canvas.height = mediaHeight;

  elements.canvas.style.width = elements.media.clientWidth + "px";
  elements.canvas.style.height = elements.media.clientHeight + "px";
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

function removeCanvas(elements) {
  if (elements.canvas) {
    elements.canvas.parentNode.removeChild(elements.canvas);
  }
}

function showMedia(elements) {
  if (elements.media) {
    elements.media.style.visibility = '';
  }
}

function hideMedia(elements) {
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
      elements.canvas.style.position = 'absolute';
      elements.video.style.position = 'static';
      elements.video.parentNode.style.display = 'flex';
      elements.video.parentNode.style.alignItems = 'center';
      elements.video.parentNode.style.justifyContent = 'center';
      elements.video.parentNode.style.height = '100vh';
      elements.video.parentNode.style.margin = '0';
    }
  }
  else {
    elements.canvas.style.position = 'absolute';
  }
}

function initCanvas(elements) {
  if (elements.canvas !== null) {
    elements.canvas.parentNode.removeChild(elements.canvas);
  }
  elements.canvas = document.createElement('canvas');
  elements.canvas.id = 'shadervision-canvas';
  elements.canvas.style.margin = '0px auto';
  elements.canvas.style.display = 'block';
  elements.canvas.style.visibility = 'hidden';
  elements.canvas.style.objectFit = 'contain';
  if (elements.media.parentNode.tagName.toLowerCase() == 'body')
    reStyle(elements);
  elements.media.insertAdjacentElement('beforebegin', elements.canvas);
}



function initResizeObserver(resizeObserver, elements) {

  if (resizeObserver) {
    resizeObserver.disconnect();
  }

  let handleResize = function(entry) {
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
      attributeObserver.disconnect();
      hideMedia(elements);
      attributeObserver.observe(elements.video, {attributes: true});
    }
    // video source change, so ensure correct dimensions
    if (mutation.type == 'attributes' && mutation.attributeName == 'src') {
      if (elements.video.readyState == 0) {
        attributeObserver.disconnect();
        elements.video.addEventListener('loadedmetadata', (e) => {
          setDimensions(elements);
          e.target.removeEventListener(e.type, arguments.callee);
        });
        attributeObserver.observe(elements.video, {attributes: true});
      }
      else {
        setDimensions(elements);
      }
    }
  }

  attributeObserver = new MutationObserver(function(mutationsList) {
    if (fragShaders) {
      mutationsList.forEach(handleMutation);
    }
  });
  attributeObserver.observe(elements.video, {attributes: true});

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



function Parser() {
// Public:
  this.getSource = (shader) => {
    if (getVersion(shader) == "#version 300 es") {
      return `#version 300 es
        in vec4 aVertexPosition;
        void main(void) {
          gl_Position = aVertexPosition;
        }
      `;
    }
    else {
      return `
        attribute vec4 aVertexPosition;
        void main(void) {
          gl_Position = aVertexPosition;
        }
      `;
    }
  }

// Private:
  let getVersion = (shader) => {
    return shader.split(/\r?\n/)[0];
  }; 
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
    this.stream = canvas.captureStream(60); // max fps
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
    canvas.toBlob(function(png) {
      chrome.runtime.sendMessage({tabUrl: URL.createObjectURL(png)});
    });
  };

// Private:
  let mediaRecorder;

  let recIcon = document.createElement('img');
  recIcon.id = 'shadervision-rec';
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
      const recSource = URL.createObjectURL(buf);
      chrome.runtime.sendMessage({tabUrl: recSource});
    }

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedBlobs.push(event.data);
      }
    }

    const timeslice = 3000; // ms
    mediaRecorder.start(timeslice);

    console.log("ShaderVision: Started recording");
    canvas.insertAdjacentElement('afterend', recIcon);
  };

  let stopRecording = () => {
    mediaRecorder.stop();
    console.log("ShaderVision: Stopped recording");
    canvas.parentElement.removeChild(recIcon);
  };
}





function AudioProcessor() {
// Public:
  this.context = new AudioContext();
  this.nyquist = this.context.sampleRate / 2;
  this.analyser = this.context.createAnalyser();
  this.instantAnalyser = this.context.createAnalyser();
  /*
  this.filter = this.context.createBiquadFilter();
  this.filter.type = 'allpass';
  //this.filter.frequency.value = 1000; //10 hz to Nyquist, default 350 hz
  //this.filter.gain.value = 40; //-40 dB to 40 dB, default 0 dB
  //this.filter.Q.value = 500; //0.0001 to 1000, default 1
  */
  this.streamSource = null;
  this.elementSource = null;

  this.setBuffers = (fftSize, smoothingFactor) => {
    this.analyser.fftSize = fftSize;
    this.analyser.smoothingTimeConstant = smoothingFactor;
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeDomainData = new Uint8Array(this.analyser.fftSize);

    this.instantAnalyser.fftSize = fftSize;
    this.instantAnalyser.smoothingTimeConstant = 0;
    this.instantFrequencyData = new Uint8Array(this.instantAnalyser.frequencyBinCount);

    this.lowHistory = [], this.midHistory = [], this.highHistory = [], this.totalHistory = [];
    this.historyLen = Math.ceil(this.context.sampleRate / this.instantAnalyser.fftSize);
  }

  this.connectSource = (mediaSource) => {
    this.analyser.disconnect();
    if (this.source) {
      this.source.disconnect();
    }
    this.source = mediaSource;
    //this.source.connect(this.filter);

    if (mediaSource.mediaStream) {
      if (this.elementSource) {
        this.elementSource.connect(this.context.destination);
      }
      this.source.connect(this.analyser);
      this.source.connect(this.instantAnalyser);
      this.stream = this.source.mediaStream;
    }
    else if (mediaSource.mediaElement) {
      this.source.connect(this.analyser);
      this.source.connect(this.instantAnalyser);
      //this.filter.connect(this.analyser);
      this.analyser.connect(this.context.destination);
      let dest = this.context.createMediaStreamDestination();
      this.source.connect(dest);
      this.stream = dest.stream;
    }
  };

  this.pushAllEnergy = (low, mid, high, total) => {
    function pushEnergy(history, energy) {
      if (history.length == this.historyLen) {
        history.shift();
      }
      history.push(energy);
    }
    pushEnergy(this.lowHistory, low);
    pushEnergy(this.midHistory, mid);
    pushEnergy(this.highHistory, high);
    pushEnergy(this.totalHistory, total);
  };

  this.averageEnergyHistory = (history) => {
    return history.reduce(function(acc, val) {
      return acc + val;
    }, 0) / history.length;
  };

  this.sumSubBand = (minFreq, maxFreq) => {
    if (minFreq > maxFreq) {
      let temp = minFreq;
      minFreq = maxFreq;
      maxFreq = temp;
    }

    let acc = 0; //, count = 0;
    for (let i = getFreqIndex(minFreq); i <= getFreqIndex(maxFreq); i++) {
      let mag = reverseDBConversion(this.frequencyData[i]);
      acc += mag*mag;
      //count += 1;
    }
    return acc; /// count;
  };

//Private:
  let getFreqIndex = (freq) => {
    return Math.floor(
      (freq / this.nyquist) * (this.frequencyData.length - 1)
    );
  };
  
  let reverseDBConversion = (dB) => {
    let range = this.analyser.maxDecibels - this.analyser.minDecibels;
    return Math.pow(10, (dB/255*range + this.analyser.minDecibels) / 20);
  };
}


function initMediaStream(elements, audio, recorder) {

  if (state.audioSource == 'mic') {
    const constraints = {
      channelCount : {ideal: 2},
      autoGainControl: false,
      echoCancellation: false,
      noiseSuppression: false
    };

    //console.log(navigator.mediaDevices.getSupportedConstraints());
    navigator.mediaDevices.getUserMedia({audio: constraints}).then((stream) => {
      try {
        audio.streamSource = audio.context.createMediaStreamSource(stream);
      } catch {}
      audio.connectSource(audio.streamSource);
      recorder.setStream(audio.stream);
    });
  }
  else if (state.audioSource == 'video' && state.mediaType == 'video') {
    try {
      audio.elementSource = audio.context.createMediaElementSource(elements.video);
    } catch {}
    audio.connectSource(audio.elementSource);
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


function initMouseListener(elements, mouseCoords) {

  function setMouseCoords(elements, mouseCoords, clientX, clientY) {
    let rect = elements.canvas.getBoundingClientRect();
    mouseCoords.x = (clientX - rect.left) / elements.canvas.clientWidth;
    mouseCoords.y = (elements.canvas.clientHeight - (clientY - rect.top)) / elements.canvas.clientHeight;
  }

  elements.media.addEventListener('mousemove', function(e) {
    setMouseCoords(elements, mouseCoords, e.clientX, e.clientY);
  });

  elements.canvas.addEventListener('mousemove', function(e) {
    setMouseCoords(elements, mouseCoords, e.clientX, e.clientY);
  });
}