const numBuffers = 3;
//document.getElementById("icon").addEventListener('click', function() {
//});


document.getElementById("exec").addEventListener('click', function() {
  animateElement(document.getElementById("icon"), 1600, (t) => {
    return `rotate-invert ${t}ms linear`;
  });

  chrome.runtime.getBackgroundPage(function(bg) {
    bg.applyShaders();
  });
});

document.getElementById("menu-new-shader").addEventListener('click', function() {
  buttonAnimation(this);
  chrome.runtime.getBackgroundPage(function(bg) {
    bg.textEdit();
  });
});

function createShaderList() {
  const id = "active-shaders";
  const shaderList = [];
  const shaderElements = document.getElementById(id).children;
  for (let i = 0; i < shaderElements.length; i++) {
    const shaderName = shaderElements[i].firstChild.innerText;
    const bufNum = Number(shaderElements[i].children[1].innerText);
    shaderList[i] = {
      name: shaderName,
      bufNum: (bufNum) ? bufNum : null
    }
  }
  return shaderList;
}



function SelectionHandler() {

  const prevSelected = {
    status: 'active',
    selection: null,
    savedSelection: null,
    activeSelection: null
  }

  const searchBar = document.getElementById("search-bar");
  searchBar.addEventListener('focus', () => {
    this.highlight(null);
    prevSelected.status = 'active';
  });
  document.getElementById("exec").addEventListener('focus', (e) => {
    e.currentTarget.blur();
  });
  const savedShaders = document.getElementById("saved-shaders").children;
  const activeShaders = document.getElementById("active-shaders").children;

  function overlayPageOpen() {
    return (document.getElementById("options-page").style.display == 'block' ||
            document.getElementById("textures-page").style.display == 'block');
  }

  function SelectedControls(handler) {

    function validSelection() {
      return (searchBar != document.activeElement && 
              !overlayPageOpen() && 
              prevSelected.selection && 
              prevSelected.selection.isConnected);
    }

    this.find = (character) => {
      if (searchBar == document.activeElement || 
          overlayPageOpen() || 
          prevSelected.status == 'active') {
        return;
      }

      for (let i = 0; i < savedShaders.length; i++) {
        if (savedShaders[i].style.display != 'none') {
          const firstLetter = savedShaders[i].firstChild.innerText[0].toLowerCase();
          if (firstLetter >= character) {
            savedShaders[i].scrollIntoView({block: 'nearest'});
            handler.highlight(savedShaders[i]);
            return;
          }
        }
      }
    };

    this.run = () => {
      if (!validSelection()) {
        return;
      }
      chrome.runtime.getBackgroundPage(function(bg) {
        const shaderName = prevSelected.selection.firstChild.innerText;
        const bufNum = Number(prevSelected.selection.children[1].innerText);
        bg.applyShaders([{
          name: shaderName,
          bufNum: (bufNum) ? bufNum : null
        }]);
      });
    };

    this.add = () => {
      if (!validSelection()) {
        return;
      }

      if (prevSelected.status == 'active') {
        cloneAction(prevSelected.selection);
      }
      else {
        addAction(prevSelected.selection);
      }
    };

    this.remove = () => {
      if (!validSelection() || prevSelected.status != 'active') {
        return;
      }

      const next = prevSelected.selection.nextSibling;
      const prev = prevSelected.selection.previousSibling;
      const sibling = (next) ? next : prev;

      removeAction(prevSelected.selection);
      /*
      if (prevSelected.status == 'active') {
        removeAction(prevSelected.selection);
      }
      else {
        deleteAction(prevSelected.selection);
      }
      */

      handler.highlight(sibling);
    };

    this.swapUp = () => {
      if (!validSelection()) {
        return;
      }
      const sibling = prevSelected.selection.previousSibling;
      if (prevSelected.status == 'active' && sibling) {
        sibling.parentNode.insertBefore(prevSelected.selection, sibling);
        prevSelected.selection.scrollIntoView({block: 'nearest'});
        chrome.storage.local.set({activeShaders: createShaderList()});
      }
    };

    this.swapDown = () => {
      if (!validSelection()) {
        return;
      }
      const sibling = prevSelected.selection.nextSibling;
      if (prevSelected.status == 'active' && sibling) {
        sibling.parentNode.insertBefore(sibling, prevSelected.selection);
        prevSelected.selection.scrollIntoView({block: 'nearest'});
        chrome.storage.local.set({activeShaders: createShaderList()});
      }
    };

    this.incrementBufNum = () => {
      if (!validSelection()) {
        return;
      }
      incrementAction(prevSelected.selection);
    }
    this.decrementBufNum = () => {
      if (!validSelection()) {
        return;
      }
      decrementAction(prevSelected.selection);
    }
  }

  this.selectedControls = new SelectedControls(this);


  this.switch = () => {
    function firstListedShader(shaderList) {
      for (let i = 0; i < shaderList.length; i++) {
        if (shaderList[i].style.display != 'none') {
          return shaderList[i];
        }
      }
      return null;
    }

    if (overlayPageOpen()) {
      return;
    }

    if (prevSelected.status == 'active') {
      if (!prevSelected.savedSelection || (prevSelected.savedSelection 
          && (!prevSelected.savedSelection.isConnected || prevSelected.savedSelection.style.display == 'none'))) {
        prevSelected.savedSelection = firstListedShader(savedShaders);
      }
      if (prevSelected.savedSelection && prevSelected.savedSelection.isConnected) {
        prevSelected.savedSelection.scrollIntoView({block: 'nearest'});
        this.highlight(prevSelected.savedSelection, 'saved');
      }
    }
    else {
      if (!prevSelected.activeSelection || (prevSelected.activeSelection 
          && (!prevSelected.activeSelection.isConnected || prevSelected.activeSelection.style.display == 'none'))) {
        prevSelected.activeSelection = firstListedShader(activeShaders);
      }
      if (prevSelected.activeSelection && prevSelected.activeSelection.isConnected) {
        prevSelected.activeSelection.scrollIntoView({block: 'nearest'});
        this.highlight(prevSelected.activeSelection, 'active');
      }
    }
  };

  this.moveUp = (e) => {
    if (searchBar == document.activeElement || overlayPageOpen()) {
      return;
    }

    e.preventDefault();
    if (prevSelected.selection) {
      var sibling = prevSelected.selection.previousSibling;
    }
    else {
      this.switch();
      return;
    }
    while (sibling && sibling.style.display == 'none') {
      sibling = sibling.previousSibling;
    }
    if (sibling) {
      sibling.scrollIntoView({block: 'nearest'});
      this.highlight(sibling);
    }
  };

  this.moveDown = (e) => {
    if (searchBar == document.activeElement || overlayPageOpen()) {
      return;
    }

    e.preventDefault();
    if (prevSelected.selection) {
      var sibling = prevSelected.selection.nextSibling;
    }
    else {
      prevSelected.status = 'saved';
      this.switch();
      prevSelected.status = 'active';
      return;
    }
    while (sibling && sibling.style.display == 'none') {
      sibling = sibling.nextSibling;
    }
    if (sibling) {
      sibling.scrollIntoView({block: 'nearest'});
      this.highlight(sibling);
    }
  };

  this.highlight = (shader, type) => {
    if (!type) {
      type = prevSelected.status;
    }

    if (prevSelected.selection) {
      prevSelected.selection.classList.remove("selected");
    }

    if (shader) {
      shader.classList.add("selected");
      prevSelected.selection = shader;
      if (type == 'active') {
        prevSelected.status = 'active';
        prevSelected.activeSelection = shader;
      }
      else {
        prevSelected.status = 'saved';
        prevSelected.savedSelection = shader;
      }
    }
    else {
      prevSelected.selection = null;
    }
  };

}

