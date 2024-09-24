// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { LanguageClient, Message } from 'vscode-languageclient/node';
import { registerLogger, traceError, traceLog, traceVerbose } from './common/log/logging';
import {
    checkVersion,
    getInterpreterDetails,
    initializePython,
    onDidChangePythonInterpreter,
    resolveInterpreter,
} from './common/python';
import { restartServer } from './common/server';
import { checkIfConfigurationChanged, getInterpreterFromSetting } from './common/settings';
import { loadServerDefaults } from './common/setup';
import { getLSClientTraceLevel } from './common/utilities';
import { createOutputChannel, onDidChangeConfiguration, registerCommand } from './common/vscodeapi';
import { Console } from 'console';
import { commandNameToID } from './command-mapping';
import { commandNameToIDIta } from './command-mapping-ita';
import { commandNameToIDTr } from './command-mapping-tr';

import availableThemes from './color-themes';

import * as fs from 'fs';
import * as path from 'path';

const rootPath =
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : undefined;

let iconPathBlue = vscode.Uri.file('');
let iconPathGreen = vscode.Uri.file('');
let iconPathGrey = vscode.Uri.file('');

let lsClient: LanguageClient | undefined;
let uiController: UIController | undefined;

let statusText: string = 'Voice Control is starting up...';
let color: string = 'grey';

let listening = false;
let invalidThemeSelected = '';

let voiceControlStatusViewer: VoiceControlStatusViewer;

let locale = vscode.env.language;

let awaitingCommandArgument: boolean = false;
let currentMultistepCommand: string = '';

let renamingPanel: vscode.WebviewPanel | undefined;

// Command handler map
const commandHandlers: { [key: string]: (message: any) => void } = {
    'Preferences: Color Theme': handleColorThemeCommand,
    'Go to Line/Column...': handleGoToLine,
    'Go to File...': handleGoToFile,
    'Rename Command...': handleRenameCommand,
    'Rename Command: show chosen command': handleShowChosenCommand,
    wake: (message: any) => {
        uiController?.waitForActivation('');
    },
    listen: (message: any) => {
        uiController?.listenForCommand();
    },
    // Add other commands here
};
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // This is required to get server name and module. This should be
    // the first thing that we do in this extension.
    const serverInfo = loadServerDefaults();
    const serverName = serverInfo.name;
    const serverId = serverInfo.module;

    updateRemappingWindow(context);

    iconPathBlue = vscode.Uri.file(context.asAbsolutePath('images/blue-circle.png'));
    iconPathGrey = vscode.Uri.file(context.asAbsolutePath('images/grey-circle.png'));
    iconPathGreen = vscode.Uri.file(context.asAbsolutePath('images/green-circle.png'));
    //Make an instance of uiController for this session
    uiController = new UIController();

    // Register the renaming custom command
    let renamedCommandInfo = vscode.commands.registerCommand('VoiceControl.renamedCommandInfo', (command, alias) => {});

    //Get workspace root
    voiceControlStatusViewer = new VoiceControlStatusViewer();
    vscode.window.registerTreeDataProvider('VoiceControl', voiceControlStatusViewer);
    //Set up treeview data provider to refresh based on the extension's current state
    vscode.commands.registerCommand('VoiceControlStatusViewer.refresh', () => voiceControlStatusViewer.refresh());

    // Setup logging
    const outputChannel = createOutputChannel(serverName);
    context.subscriptions.push(outputChannel, registerLogger(outputChannel));

    const changeLogLevel = async (c: vscode.LogLevel, g: vscode.LogLevel) => {
        const level = getLSClientTraceLevel(c, g);
        await lsClient?.setTrace(level);
    };

    context.subscriptions.push(
        outputChannel.onDidChangeLogLevel(async (e) => {
            await changeLogLevel(e, vscode.env.logLevel);
        }),
        vscode.env.onDidChangeLogLevel(async (e) => {
            await changeLogLevel(outputChannel.logLevel, e);
        }),
        renamedCommandInfo,
    );

    // Log Server information
    traceLog(`Name: ${serverInfo.name}`);
    traceLog(`Module: ${serverInfo.module}`);
    traceVerbose(`Full Server Info: ${JSON.stringify(serverInfo)}`);

    const runServer = async () => {
        const interpreter = getInterpreterFromSetting(serverId);
        if (interpreter && interpreter.length > 0) {
            if (checkVersion(await resolveInterpreter(interpreter))) {
                traceVerbose(`Using interpreter from ${serverInfo.module}.interpreter: ${interpreter.join(' ')}`);
                lsClient = await restartServer(serverId, serverName, outputChannel, lsClient);
            }
            return;
        }

        const interpreterDetails = await getInterpreterDetails();
        if (interpreterDetails.path) {
            traceVerbose(`Using interpreter from Python extension: ${interpreterDetails.path.join(' ')}`);
            lsClient = await restartServer(serverId, serverName, outputChannel, lsClient);
            lsClient?.start();
            lsClient?.onNotification('custom/notification', (message) => {
                traceLog('Received message from Python:', message);
                //This message content can include both voice commands from the user and python server messages
                //Execute command
                if (!handleMessage(message.content)) {
                    if (message.content == 'Command not found') {
                        handleNoCommandFound(message.parameters);
                    } else if (message.content == 'Renaming Command: Final') {
                        handleRenamingCommandFinal(message, locale, context);
                    } else if (message.content == 'Command not renamed') {
                        handleCommandNotRenamed(message.parameters);
                    } else if (message.content == 'Display command suggestions') {
                        handleCommandSuggestions(message.parameters, locale);
                    } else {
                        if (locale == 'it') {
                            vscode.commands.executeCommand(commandNameToIDIta[message.content]);
                        } else if (locale == 'tr') {
                            vscode.commands.executeCommand(commandNameToIDTr[message.content]);
                        } else {
                            vscode.commands.executeCommand(commandNameToID[message.content]);
                        }
                        uiController?.waitForActivation('');
                    }
                }
            });
            return;
        }

        traceError(
            'Python interpreter missing:\r\n' +
                '[Option 1] Select python interpreter using the ms-python.python.\r\n' +
                `[Option 2] Set an interpreter using "${serverId}.interpreter" setting.\r\n` +
                'Please use Python 3.8 or greater.',
        );
    };

    context.subscriptions.push(
        onDidChangePythonInterpreter(async () => {
            await runServer();
        }),
        onDidChangeConfiguration(async (e: vscode.ConfigurationChangeEvent) => {
            if (checkIfConfigurationChanged(e, serverId)) {
                await runServer();
            }
        }),
        registerCommand(`${serverId}.restart`, async () => {
            await runServer();
        }),
    );

    setImmediate(async () => {
        const interpreter = getInterpreterFromSetting(serverId);
        if (interpreter === undefined || interpreter.length === 0) {
            traceLog(`Python extension loading`);
            await initializePython(context.subscriptions);
            traceLog(`Python extension loaded`);
        } else {
            await runServer();
        }
    });
}

