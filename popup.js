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

function createShaderList(id) {
  const shaderList = [];
  const shaderElements = document.getElementById(id);
  for (let i = 0; i < shaderElements.children.length; i++) {
    shaderList.push(shaderElements.children[i].innerText.slice(0, -1));
  }
  return shaderList;
}



function SelectionHandler() {

  function SelectedControls(handler) {

    this.run = () => {
      if (searchBar != document.activeElement && !settingsOpen() 
          && prevSelected.selection && prevSelected.selection.isConnected) {

        chrome.runtime.getBackgroundPage(function(bg) {
          bg.applyShaders([prevSelected.selection.firstChild.innerText]);
        });
      }
    };

    this.add = () => {
      if (searchBar != document.activeElement && !settingsOpen() 
          && prevSelected.selection && prevSelected.selection.isConnected) {
        
        if (prevSelected.status == 'active') {
          cloneAction(prevSelected.selection);
        }
        else {
          addAction(prevSelected.selection);
        }
      }
    };

    this.remove = () => {
      if (searchBar != document.activeElement && !settingsOpen() 
          && prevSelected.selection && prevSelected.selection.isConnected) {

        if (prevSelected.selection.previousSibling) {
          var sibling = prevSelected.selection.previousSibling;
        }
        else {
          var sibling = prevSelected.selection.nextSibling;
        }

        if (prevSelected.status == 'active') {
          removeAction(prevSelected.selection);
        }
        else {
          //deleteAction(prevSelected.selection);
        }

        handler.highlight(sibling);
      }
    };

    this.swapUp = () => {
      if (searchBar != document.activeElement && !settingsOpen() 
          && prevSelected.selection && prevSelected.selection.isConnected) {

        const sibling = prevSelected.selection.previousSibling;
        if (prevSelected.status == 'active' && sibling) {
          sibling.parentNode.insertBefore(prevSelected.selection, sibling);
          prevSelected.selection.scrollIntoView({block: 'nearest'});
        }
      }
    };

    this.swapDown = () => {
      if (searchBar != document.activeElement && !settingsOpen() 
          && prevSelected.selection && prevSelected.selection.isConnected) {

        const sibling = prevSelected.selection.nextSibling;
        if (prevSelected.status == 'active' && sibling) {
          sibling.parentNode.insertBefore(sibling, prevSelected.selection);
          prevSelected.selection.scrollIntoView({block: 'nearest'});
        }
      }
    };
  }

  this.selectedControls = new SelectedControls(this);

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

  function settingsOpen() {
    return document.getElementById("options-page").style.display == 'block';
  }

  this.switch = () => {
    function firstListedShader(shaderList) {
      for (let i = 0; i < shaderList.length; i++) {
        if (shaderList[i].style.display != 'none') {
          return shaderList[i];
        }
      }
      return null;
    }
    if (!settingsOpen()) {
      if (prevSelected.status == 'active') {
        if (!prevSelected.savedSelection || (prevSelected.savedSelection 
            && (!prevSelected.savedSelection.isConnected || prevSelected.savedSelection.style.display == 'none'))) {
          prevSelected.savedSelection = firstListedShader(savedShaders);
        }
        if (prevSelected.savedSelection && prevSelected.savedSelection.isConnected) {
          this.highlight(prevSelected.savedSelection, 'saved');
        }
      }
      else {
        if (!prevSelected.activeSelection || (prevSelected.activeSelection 
            && (!prevSelected.activeSelection.isConnected || prevSelected.activeSelection.style.display == 'none'))) {
          prevSelected.activeSelection = firstListedShader(activeShaders);
        }
        if (prevSelected.activeSelection && prevSelected.activeSelection.isConnected) {
          this.highlight(prevSelected.activeSelection, 'active');
        }
      }
    }
  };

  this.moveUp = (e) => {
    if (searchBar != document.activeElement && !settingsOpen()) {
      e.preventDefault();
      if (prevSelected.selection) {
        var sibling = prevSelected.selection.previousSibling;
      }
      while (sibling && sibling.style.display == 'none') {
        sibling = sibling.previousSibling;
      }
      if (sibling) {
        sibling.scrollIntoView({block: 'nearest'});
        this.highlight(sibling);
      }
    }
  };

  this.moveDown = (e) => {
    if (searchBar != document.activeElement && !settingsOpen()) {
      e.preventDefault();
      if (prevSelected.selection) {
        var sibling = prevSelected.selection.nextSibling;
      }
      else {
        this.switch();
        return;
      }
      while (sibling && sibling.style.display == 'none') {
        sibling = sibling.nextSibling;
      }
      if (sibling) {
        sibling.scrollIntoView({block: 'nearest'});
        this.highlight(sibling);
      }
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
      selectionHandler.selectedControls.run();
      break;
  }
});


