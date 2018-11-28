# ![icon48](https://user-images.githubusercontent.com/10470041/48099653-87f80300-e1dd-11e8-8ef1-68d44ba24f8b.png) ShaderBliss
ShaderBliss is a Chrome extension that lets you write fragment shaders and apply them to videos and images on the web.

## Installation
[Download ZIP](https://github.com/cIay/ShaderBliss/archive/master.zip) & extract, then:
> Customize and control Google Chrome -> More tools -> Extensions -> Load unpacked (Developer mode must be on)

## Hotkeys
#### Dropdown
* __Alt-S__: Save settings
* __Alt-A__: Apply chosen shaders
* __Tab__: Swap selection area
* __Enter__: Add/clone selected shader
* __Backspace or Delete__: Remove/delete selected shader
* __Ctrl-Shift-Up__: Swap selected shader with the one above
* __Ctrl-Shift-Down__: Swap selected shader with the one below

#### Editor ([CodeMirror](https://codemirror.net/) defaults)
* __Ctrl-S__: Save

#### Target page
* __Alt-R__: Start/stop recording
* __Alt-S__: Take screenshot
* __Alt-A__: Apply selected shaders

## Uniforms
```glsl
uniform vec2 resolution;     // intrinsic width and height of the WebGL canvas in pixels
uniform sampler2D frame;     // active frame texture
uniform float time;          // time since the shader began running in seconds
uniform float deltaTime;     // time since the last draw in seconds
uniform vec2 mouse;          // mouse location coordinates
uniform sampler2D timeData;  // audio time domain samples
uniform sampler2D freqData;  // audio frequency domain dB values
uniform float bass;          // energy sum from 0 Hz - 300 Hz
uniform float avgBass;       // average bass energy in the last second
uniform float mid;           // energy sum from 300 Hz - 4000 Hz
uniform float avgMid;        // average midrange energy in the last second
uniform float treb;          // energy sum from 4000 Hz - Nyquist
uniform float avgTreb;       // average treble energy in the last second
uniform float energy;        // energy sum from 0 Hz - Nyquist
uniform float avgEnergy;     // average total energy in the last second
```

## Screenshots
![screen1](https://user-images.githubusercontent.com/10470041/48097232-81b25880-e1d6-11e8-93a7-c66b6002a94e.PNG)

![screen2](https://user-images.githubusercontent.com/10470041/48097233-824aef00-e1d6-11e8-8024-413c9c0a19ec.PNG)

![screen3](https://user-images.githubusercontent.com/10470041/48097234-824aef00-e1d6-11e8-8bcd-28c5d95cd552.PNG)

![screen4](https://user-images.githubusercontent.com/10470041/48097235-824aef00-e1d6-11e8-9664-b8178fde6a7a.PNG)

## Miscellaneous Info
- Files can be added in one of three ways: 
  1. By opening the editor (via the 'New file' or 'Edit' button) and saving with Ctrl-S 
  2. By saving your file directly to the 'glsl' directory in your ShaderBliss folder
  3. By dropping a text file into the shader-list area within the main dropdown page
- Files in the 'glsl' directory are considered read-only by the extension and cannot be changed or removed through the ShaderBliss dropdown page.
- Due to cross-origin restrictions image or video data will sometimes be inaccessible. If this is the case a new tab will open using the source as the URL. You should then be able to use the extension as usual in this new tab.
- You may experience performance issues if the dimensions of your target video/image are too large.
- Useful links: [The Book of Shaders](https://thebookofshaders.com/), [Shadertoy](https://www.shadertoy.com/), [GLSL Sandbox](http://glslsandbox.com/), [iq's Website](http://www.iquilezles.org/www/index.htm)