let selectionHandler = new SelectionHandler();

document.addEventListener('keydown', (e) => {

  if (e.key >= 'a' && e.key <= 'z' && !e.ctrlKey && !e.altKey) {
    selectionHandler.selectedControls.find(e.key);
  }

  switch (e.key) {
    case 'Tab':
      selectionHandler.switch();
      break;

    case 'f':
      if (e.ctrlKey) {
        if (document.getElementById("options-page").style.display != 'block') {
          document.getElementById("search-bar").focus();
        }
      }
      break;

    case 'ArrowUp':
      if (e.ctrlKey && e.shiftKey) {
        selectionHandler.selectedControls.swapUp();
      }
      else {
        selectionHandler.moveUp(e);
      }
      break;

    case 'ArrowDown':
      if (e.ctrlKey && e.shiftKey) {
        selectionHandler.selectedControls.swapDown();
      }
      else {
        selectionHandler.moveDown(e);
      }
      break;

    case 'ArrowRight':
      selectionHandler.selectedControls.incrementBufNum();
      break;

    case 'ArrowLeft':
      selectionHandler.selectedControls.decrementBufNum();
      break;

    case 'Enter':
      selectionHandler.selectedControls.add();
      break;

    case 'Backspace':
      selectionHandler.selectedControls.remove();
      break;

    case 'Delete':
      selectionHandler.selectedControls.remove();
      break;

    case ' ':
      e.preventDefault();
      selectionHandler.selectedControls.run();
      break;
  }
});


