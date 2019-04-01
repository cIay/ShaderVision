//chrome.storage.local.clear();

const defaultSettings = {
  audioSource: 'video',
  fftSize: 2048,
  smoothingFactor: 0.8,
  videoBitrate: 3000000,
  audioBitrate: 128000,
  hideReadOnly: false
};

(function setDefault() {
  chrome.storage.local.get(['settings'], function(result) {
    if (!result.settings) {
      chrome.storage.local.set({settings: defaultSettings});
    }
  });
})();


const audioSourceElement = document.getElementById("audio-source");
const fftSizeElement = document.getElementById("fft-size");
const smoothingFactorElement = document.getElementById("smoothing-factor");
const videoBitrateElement = document.getElementById("video-bitrate");
const audioBitrateElement = document.getElementById("audio-bitrate");
const hideReadOnlyElement = document.getElementById("hide-readonly");


(function populateFFTSizeOption(minSize, maxSize) {
  for (let i = minSize; i < maxSize+1; i*=2) {
    let sizeOption = document.createElement('option');
    sizeOption.value = i;
    sizeOption.innerText = i;
    fftSizeElement.appendChild(sizeOption);
  }
})(32, 16384);


function setElementValues(settings) {

  function setSelectedOption(element, targetVal) {
    const options = element.children;
    for (let i = 0; i < options.length; i++) {
      if (options[i].value == targetVal) {
        options[i].selected = true;
      }
      else {
        options[i].selected = false;
      }
    }
  };

  setSelectedOption(audioSourceElement, settings.audioSource);
  setSelectedOption(fftSizeElement, settings.fftSize);
  smoothingFactorElement.value = settings.smoothingFactor;
  videoBitrateElement.value = settings.videoBitrate;
  audioBitrateElement.value = settings.audioBitrate;
  hideReadOnlyElement.checked = settings.hideReadOnly;
}

document.getElementById("menu-options").addEventListener('click', function() {
  buttonAnimation(this);
  chrome.storage.local.get(['settings'], function(result) {
    if (result.settings) {
      setElementValues(result.settings);
    }
    document.getElementById("options-page").style.display = 'block';
    document.getElementById("options-surroundings").style.display = 'block';
  });
});

document.getElementById("options-surroundings").addEventListener('click', function() {
  document.getElementById("options-page").style.display = 'none';
  document.getElementById("options-surroundings").style.display = 'none';
});

document.getElementById("options-close").addEventListener('click', function() {
  document.getElementById("options-page").style.display = 'none';
  document.getElementById("options-surroundings").style.display = 'none';
});

function saveAnimation(items) {
  for (let i = 0; i < items.length; i++) {
    animateElement(items[i], 800, (t) => {
      return `highlight ${t}ms ease-out`
    });
  }
}

document.getElementById("options-form").addEventListener('submit', function(e) {
  e.preventDefault();
  if (document.getElementById("options-page").style.display != 'block') {
    return;
  }
  chrome.storage.local.set({settings: {
    audioSource: audioSourceElement.value,
    fftSize: parseInt(fftSizeElement.value),
    smoothingFactor: parseFloat(smoothingFactorElement.value),
    videoBitrate: parseInt(videoBitrateElement.value),
    audioBitrate: parseInt(audioBitrateElement.value),
    hideReadOnly: hideReadOnlyElement.checked
  }}, function() {
    saveAnimation(document.getElementsByClassName("options-input"));
    refreshShaderList();
  });
});

document.getElementById("options-revert").addEventListener('click', function() {
  buttonAnimation(this);
  setElementValues(defaultSettings);
});