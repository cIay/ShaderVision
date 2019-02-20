let generation;
const defaultText = 
`#version 300 es
precision mediump float;

uniform vec2 resolution;
uniform sampler2D frame;

out vec4 fragColor;

void main(void) {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  fragColor = texture(frame, uv);
}`;


const mirrorContainer = document.createElement('div');
mirrorContainer.id = 'shadervision-panel';
mirrorContainer.style.display = 'none';
mirrorContainer.tabIndex = 0;

const header = document.createElement('div');
header.id = 'shadervision-header';
mirrorContainer.appendChild(header);

const nameElement = document.createElement('span');
nameElement.id = 'shadervision-filename';
nameElement.contentEditable = true;
nameElement.spellcheck = false;
nameElement.style.cursor = 'default';
nameElement.tabIndex = -1;

function selectElementContents(element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range); 
}

nameElement.addEventListener('focusin', () => {
  nameElement.style.cursor = '';
  selectElementContents(nameElement);
});

nameElement.addEventListener('focusout', () => {
  nameElement.style.cursor = 'default';
});

header.appendChild(nameElement);

const savedStatus = document.createElement('span');
savedStatus.id = 'shadervision-savedstatus';
savedStatus.innerText = "";
savedStatus.style.cursor = 'default';
header.appendChild(savedStatus);

const readOnlyStatus = document.createElement('span');
readOnlyStatus.id = 'shadervision-readonlystatus';
readOnlyStatus.innerText = "";
readOnlyStatus.style.cursor = 'default';
header.appendChild(readOnlyStatus);

const closeIcon = document.createElement('img');
closeIcon.id = 'shadervision-close';
closeIcon.src = chrome.runtime.getURL("images/close16.png");
header.appendChild(closeIcon);


const cm = CodeMirror(mirrorContainer, {
  lineNumbers: true,
  theme: 'dracula',
  mode: 'text/x-glsl',
  smartIndent: false,
  tabindex: -1
});

cm.setOption('extraKeys', {
  "Ctrl-S": function() {
    if (nameElement.innerText == "") {
      return;
    }

    chrome.runtime.sendMessage({
      saveFile: {
        name: nameElement.innerText,
        contents: cm.getValue()
      }
    }, function(response) {
      if (!chrome.runtime.lastError && response.success) {
        saveAnimation(header);
        savedStatus.innerText = "";
        generation = cm.changeGeneration();
      }
    });
  }
});


nameElement.addEventListener('keydown', (e) => {
  if (e.keyCode == 13) { // enter key
    e.preventDefault(); // prevent div creation
    cm.focus();
  }
});




window.addEventListener('beforeunload', function(e) {
  if (!cm.isClean(generation)) {
    if (!confirm()) {
      e.preventDefault(); // prevent page close
      e.returnValue = '';
    }
  }
});

closeIcon.addEventListener('click', () => {

  function quitMirror() {
    mirrorContainer.style.display = 'none';
    cm.clearHistory();
    cm.setValue("");
    generation = cm.changeGeneration();
  }

  if (cm.isClean(generation)) {
    quitMirror();
  }
  else if (confirm(`Are you sure you want to quit? Changes to ${nameElement.innerText} will be lost.`)) {
    quitMirror();
  }
});

mirrorContainer.addEventListener('focusin', () => {
  mirrorContainer.style.filter = 'opacity(100%)';
});

mirrorContainer.addEventListener('focusout', () => {
  mirrorContainer.style.filter = '';
});

document.body.appendChild(mirrorContainer);

$(mirrorContainer).resizable({
  handles: 'n, w, nw',
  minWidth: 200,
  minHeight: 80,
  resize: function() {
    cm.refresh();
  },
  stop: function () {
    if ($(mirrorContainer).height() > $(window).height()) {
      $(mirrorContainer).height($(window).height()-24);
    }
  }
});



chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.target == 'editor') {
    if (request.ping) {
      sendResponse({pong: true});
    }
    else if (request.shaders) {
      let name;
      if (request.shaders.contents.length > 0) {
        name = request.shaders.names[0];
        cm.setValue(request.shaders.contents[0]);
        cm.setOption('readOnly', request.shaders.readOnlyFlags[0]);
        readOnlyStatus.innerText = request.shaders.readOnlyFlags[0] ? "(Read-only)" : "";
      }
      else {
        name = "New Shader";
        cm.setValue(defaultText);
        cm.setOption('readOnly', false);
        readOnlyStatus.innerText = "";
      }
      cm.clearHistory();
      nameElement.innerText = name;
      savedStatus.innerText = "";
      generation = cm.changeGeneration();
      mirrorContainer.style.display = '';
      cm.refresh();


      cm.on('change', function() {
        if (cm.isClean(generation)) {
          savedStatus.innerText = "";
          generation = cm.changeGeneration();
        }
        else {
          savedStatus.innerText = "*"
        }
      });
    }
  }
});

function saveAnimation(element) {
  animateElement(element, 800, (t) => {
    return `highlight ${t}ms ease-out`
  });
}

function animateElement(element, time, animation) {
  element.style.animation = animation(time);
  setTimeout(function() {
    element.style.animation = '';
  }, time);
}