export async function deactivate(): Promise<void> {
    if (lsClient) {
        await lsClient.stop();
    }
}

class UIController {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    }

    waitForActivation(message: string) {
        listening = false;
        if (message !== '') {
            statusText = message;
        } else {
            statusText = 'Voice Control : Waiting for activation word';
        }
        color = 'blue';
        this.statusBarItem.text = '$(mic)' + statusText;
        this.statusBarItem.show();

        voiceControlStatusViewer.refresh();
        setTimeout(() => {
            if (!listening) {
                this.statusBarItem.text = '$(mic)' + 'Voice Control : Waiting for activation word';
            }
        }, 3000);
    }

    listenForCommand() {
        listening = true;
        statusText = 'Voice Control : Listening for voice command...';
        color = 'green';
        this.statusBarItem.text = '$(sync~spin)' + statusText;
        this.statusBarItem.show();

        voiceControlStatusViewer.refresh();
    }
}

export class VoiceControlStatusViewer implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
        new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private newTreeItem: vscode.TreeItem;

    constructor() {
        this.newTreeItem = new vscode.TreeItem(statusText, vscode.TreeItemCollapsibleState.Expanded);
        this.newTreeItem.tooltip = 'Displays a status update for the Voice Control extension.';
        this.newTreeItem.iconPath = iconPathBlue; // Assign the icon path to the tree item
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        this.newTreeItem.label = statusText;
        this.updateColor();
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        this.newTreeItem.label = statusText;
        this.updateColor();
        if (!element) {
            return [this.newTreeItem];
        }

        return [];
    }

    updateColor() {
        switch (color) {
            case 'blue':
                this.newTreeItem.iconPath = iconPathBlue;
                break;
            case 'grey':
                this.newTreeItem.iconPath = iconPathGrey;
                break;
            case 'green':
                this.newTreeItem.iconPath = iconPathGreen;
                break;
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}
//A commonly used method for comparing string similarity
function levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
        }
    }

    return matrix[b.length][a.length];
}

