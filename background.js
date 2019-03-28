/*
// Update the declarative rules on install or upgrade.
chrome.runtime.onInstalled.addListener(function() {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [
        // When a page contains a <video> tag...
        new chrome.declarativeContent.PageStateMatcher({
          css: ["video"]
        })
      ],
      // ... show the page action.
      actions: [new chrome.declarativeContent.ShowPageAction() ]
    }]);
  });
});

chrome.runtime.onStartup.addListener(function() {
});
*/
const storageKeys = [
  'settings',
  'textures',
  'activeShaders', 
  'savedShaders'
];

const runScripts = [
  'shadervision.js'
];
const editScripts = [
  'panel.js', 
  'lib/jquery/jquery-ui.min.js',
  'lib/jquery/jquery-1.12.4.min.js',
  'lib/codemirror/mode/clike/glsl.js',
  'lib/codemirror/lib/codemirror.js'
];
const editStyling = [
  'panel.css',
  'lib/jquery/jquery-ui.css',
  'lib/codemirror/theme/dracula.css',
  'lib/codemirror/lib/codemirror.css'
];


chrome.runtime.onInstalled.addListener(function() {
  chrome.contextMenus.create({
    id: "textureId",
    title: "Add texture",
    contexts: ['image']
  });
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
  fetchDataURL(info.srcUrl, function(result) {
    storeTexture(result)
  });
});

function fetchDataURL(url, callback) {
  const xhr = new XMLHttpRequest();
  xhr.addEventListener('error', function(err) {
    alert("Error fetching image: " + url);
  });
  xhr.addEventListener('load', function() {
    const fileReader = new FileReader();
    fileReader.addEventListener('loadend', function(e) {
      callback(fileReader.result);
    });
    fileReader.readAsDataURL(xhr.response);
  });
  xhr.open('GET', url);
  xhr.responseType = 'blob';
  xhr.send();
}

// store the image in the first texture slot, pushing down any existing textures
function storeTexture(dataUrl) {
  chrome.storage.local.get(['textures'], function(result) {
    if (!result.textures) {
      result.textures = [];
    }
    const len = result.textures.length;
    let cur, prev = dataUrl;
    let i = 0;
    do {
      cur = result.textures[i];
      result.textures[i] = prev;
      prev = cur;
      i++;
    } while (cur && i < len);

    function flashInvertedIcon(time) {
      chrome.browserAction.setIcon({path: "images/icon16i.png"});
      setTimeout(function() {
        chrome.browserAction.setIcon({path: "images/icon16.png"});
      }, time);
    }

    chrome.storage.local.set(result, function() {
      flashInvertedIcon(500);
    });
  });
}




chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.tabUrl) {
    chrome.tabs.create({
      url: request.tabUrl,
      active: false,
      index: sender.tab.index+1
    });
  }
  else if (request.saveFile) {
    (async () => {
      storeShader(request.saveFile.name, request.saveFile.contents, sendResponse);
    })();
    return true; // indicates asynchronous response (see runtime.onMessage doc)
  }
  else if (request.requestShaders) {
    applyShaders();
  }
});

function storeShader(name, contents, sendResponse) {
  chrome.storage.local.get(['savedShaders'], function(result) {
    // if file does not yet exist and isn't a storage key, or it does exist and isn't read-only
    if ((!result.savedShaders[name] && storageKeys.indexOf(name) == -1) || 
        (result.savedShaders[name] && !result.savedShaders[name].inFileSystem)) {

      result[name] = {
        text: contents
      };
      result.savedShaders[name] = {
        inFileSystem: false
      };

      chrome.storage.local.set(result, function() {
        if (sendResponse) {
          sendResponse({success: Boolean(!chrome.runtime.lastError)});
          applyShaders();
        }
      });
    }
    else if (sendResponse) {
      sendResponse({success: false});
    }
  });
}


function applyShaders(shaders) {
  chrome.tabs.query({active:true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {target: 'canvas', ping: true}, function(response) {
      if (chrome.runtime.lastError) {
      //console.log(chrome.runtime.lastError);
      }

      function activate(shaders) {
        if (!response) {
          executeChain(runScripts, function() {
            sendShaders(tabs[0].id, 'canvas', shaders);
          });
        }
        else if (response.pong) {
          sendShaders(tabs[0].id, 'canvas', shaders);
        }
      }

      if (!shaders) {
        chrome.storage.local.get(['activeShaders'], function(result) {
          activate(result.activeShaders);
        });
      }
      else {
        activate(shaders);
      }

    });
  });
}

function textEdit(shaderFile) {
  chrome.tabs.query({active:true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {target: 'editor', ping: true}, function(response) {
      if (chrome.runtime.lastError) {
      //console.log(chrome.runtime.lastError);
      }
      if (!response) {
        styleChain(editStyling, function() {
          executeChain(editScripts, function() {
            sendShaders(tabs[0].id, 'editor', shaderFile);
          });
        });
      }
      else if (response.pong) {
        sendShaders(tabs[0].id, 'editor', shaderFile);
      }
    });
  });
}