function addShader(shaders, sibling, name, inFileSystem, bufNum, appendButtons) {

  const newShader = document.createElement("div");
  const textWrapper = document.createElement("span");
  textWrapper.classList.add("name");
  textWrapper.appendChild(document.createTextNode(name));
  newShader.appendChild(textWrapper);
  if (inFileSystem)
    appendButtons(newShader, inFileSystem);
  else
    appendButtons(newShader, bufNum);

  newShader.classList.add("shader");
  if (shaders.id == "active-shaders") {
    remEmptyMessage(shaders);
    newShader.classList.add("ui-sortable-handle");
  }

  newShader.addEventListener('mousedown', function(e) {
    if (e.button !== 0) { // left click only
      return;
    }
    selectionHandler.highlight(newShader, shaders.id.split("-")[0]);
  });

  if (sibling) {
    sibling.insertAdjacentElement('afterend', newShader);
  }
  else {
    shaders.appendChild(newShader);
  }

  return newShader;
}

function removeShader(name) {
  chrome.storage.local.get(['savedShaders'], function(result) {
    delete result.savedShaders[name];
    chrome.storage.local.set(result, function() {
      chrome.storage.local.remove(name, function() {
        refreshShaderList();
      }); 
    });
  });
}

function refreshShaderList() {
  chrome.storage.local.get(['savedShaders', 'settings'], function(result) {

    const shaderElements = document.getElementById("saved-shaders");
    while (shaderElements.firstChild) {
      shaderElements.removeChild(shaderElements.firstChild);
    }

    const keys = Object.keys(result.savedShaders).sort(function(a, b) {
      // case insensitive sort
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });

    keys.forEach(function(name) {
      if (result.settings.hideReadOnly && result.savedShaders[name].inFileSystem) {
        // pass since the file is in the filesystem and the hide read-only checkbox is on
      }
      else {
        addShader(shaderElements, null, name,
                  result.savedShaders[name].inFileSystem,
                  null, appendSavedButtons);
      }
    });

    makeDraggable();
  });
}



function animateElement(element, time, animation) {
  element.style.animation = animation(time);
  setTimeout(function() {
    element.style.animation = '';
  }, time);
}

/*
document.getElementById("refresh").onclick = function() {
  animateElement(this, 800, (t) => {return `rotate-shadow ${t}ms ease-out`});
  refreshShaderList();
}
*/