// Uses the levenshtein function to compare the message with each theme and return the closest match
function findMostSimilarTheme(themeName: string, themeList: string[], threshold: number = 3): string | null {
    let closestTheme: string | null = null;
    let minDistance = Infinity;

    for (const theme of themeList) {
        const distance = levenshtein(themeName, theme);
        if (distance < minDistance) {
            closestTheme = theme;
            minDistance = distance;
        }
    }
    console.log(minDistance);
    // If the minimum distance exceeds the threshold, consider it too different
    if (minDistance > threshold) {
        return null;
    }
    return closestTheme;
}

function handleRenameCommand() {
    uiController?.waitForActivation('Say activation word, then the command to rename');
}

function handleShowChosenCommand() {
    uiController?.waitForActivation('Say activation word, then the alias for the command');
}

function handleRenamingCommandFinal(message: any, locale: string, context: vscode.ExtensionContext) {
    const alias = message.parameters[1];

    uiController?.waitForActivation('Successfully renamed command to ' + alias);
    updateRemappingWindow(context);
}

function handleNoCommandFound(parameters: string) {
    uiController?.waitForActivation('Command "' + parameters + '" does not exist');
}

function handleCommandNotRenamed(parameters: string) {
    uiController?.waitForActivation('Command "' + parameters + '" does not exist, renaming failed');
}

function setMultiStepCommandState(command: string) {
    currentMultistepCommand = command;
    awaitingCommandArgument = true;
    uiController?.waitForActivation('');
}

function resetMultiStepCommandState() {
    awaitingCommandArgument = false;
    currentMultistepCommand = '';
    if (invalidThemeSelected !== '') {
        uiController?.waitForActivation(invalidThemeSelected + ' is not a valid theme');
    } else {
        uiController?.waitForActivation('');
    }
}
function handleColorThemeCommand(message: any) {
    if (awaitingCommandArgument) {
        const config = vscode.workspace.getConfiguration();
        // Ensures the theme selected by the user is in the right format
        const selectedTheme = findMostSimilarTheme(message, availableThemes);
        if (selectedTheme) {
            config.update('workbench.colorTheme', selectedTheme, vscode.ConfigurationTarget.Global);
        } else {
            invalidThemeSelected = message;
        }
        vscode.commands.executeCommand('workbench.action.closeQuickOpen');
        resetMultiStepCommandState();
    } else {
        vscode.commands.executeCommand('workbench.action.selectTheme');
        setMultiStepCommandState(message);
    }
}

function handleGoToLine(message: any) {
    if (awaitingCommandArgument) {
        //Closing it here because it's already open to let the user know they need to say a number
        vscode.commands.executeCommand('workbench.action.closeQuickOpen');
        vscode.commands.executeCommand('workbench.action.quickOpen', ':' + message);
        vscode.commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');
        resetMultiStepCommandState();
    } else {
        vscode.commands.executeCommand(commandNameToID[message]);
        setMultiStepCommandState(message);
    }
}
function handleGoToFile(message: any) {
    if (awaitingCommandArgument) {
        //Closing it here because it's already open since we want the user to see the list of files
        vscode.commands.executeCommand('workbench.action.closeQuickOpen');
        // Inputs the chosen file name and selects the top option
        vscode.commands.executeCommand('workbench.action.quickOpen', message);
        vscode.commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');
        resetMultiStepCommandState();
    } else {
        vscode.commands.executeCommand(commandNameToID[message]);
        setMultiStepCommandState(message);
    }
}
function handleMessage(message: any): Boolean {
    if (awaitingCommandArgument && !commandHandlers[message]) {
        console.log('accepting message as parameter');
        if (commandHandlers[currentMultistepCommand]) {
            commandHandlers[currentMultistepCommand](message);
            return true;
        }
    } else {
        if (commandHandlers[message]) {
            commandHandlers[message](message);
            return true;
        } else {
            console.log('Unknown command', message);
            return false;
        }
    }
    return false;
}