function sendShaders(targetTab, targetScript, toSend) {
  const shaderObj = {
    names: [],
    contents: [],
    readOnlyFlags: [],
    bufNums: []
  };
  const fileList = [];

  if (!toSend || toSend.length == 0) { // new file to edit
    var noActiveShaders = true;
    var query = ['settings', 'textures'];
  }
  else {
    if (!Array.isArray(toSend)) { // existing file to edit
      fileList.push(toSend);
      toSend = [toSend];
    }
    else {
      toSend.forEach(function(item) {
        fileList.push(item.name);
      });
    }
    var noActiveShaders = false;
    var query = Array.from(new Set(fileList));
    query.push('settings');
    query.push('textures');
    query.push('savedShaders');
  }

  readRemLoad(function() {
    chrome.storage.local.get(query, function(result) {

      function sendMessage() {
        chrome.tabs.sendMessage(targetTab, {
          target: targetScript, 
          shaders: shaderObj, 
          settings: result.settings, 
          textures: result.textures
        });
      }

      if (noActiveShaders) {
        sendMessage();
        return;
      }

      toSend.forEach(function(item) {
        const name = (item.name) ? item.name : item;
        // check if the file exists
        if (result.savedShaders[name]) {
          shaderObj.names.push(name);
          shaderObj.contents.push(result[name].text);
          shaderObj.readOnlyFlags.push(result.savedShaders[name].inFileSystem);
          shaderObj.bufNums.push((item.bufNum) ? item.bufNum-1 :  null); // subtract 1 for 0 based indexing
        }
      });
      sendMessage();
    });
  });
}

function executeChain(contentScripts, callback) {
  let chain = callback;
  contentScripts.forEach(function(scriptName) {
    let prevChain = chain;
    chain = function() {
      chrome.tabs.executeScript({file: scriptName}, prevChain);
    };
  });
  chain();
}

function styleChain(cssFiles, callback) {
  let chain = callback;
  cssFiles.forEach(function(fileName) {
    let prevChain = chain;
    chain = function() {
      chrome.tabs.insertCSS({file: fileName}, prevChain);
    };
  });
  chain();
}



function readRemLoad(callback) {
  readDirectory('glsl', function(entries) {
    removeFiles(entries, function(entries, savedShaders, dropped) {
      loadFiles(entries, savedShaders, dropped, callback);
    });
  });
}

function readDirectory(directory, callback) {
  chrome.runtime.getPackageDirectoryEntry(function(directoryEntry) {
    directoryEntry.getDirectory(directory, {}, function(subDirectoryEntry) {
      const directoryReader = subDirectoryEntry.createReader();
      directoryReader.readEntries(function(entries) {
        callback(entries);
      });
    });
  });
}

function removeFiles(entries, callback) {
  chrome.storage.local.get(['savedShaders'], function(result) {
    const markedForRemoval = [];
    let savedShaders = {}
    if (result.savedShaders) {
      savedShaders = result.savedShaders;
      for (let key in savedShaders) {
        if (savedShaders[key].inFileSystem) {
          markedForRemoval.push(key);
          delete savedShaders[key];
        }
      }
    }

    chrome.storage.local.set({savedShaders: savedShaders}, function() {
      chrome.storage.local.remove(markedForRemoval, function () {
        callback(entries, savedShaders, false);
      });
    });
  });
}


function loadFiles(entries, savedShaders, dropped, callback) {

  const loadedShaders = {};
  let i = 0;
  (function readNext(i) {

    function readFile(shaderFile) {
      const fileReader = new FileReader();
      fileReader.addEventListener('loadend', function(e) {
        if ((dropped && savedShaders[shaderFile.name] && savedShaders[shaderFile.name].inFileSystem) ||
            (storageKeys.indexOf(shaderFile.name) != -1)) {
          // file was dropped and it exists in the filesystem, or the name is banned, so skip
        }
        else {
          loadedShaders[shaderFile.name] = {
            text: fileReader.result
          };
          savedShaders[shaderFile.name] = {
            inFileSystem: !dropped
          };
          loadedShaders['savedShaders'] = savedShaders;
        }

        determineContinue();
      });

      fileReader.readAsText(shaderFile);
    };

    function determineContinue() {
      if (i < entries.length-1) {
        readNext(++i);
      }
      else if (i == entries.length-1) {
        chrome.storage.local.set(loadedShaders, callback);
      }
    }

    if (!dropped && entries[i].isFile) {
      entries[i].file(function(shaderFile) {
        readFile(shaderFile);
      });
    }
    else if (dropped && entries[i].type.slice(0, 4) == "text") {
      readFile(entries[i]);
    }
    else {
      determineContinue();
    }
  })(i);
}
