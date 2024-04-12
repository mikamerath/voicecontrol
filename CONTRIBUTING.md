# Contributing to Voice Control
This template heavily follows the [Microsoft Python Extension Template](https://github.com/microsoft/vscode-python-tools-extension-template)
## Requirements

- VS Code 1.64.0 or greater
- Python 3.8 or greater, Python 3.12 not supported yet
- node >= 18.17.0
- npm >= 8.19.0 (`npm` is installed with node, check npm version, use `npm install -g npm@8.3.0` to update)
- Python extension for VS Code

You should know to create and work with python virtual environments.

## Getting Started

1. Fork or clone the code from [here](https://github.com/mikamerath/voicecontrol).
1. Check-out your repo locally on your development machine.
1. Create and activate a python virtual environment for this project in a terminal. Be sure to use the minimum version of python for your tool. This template was written to work with python 3.8 or greater.
1. Install `nox` in the activated environment: `python -m pip install nox`.
1. Add your favorite tool to `requirements.in`
1. Run `nox --session setup`.
1. **Optional** Install test dependencies `python -m pip install -r src/test/python_tests/requirements.txt`. You will have to install these to run tests from the Test Explorer.
1. Install node packages using `npm install`.
1. Go to https://marketplace.visualstudio.com/vscode and create a publisher account if you don't already have one.
    1. Use the published name in `package.json` by replacing `<my-publisher>` with the name you registered in the marketplace.


## Building and Run the extension

Run the `Debug Extension and Python` configuration from VS Code. That should build and debug the extension in host window.

Note: if you just want to build you can run the build task in VS Code (`ctrl`+`shift`+`B`)

## Debugging

To debug both TypeScript and Python code use `Debug Extension and Python` debug config. This is the recommended way. Also, when stopping, be sure to stop both the Typescript, and Python debug sessions. Otherwise, it may not reconnect to the python session.

To debug only TypeScript code, use `Debug Extension` debug config.

To debug a already running server or in production server, use `Python Attach`, and select the process that is running `lsp_server.py`.

## Logging and Logs

The template creates a logging Output channel that can be found under `Output` > `mytool` panel. You can control the log level running the `Developer: Set Log Level...` command from the Command Palette, and selecting your extension from the list. It should be listed using the display name for your tool. You can also set the global log level, and that will apply to all extensions and the editor.

If you need logs that involve messages between the Language Client and Language Server, you can set `"mytool.server.trace": "verbose"`, to get the messaging logs. These logs are also available `Output` > `mytool` panel.

## Adding new Settings or Commands

You can add new settings by adding details for the settings in `package.json` file. To pass this configuration to your python tool server (i.e, `lsp_server.py`) update the `settings.ts` as need. There are examples of different types of settings in that file that you can base your new settings on.

## Testing

See `src\test\python_tests\test_server.py` for starting point. See, other referred projects here for testing various aspects of running the tool over LSP.

If you have installed the test requirements you should be able to see the tests in the test explorer.

You can also run all tests using `nox --session tests` command.

## Linting

Run `nox --session lint` to run linting on both Python and TypeScript code. Please update the nox file if you want to use a different linter and formatter.

## Packaging and Publishing

1. Update various fields in `package.json`. At minimum, check the following fields and update them accordingly. See [extension manifest reference](https://code.visualstudio.com/api/references/extension-manifest) to add more fields:
    - `"publisher"`: Update this to your publisher id from <https://marketplace.visualstudio.com/>.
    - `"version"`: See <https://semver.org/> for details of requirements and limitations for this field.
    - `"keywords"`: Update keywords for your project, these will be used when searching in the VS Code marketplace.
    - `"categories"`: Update categories for your project, makes it easier to filter in the VS Code marketplace.
    - `"homepage"`, `"repository"`, and `"bugs"` : Update URLs for these fields to point to your project.
    - **Optional** Add `"icon"` field with relative path to a image file to use as icon for this project.
1. Make sure to check the following markdown files:
    - Every Release: `CHANGELOG.md`
1. Build package using `nox --session build_package`.
1. Take the generated `.vsix` file and upload it to your extension management page <https://marketplace.visualstudio.com/manage>.

To do this from the command line see here <https://code.visualstudio.com/api/working-with-extensions/publishing-extension>

## Troubleshooting

### Changing path or name of `lsp_server.py` something else

If you want to change the name of `lsp_server.py` to something else, you can. Be sure to update `constants.ts` and `src\test\python_tests\lsp_test_client\session.py`.

Also make sure that the inserted paths in `lsp_server.py` are pointing to the right folders to pick up the dependent packages.

### Module not found errors

This can occurs if `bundled/libs` is empty. That is the folder where we put your tool and other dependencies. Be sure to follow the build steps need for creating and bundling the required libs.

[voicecontrol](https://github.com/mikamerath/voicecontrol)