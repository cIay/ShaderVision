# ![icon48](https://user-images.githubusercontent.com/10470041/48099653-87f80300-e1dd-11e8-8ef1-68d44ba24f8b.png) ShaderBliss
ShaderBliss is a Chrome extension that lets you write fragment shaders and apply them to videos and images on the web.

## Installation
[Download ZIP](https://github.com/cIay/ShaderBliss/archive/master.zip) & extract, then:
> Customize and control Google Chrome -> More tools -> Extensions -> Load unpacked

## Hotkeys
#### Popup
* __Alt-S__: Save settings
* __Alt-X__: Execute selected shaders

#### Editor ([CodeMirror](https://codemirror.net/) defaults)
* __Ctrl-S__: Save

#### Target page
* __R__: Start/stop recording
* __S__: Take screenshot
* __X__: Execute selected shaders

## Screenshots
![screen1](https://user-images.githubusercontent.com/10470041/48097232-81b25880-e1d6-11e8-93a7-c66b6002a94e.PNG)

![screen2](https://user-images.githubusercontent.com/10470041/48097233-824aef00-e1d6-11e8-8024-413c9c0a19ec.PNG)

![screen3](https://user-images.githubusercontent.com/10470041/48097234-824aef00-e1d6-11e8-8bcd-28c5d95cd552.PNG)

![screen4](https://user-images.githubusercontent.com/10470041/48097235-824aef00-e1d6-11e8-9664-b8178fde6a7a.PNG)

## Miscellaneous Info
- Files can be added in two ways: by opening the editor (via the 'New file' and 'Edit' buttons) and saving with Ctrl-S, or by saving your file directly to the 'glsl' directory in your ShaderBliss folder.
- Files in the 'glsl' directory are considered read-only by the extension and cannot be changed or removed through the ShaderBliss popup page.
- You may experience performance issues if the dimensions of your target video/image are too large.
- Useful links: [The Book of Shaders](https://thebookofshaders.com/), [Shadertoy](https://www.shadertoy.com/), [GLSL Sandbox](http://glslsandbox.com/)
