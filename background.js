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
  'activeShaders', 
  'savedShaders'
];

const runScripts = [
  'shaderbliss.js'
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
    // if file does not yet exist and isn't a banned name, or it does exist and isn't read-only
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
      if (!shaders) {
        chrome.storage.local.get(['activeShaders'], function(result) {
          if (!response) {
            executeChain(runScripts, function() {
              sendShaders(tabs[0].id, 'canvas', result.activeShaders);
            });
          }
          else if (response.pong) {
            sendShaders(tabs[0].id, 'canvas', result.activeShaders);
          }
        });
      }
      else {
        if (!response) {
          executeChain(runScripts, function() {
            sendShaders(tabs[0].id, 'canvas', shaders);
          });
        }
        else if (response.pong) {
          sendShaders(tabs[0].id, 'canvas', shaders);
        }
      }
    });
  });
}

function textEdit(shaderFile) {
  chrome.tabs.query({active:true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {target: 'editor', ping: true}, function(response) {
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

function sendShaders(targetTab, targetScript, fileList) {
  const shaderObj = {
    names: [],
    contents: [],
    readOnlyFlags: []
  };

  let query;
  let noActiveShaders = false;
  if (!fileList || fileList.length == 0) {
    noActiveShaders = true;
    query = ['settings'];
  }
  else {
    if (!Array.isArray(fileList)) {
      fileList = [fileList];
    }

    query = Array.from(new Set(fileList));
    query.push('settings');
    query.push('savedShaders');
  }

  readRemLoad(function() {
    chrome.storage.local.get(query, function(result) {
      if (noActiveShaders) {
        //TODO: write getNewFilename() which appends an incrementing number to the 'New Shader' name
        chrome.tabs.sendMessage(targetTab, {target: targetScript, shaders: shaderObj, settings: result.settings});
        return;
      }

      fileList.forEach(function(name) {
        // check if the file exists
        if (result.savedShaders[name]) {
          shaderObj.names.push(name);
          shaderObj.contents.push(result[name].text);
          shaderObj.readOnlyFlags.push(result.savedShaders[name].inFileSystem);
        }
      });
      chrome.tabs.sendMessage(targetTab, {target: targetScript, shaders: shaderObj, settings: result.settings});
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
    //console.log(result);

    let markedForRemoval = [];
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