$("#search-bar").focus(function() {
  $("#search-wrapper").css("box-shadow", 
                           "0px 0px 4px 2px hsla(155, 90%, 55%, 80%)");
});

$("#search-bar").focusout(function() {
  $("#search-wrapper").css("box-shadow", "");
});

$("#search-bar").on("input", function() {
  let inputString = $(this).val();
  $(".ui-draggable-handle").hide().filter(function() {    
    let regex = new RegExp(inputString, "i");
    return regex.test($(this).text());
  }).show();
});




function appendButton(iconType, div, tooltip, animate, onClick, bufNum) {
  const button = document.createElement("span");
  if (!iconType) {
    button.innerText = (bufNum) ? bufNum : '';
    button.classList.add("buffer-icon");
  }
  else {
    button.classList.add("ui-icon");
    button.classList.add("ui-icon-" + iconType);
  }
  button.classList.add("shader-icon");
  button.title = tooltip;
  button.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    if (e.button !== 0) { // left click only
      return;
    }
    onClick(div);
    if (animate) {
      buttonAnimation(button);
    }
  });
  div.appendChild(button);
}

function deleteAction(div) {
  if (confirm("Are you sure you want to permanently delete this program?")) {
    removeShader(div.firstChild.innerText);
  }
}

function addAction(div) {
  let newItem = addShader(document.getElementById("active-shaders"),
                          null, div.firstChild.innerText,
                          null, null, appendActiveButtons);
  chrome.storage.local.set({activeShaders: createShaderList()});
  updateAnimation(newItem);
  newItem.scrollIntoView(false);
}

function appendSavedButtons(div, inFileSystem) {
  if (!inFileSystem) {
    appendButton("trash", div, "Delete", false, deleteAction);
  }

  appendButton("script", div, "Edit", true, function() {
    chrome.runtime.getBackgroundPage(function(bg) {
      bg.textEdit(div.firstChild.innerText);
    });
  });

  appendButton("circlesmall-plus", div, "Add", true, addAction);
}

function cloneAction(div) {
  let clonedItem = addShader(document.getElementById("active-shaders"), 
                             div, div.firstChild.innerText,
                             null, null, appendActiveButtons);
  chrome.storage.local.set({activeShaders: createShaderList()});
  updateAnimation(clonedItem);
}

function removeAction(div) {
  if (div.parentElement.children.length <= 1) {
    addEmptyMessage(div.parentElement);
  }
  div.parentElement.removeChild(div);
  chrome.storage.local.set({activeShaders: createShaderList()});
}

function incrementAction(div) {
  const bufButton = div.children[1];
  const bufNum = Number(bufButton.innerText);
  bufButton.innerText = (bufNum == numBuffers) ? '' : bufNum + 1;
  chrome.storage.local.set({activeShaders: createShaderList()});
}

function decrementAction(div) {
  const bufButton = div.children[1];
  const bufNum = Number(bufButton.innerText);
  if (bufNum == 1)
    bufButton.innerText = '';
  else if (bufNum == 0)
    bufButton.innerText = numBuffers;
  else
    bufButton.innerText = bufNum - 1;
  chrome.storage.local.set({activeShaders: createShaderList()});
}

function appendActiveButtons(div, bufNum) {
  appendButton(null, div, "Buffer", true, incrementAction, bufNum);
  appendButton("copy", div, "Clone", true, cloneAction);
  appendButton("circlesmall-minus", div, "Remove", true, removeAction);
}

function buttonAnimation(item) {
  animateElement(item, 600, (t) => {
    return `shrink ${t}ms ease-out`
  });
}

function updateAnimation(item) {
  animateElement(item, 800, (t) => {
    return `highlight ${t}ms ease-out`
  });
}