function addShader(shaders, sibling, name, inFileSystem, appendButtons) {

  const newShader = document.createElement("div");
  const textWrapper = document.createElement("span");
  textWrapper.classList.add("name");
  textWrapper.appendChild(document.createTextNode(name));
  newShader.appendChild(textWrapper);
  appendButtons(newShader, inFileSystem);

  newShader.classList.add("shader");
  if (shaders.id == "active-shaders") {
    remEmptyMessage(shaders);
    newShader.classList.add("ui-sortable-handle");
  }

  newShader.addEventListener('mousedown', function() {
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

    Object.keys(result.savedShaders).forEach(function(name) {
      if (result.settings.hideReadOnly && result.savedShaders[name].inFileSystem) {
        // pass since the file is in the filesystem and the hide read-only checkbox is on
      }
      else {
        addShader(shaderElements, null, name,
                  result.savedShaders[name].inFileSystem, 
                  appendSavedButtons);
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




function appendButton(iconType, div, tooltip, onClick) {
  const button = document.createElement("span");
  button.classList.add("ui-icon");
  button.classList.add("ui-icon-" + iconType);
  button.classList.add("shader-icon");
  button.title = tooltip;
  button.addEventListener('click', function() {
    onClick(div);
  });
  button.addEventListener('click', function() {
    buttonAnimation(button);
  });
  div.appendChild(button);
}

function deleteAction(div) {
  removeShader(div.firstChild.innerText);
}

function addAction(div) {
  let newItem = addShader(document.getElementById("active-shaders"),
                          null, 
                          div.firstChild.innerText,
                          null,
                          appendActiveButtons);
  chrome.storage.local.set({activeShaders: createShaderList("active-shaders")});
  updateAnimation(newItem);
  newItem.scrollIntoView(false);
}

function appendSavedButtons(div, inFileSystem) {
  if (!inFileSystem) {
    appendButton("trash", div, "Delete", deleteAction);
  }

  appendButton("script", div, "Edit", function() {
    chrome.runtime.getBackgroundPage(function(bg) {
      bg.textEdit(div.firstChild.innerText);
    });
  });

  appendButton("circlesmall-plus", div, "Add", addAction);
}

function cloneAction(div) {
  let clonedItem = addShader(document.getElementById("active-shaders"), 
                             div,
                             div.firstChild.innerText,
                             null,
                             appendActiveButtons);
  chrome.storage.local.set({activeShaders: createShaderList("active-shaders")});
  updateAnimation(clonedItem);
}

function removeAction(div) {
  if (div.parentElement.children.length <= 1) {
    addEmptyMessage(div.parentElement);
  }
  div.parentElement.removeChild(div);
  chrome.storage.local.set({activeShaders: createShaderList("active-shaders")});
}

function appendActiveButtons(div) {
  appendButton("copy", div, "Clone", cloneAction);
  appendButton("circlesmall-minus", div, "Remove", removeAction);
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
    const shaderElement = document.getElementById("active-shaders");
    if (result.activeShaders.length == 0) {
      addEmptyMessage(shaderElement);
    }
    else {
      while (shaderElement.firstChild) {
        shaderElement.removeChild(shaderElement.firstChild);
      }
      result.activeShaders.forEach(function(name) {
        addShader(shaderElement, null, name, null, appendActiveButtons);
      });
    }
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
        selectionHandler.highlight(ui.item.context, "active-shaders");
      });
    }
    chrome.storage.local.set({activeShaders: createShaderList("active-shaders")});
    updateAnimation(ui.item.context);
  }
});

$("#table-container").disableSelection();


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