function updateRemappingWindow(context: vscode.ExtensionContext) {
    const filePath = context.asAbsolutePath(path.join('bundled', 'tool', 'renaming.json'));
    const pathExists = fs.existsSync(filePath);

    if (!renamingPanel) {
        let disposable = vscode.commands.registerCommand('VoiceControl.showRemappingWindow', () => {
            renamingPanel = vscode.window.createWebviewPanel(
                'remappingMenu', // Identifies the type of the webview. Used internally
                'Remap Voice Bindings', // Title of the panel displayed to the user
                vscode.ViewColumn.One, // Editor column to show the new webview panel in.
                {
                    enableScripts: true, // Enable scripts in the webview
                },
            );

            // And set its HTML content
            if (pathExists) {
                renamingPanel.webview.html = getVCRemappingContent(context);
            } else {
                renamingPanel.webview.html = getVCRemappingContentNoBindings(context);
            }
        });

        context.subscriptions.push(disposable);
    } else {
        if (pathExists) {
            renamingPanel.webview.html = getVCRemappingContent(context);
        } else {
            renamingPanel.webview.html = getVCRemappingContentNoBindings(context);
        }
    }
}

function getVCRemappingContentNoBindings(context: vscode.ExtensionContext) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Command Remap</title>
    <style>
        body {
            display: flex;
            justify-content: center;
            align-items: flex-start; /* Aligns near the top */
            height: 100vh;
            margin: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #1e1e1e; /* VSCode dark background */
            color: #d4d4d4; /* Light grey text */
        }
        .message-box {
            margin-top: 100px; /* Adjusts vertical position */
            text-align: center;
            background-color: #252526; /* Slightly lighter dark background */
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            border: 1px solid #3c3c3c; /* Border similar to VSCode panels */
        }
        h1 {
            font-size: 24px;
            margin-bottom: 10px;
            color: #569cd6; /* Light blue to match VSCode dark theme highlights */
        }
        p {
            font-size: 16px;
            color: #cccccc;
        }
    </style>
</head>
<body>
    <div class="message-box">
        <h1>No Command Remapped</h1>
        <p>Remap at least one command to see your changes listed here.</p>
    </div>
</body>
</html>

    `;
}

function getVCRemappingContent(context: vscode.ExtensionContext) {
    let originalCommands = [''];
    let renamedCommands = [''];

    originalCommands.pop();
    renamedCommands.pop();

    const filePath = context.asAbsolutePath(path.join('bundled', 'tool', 'renaming.json'));

    const rawData = fs.readFileSync(filePath, 'utf8');
    let parsedData = JSON.parse(rawData);

    const parsedCommands = parsedData.commands;

    let i = 0;
    for (const parsedCommand in parsedCommands) {
        if (parsedCommands.hasOwnProperty(parsedCommand)) {
            const value = parsedCommands[parsedCommand];
            //append to original and renamed
            originalCommands.push(value);
            renamedCommands.push(parsedCommand);
            i += 1;
        }
    }

    let parsedCommandList = '';

    for (let i = 0; i < originalCommands.length; i++) {
        parsedCommandList +=
            `<div class="menu-item">
    <span>` +
            originalCommands[i] +
            `</span>
    <span>= : ` +
            renamedCommands[i] +
            `</span>
    </div>
    </body>
    </html>
    `;
    }

    //TODO : Some of the text in here will need to be translated for each locale
    return (
        `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Remapping Window</title>
                <style>
                    body {
                        font-family: sans-serif;
                        margin: 0;
                        padding: 0;
                        display: flex;
                        flex-direction: column;
                    }
                    .menu-item {
                        display: flex;
                        justify-content: space-between;
                        padding: 10px;
                        border-bottom: 1px solid #ccc;
                    }
                    .menu-item:hover {
                        background-color: #262626;
                    }
                    .keybinding {
                        background-color: #223c54;
                        padding: 5px 10px;
                        border-radius: 3px;
                        cursor: pointer;
                    }
                </style>
            </head>
            <body>
                <h1> Voice Command Map</h1>
        ` + parsedCommandList
    );
}

async function handleCommandSuggestions(parameters: [], locale: string) {
    const selection = await vscode.window.showQuickPick(parameters, {
        placeHolder: 'Select an option',
    });

    if (selection) {
        vscode.window.showInformationMessage(`You selected: ${selection}`);
        if (locale == 'it') {
            vscode.commands.executeCommand(commandNameToIDIta[selection]);
        } else if (locale == 'tr') {
            vscode.commands.executeCommand(commandNameToIDTr[selection]);
        } else {
            vscode.commands.executeCommand(commandNameToID[selection]);
        }
        uiController?.waitForActivation('');
    } else {
        uiController?.waitForActivation('');
        return;
    }
}
