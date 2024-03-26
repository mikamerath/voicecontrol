These instructions will be updated when we have our landing page on our first release

# Windows Users
1. Download the latest version of ffmpeg from this [link](https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip/) or from this [website](https://www.gyan.dev/ffmpeg/builds/). Scroll down to release builds and click on **ffmpeg-release-essentials.zip**
2. Create a folder in your C: drive called bin (or whatever you would like to call it)
3. Extract the zipped folder. Inside, the ffmpeg-x.x.x-essentials_build\bin there should be three executables, ffmpeg.exe, ffplay.exe, and ffprobe.exe. Copy these into C:\bin
4. Right click on This PC and select Properties
5. In the search box type Advanced System Settings and click "View Advanced System Settings"
6. Click the Environment Variables... button
7. Click the "Path" variable and then the edit button
8. Click the New button and then type C:\bin (or the path of wherever you installed ffmpeg)
9. Select OK in the Edit Environmental Variables window and then select OK in the System Properties Window
10. ffmpeg should now be installed, open any command prompt and type ffmpeg to verify the installation worked

## Choco installation
`choco install ffmpeg`

# Mac Users
`brew install ffmpeg`

# Linux Users
`sudo apt install ffmpeg`