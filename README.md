# Voice Control extension for VS Code

A Python based extension that allows for the execution of VS Code commands by speaking them.

## Quick Start (Extension will not run without these steps)

1. Install [Python](https://www.python.org/downloads/) on to your system. Version must be greater than Python 3.8 and less than Python 3.12. Be sure that your installed Python version is a part of your PATH variable

1. Install [FFmpeg](https://ffmpeg.org/). Detailed instructions for installing and configuring ffmpeg to work with your system can be found [here](INSTALLING_FFMPEG.md).

1. Validate the installation of Python by running `python --version`.

1. Validate that FFmpeg was installed and configured correctly by running `ffmpeg -version`.

1. You are ready to start issuing commands.

## Usage

Once the extension has started, you should see that Voice Control is waiting for the activation word in the bottom left of the VS Code window. To start using the extension, speak the activation word (defaults to "go") to prepare the extension to listen to your command. 

![Image showing the status bar on VS Code with an addition that says Voice Control: Waiting for activation word](https://github.com/mikamerath/voicecontrol/blob/main/images/WaitingForActivation.PNG?raw=true "StatusBar")


Speak the name of the command you would like to execute. The default names of the commands are the ones listed when opening the command palette (CTRL+SHIFT+P or COMMAND+SHIFT+P). The command should execute and the status bar will notify that the extension is listening for the activation word again.

![Image showing the status bar on VS Code with an addition that says Voice Control: Please say a command](https://github.com/mikamerath/voicecontrol/blob/main/images/Listening.PNG?raw=true "ChangedStatusBar")

Here is a gif showing zooming out, deleting a line, and zooming out again, all without using keyboard input.
![Gif showing the execution of delete line and undo commands](https://github.com/mikamerath/voicecontrol/blob/main/images/Running.gif?raw=true "FullExecution")


## Features

- Configure which activation word you would like to use from a list of 27 words
- Rename the spoken phrase to execute a command
- Use any locale available to VS Code (coming soon)
- Runs every command available to VS Code, even those added by other extensions


## Dependencies
Because Voice Control is a Python based extension, it requires Python > 3.8 to be installed.

In addition to a Python interpreter, Voice Control also depends on [FFmpeg](https://ffmpeg.org/).

Voice Control depends on the [Python extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python) which will be automatically installed.

Voice Control will use the default microphone available to your OS.

## Supported Locales
This extension is available in `en`

## Support for VS Code Dev
Voice Control is not supported on [vscode.dev](https://vscode.dev/) and support is not planned for it.