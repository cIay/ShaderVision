const numTextures = 6;

document.getElementById("menu-textures").addEventListener('click', function() {
  buttonAnimation(this);
  document.getElementById("textures-page").style.display = 'block';
  document.getElementById("textures-surroundings").style.display = 'block';
});

document.getElementById("textures-surroundings").addEventListener('click', function() {
  document.getElementById("textures-page").style.display = 'none';
  document.getElementById("textures-surroundings").style.display = 'none';
});

document.getElementById("textures-close").addEventListener('click', function() {
  document.getElementById("textures-page").style.display = 'none';
  document.getElementById("textures-surroundings").style.display = 'none';
});

(function createPreviewContainer() {

  const previewContainer = document.createElement('div');
  previewContainer.id = "preview-container";

  for (let i = 0; i < numTextures; i++) {
    const previewWrapper = document.createElement('div');
    previewWrapper.className = "preview-wrapper";
    //previewWrapper.tabIndex = 0;
    previewWrapper.id = i;

    const previewControls = document.createElement('div');
    previewControls.className = "preview-controls";

    const texNum = document.createElement('div');
    texNum.className = "tex-num";
    texNum.appendChild(document.createTextNode(`tex${i+1}`));
    previewControls.appendChild(texNum);

    const uploadBtn = document.createElement('div');
    uploadBtn.className = "upload-btn ui-icon ui-icon-arrowstop-1-n";
    previewControls.appendChild(uploadBtn);

    previewWrapper.appendChild(previewControls);

    previewContainer.appendChild(previewWrapper);
  }

  const texPage = document.getElementById("textures-page");
  $(texPage).droppable();
  texPage.appendChild(previewContainer);
}());


chrome.storage.local.get(['textures'], function(result) {
  if (!result.textures) {
    chrome.storage.local.set({textures: []});
    return;
  }

  const wrappers = document.getElementsByClassName("preview-wrapper");
  for (let i = 0; i < wrappers.length; i++) {
    if (result.textures[i]) {
      const newImage = document.createElement('img');
      newImage.className = "preview";
      newImage.src = result.textures[i]
      makeImageDraggable(newImage);
      wrappers[i].appendChild(newImage);
    }
  }
});



/* Browser drag and drop */

$(".preview-wrapper").droppable({
  greedy: true,
  tolerance: "pointer",
  hoverClass: 'drop-hover',
  drop: function(e, ui) {
    const image = $(this).children()[1];
    $(image).detach().appendTo($(ui.draggable).parent());
    $(ui.draggable).detach().css({top: 0, left: 0}).appendTo(this);
    animateElement(this, 800, (t) => {
      return `highlight ${t}ms ease-out`
    });
    storeImages();
  }
});

function makeImageDraggable(item) {
  $(item).draggable({
    zIndex: 1,
    opacity: 0.35,
    containment: 'window',
    revert: function(target) {
      if (!target) {
        $(this).remove();
        storeImages();
      }
      else if (target.context.id == "textures-page") {
        return true; // revert
      }
    }
  });
}
makeImageDraggable(".preview");


/* OS drag and drop */

$("html").on("dragover", function(e) {
  e.preventDefault();
  e.originalEvent.dataTransfer.dropEffect = "none";
  $(".preview-wrapper").css({"background-color": ""});
});

$(".preview-wrapper").on("dragover", function(e) {
  e.preventDefault();
  e.stopPropagation();
  e.originalEvent.dataTransfer.dropEffect = "copy";
  $(this).css({"background-color": "hsla(155, 90%, 55%, 35%)"});
});


$(".preview-wrapper").on("drop", function(e) {
  e.preventDefault();
  if (e.originalEvent.dataTransfer) {
    const file = e.originalEvent.dataTransfer.files[0];
    $(this).css({"background-color": ""});
    const self = this;
    const regex = /^image/;
    if (regex.test(file.type)) {
      const fileReader = new FileReader();
      fileReader.addEventListener('loadend', function(e) {
        const image = $(self).children()[1];
        if (image) {
          image.remove();
        }
        const newImage = document.createElement('img');
        newImage.src = fileReader.result;
        newImage.className = "preview";
        makeImageDraggable(newImage);
        self.appendChild(newImage);
        animateElement(self, 800, (t) => {
          return `highlight ${t}ms ease-out`
        });
        storeImages();
      });
      fileReader.readAsDataURL(file);
    }
  }
});


function storeImages() {
  let images = [];
  const wrappers = document.getElementsByClassName("preview-wrapper");
  for (let i = 0; i < wrappers.length; i++) {
    const preview = wrappers[i].children[1];
    if (preview) {
      images[i] = preview.src;
    }
    else {
      images[i] = null;
    }
  }
  chrome.storage.local.set({textures: images});
}