(function retrieveActiveShaders() {
  chrome.storage.local.get(['activeShaders'], function(result) {
    if (!result.activeShaders) {
      chrome.storage.local.set({activeShaders: []});
      return;
    }

    const shaderElements = document.getElementById("active-shaders");
    if (result.activeShaders.length == 0) {
      addEmptyMessage(shaderElements);
      return;
    }

    while (shaderElements.firstChild) {
      shaderElements.removeChild(shaderElements.firstChild);
    }
    result.activeShaders.forEach(function(item) {
      addShader(shaderElements, null, item.name, null, item.bufNum, appendActiveButtons);
    });
  });
})();



$("#saved-shaders-wrapper").resizable({
  //zIndex: "auto",
  handles: "s",
  minHeight: 40,
  maxHeight: $("#table-container").height() - 40,
  resize: function() {
    const newHeight = $("#table-container").height() - $("#saved-shaders-wrapper").innerHeight();
    $("#active-shaders-wrapper").outerHeight(newHeight);
  }
});

function makeDraggable() {
  $("#saved-shaders > .shader").draggable({
    addClasses: false,
    scroll: false,
    connectToSortable: "#active-shaders",
    helper: "clone",
    containment: "#table-container",
    start: function(e, ui) {
      $(ui.helper).children(".ui-icon").remove();
      $(ui.helper).removeClass("selected");
    }
  });
}

$("#active-shaders").sortable({
  containment: "#active-shaders-wrapper",
  axis: "y",
  scrollSpeed: 8,
  tolerance: "pointer",
  over: function(e, ui) {
    remEmptyMessage($("#active-shaders")[0]);
    $("#active-shaders").css({"background-color": "hsla(155, 90%, 55%, 35%)"});
  },
  out: function(e, ui) {
    // if dragging
    if (ui.helper && $(ui.item).hasClass("ui-draggable-handle") && $("#active-shaders")[0].children.length <= 2) {
      addEmptyMessage($("#active-shaders")[0]);
    }
    $("#active-shaders").css("background-color", "");
  },
  stop: function(e, ui) {
    $(ui.item).removeAttr("style");
    if ($(ui.item).hasClass("ui-draggable-handle")) {
      $(ui.item).removeClass("ui-draggable-handle");
      $(ui.item).addClass("ui-sortable-handle");
      appendActiveButtons(ui.item.context);
      $(ui.item).mousedown(function() {
        selectionHandler.highlight(ui.item.context, "active");
      });
    }
    chrome.storage.local.set({activeShaders: createShaderList()});
    updateAnimation(ui.item.context);
  }
});

chrome.runtime.getBackgroundPage(function(bg) {
  bg.readRemLoad(refreshShaderList);
});





/* OS drag and drop */

$("html").on("dragover", function(e) {
  e.preventDefault();
  e.originalEvent.dataTransfer.dropEffect = "none";
  $("#saved-shaders").css({"background-color": ""});
});

//$("#saved-shaders").on("dragleave", function(e) { $(this).css({"background-color": ""}); });

$("#saved-shaders").on("dragover", function(e) {
  e.preventDefault();
  e.stopPropagation();
  e.originalEvent.dataTransfer.dropEffect = "copy";
  $(this).css({"background-color": "hsla(155, 90%, 55%, 35%)"});
});


$("#saved-shaders").on("drop", function(e) {
  e.preventDefault();
  $(this).css({"background-color": ""});

  const files = e.originalEvent.dataTransfer.files;

  if (files.length > 0) {
    chrome.storage.local.get(['savedShaders'], function(result) {
      chrome.runtime.getBackgroundPage(function(bg) {
        bg.loadFiles(files, result.savedShaders, true, refreshShaderList);
      });
    });
  }
});


/* Empty message */

const emptyMessage = document.createTextNode("Move your desired shaders here.");

function remEmptyMessage(element) {
  if (element.classList.contains("empty-message")) {
    element.removeChild(emptyMessage);
    element.classList.remove("empty-message");
  }
}

function addEmptyMessage(element) {
  if (!element.classList.contains("empty-message")) {
    element.appendChild(emptyMessage);
    element.classList.add("empty-message");
  }
}


