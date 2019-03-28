# ![icon48](https://user-images.githubusercontent.com/10470041/48099653-87f80300-e1dd-11e8-8ef1-68d44ba24f8b.png) ShaderVision
ShaderVision is a Chrome extension that lets you write fragment shaders and apply them to videos and images on the web.

## Installation
[Download ZIP](https://github.com/cIay/ShaderVision/archive/master.zip) & extract, then:
> Customize and control Google Chrome -> More tools -> [Extensions](chrome://extensions/) -> Load unpacked (Developer mode must be on)

## Hotkeys
#### Dropdown
* __Alt-S__: Save settings
* __Alt-A__: Apply all chosen shaders
* __Space__: Apply selected shader
* __Tab__: Swap selection area
* __Enter__: Add/clone selected shader
* __Backspace or Delete__: Remove selected shader
* __Ctrl-Shift-Up__: Swap selected shader with the one above
* __Ctrl-Shift-Down__: Swap selected shader with the one below
* __Right__: Increment buffer slot of selected shader
* __Left__: Decrement buffer slot of selected shader
* __Ctrl-F__: Focus on search bar


#### Editor ([CodeMirror](https://codemirror.net/) defaults)
* __Ctrl-S__: Save and apply all chosen shaders

#### Target page
* __Alt-R__: Start/stop recording
* __Alt-S__: Take screenshot
* __Alt-A__: Apply selected shaders

## Uniforms
```glsl
uniform vec2 resolution;     // intrinsic width and height of the WebGL canvas in pixels
uniform sampler2D curFrame;  // captured video/image frame of the current render cycle
uniform sampler2D prevFrame; // captured video/image frame of the previous render cycle
uniform sampler2D frame;     // output frame of the preceding shader program, or curFrame if this program is first
uniform sampler2D bufN;      // output frame of the shader program set to buffer N (from 1 to 3)
uniform sampler2D thisBuf;   // output of this program in the previous render cycle as long as it has a buffer number set
uniform sampler2D texN;      // input image texture where N is the slot number (from 1 to 6)
uniform float time;          // time since the program began running in seconds
uniform float timeDelta;     // time since the last draw in seconds
uniform float drawCount;     // number of draws since the program began running
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
![screen1](https://github.com/cIay/cIay.github.io/blob/master/images/ShaderVision/monaco_fluidflow.png)

![screen2](https://github.com/cIay/cIay.github.io/blob/master/images/ShaderVision/monaco_shaded.png)

![screen3](https://github.com/cIay/cIay.github.io/blob/master/images/ShaderVision/monaco_glitched.png)

![screen4](https://github.com/cIay/cIay.github.io/blob/master/images/ShaderVision/monaco_noise.PNG)

## Random Tips & Info
- You should use the 'frame' uniform over 'curFrame' where possible so you can chain your shaders together for some interesting results.
- Files can be added in three different ways: 
  1. By opening the editor (via the 'New file' or 'Edit' buttons) and saving with Ctrl-S 
  2. By saving your file directly to the 'glsl' directory in your ShaderVision folder
  3. By dropping a text file into the shader-list area within the main dropdown page
- Files in the 'glsl' directory are considered read-only by the extension and cannot be changed or removed through the ShaderVision dropdown page.
- Due to cross-origin restrictions image or video data will sometimes be inaccessible. If this is the case a new tab will open using the source as the URL. You should then be able to use the extension as usual in this new tab.
- The target media item will be the video with the largest dimensions unless no video is present in which case the largest image is chosen instead.
- Don't set multiple shader programs to the same buffer number. Or do, I don't care.
- You may experience performance issues if the dimensions of your target video/image are too large.
- Very useful links: 
  - [The Book of Shaders](https://thebookofshaders.com/)
  - [Shadertoy](https://www.shadertoy.com/)
  - [GLSL Sandbox](http://glslsandbox.com/)
  - [iq's Website](http://www.iquilezles.org/www/index.htm)
