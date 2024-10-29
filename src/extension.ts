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
import { checkIfConfigurationChanged, getExtensionSettings, getInterpreterFromSetting } from './common/settings';
import { loadServerDefaults } from './common/setup';
import { getLSClientTraceLevel } from './common/utilities';
import { createOutputChannel, onDidChangeConfiguration, registerCommand } from './common/vscodeapi';
import { Console } from 'console';
import { commandNameToID } from './command-mapping';
import { commandNameToIDIta } from './command-mapping-ita';
import { commandNameToIDTr } from './command-mapping-tr';
import { commandNameToIDEsp } from './command-mapping-esp';
import { commandNameToIDPt } from './command-mapping-pt';
import { commandNameToIDFr } from './command-mapping-fr';
import { commandNameToIDHu } from './commands-mapping-hu';
import { commandNameToIDRu } from './command-mapping-ru';
import { commandNameToIDJap } from './command-mapping-jap';
import { commandNameToIDKo } from './command-mapping-ko';
import { commandNameToIDPl } from './command-mapping-pl';
import { commandNameToIDCs } from './command-mapping-cs';
import { commandNameToIDDe } from './command-mapping-de';
import { FrontEndController } from './FrontEndController';
import availableThemes from './color-themes';

import * as fs from 'fs';
import * as path from 'path';

const rootPath =
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : undefined;

let lsClient: LanguageClient | undefined;
let uiController: UIController | undefined;

let listening = false;
let invalidThemeSelected = '';

let locale = vscode.env.language;
const config = vscode.workspace.getConfiguration('voice-control');
const enableRenamingConfirmation: Boolean = config.get('enableRenamingConfirmation') as boolean;

let awaitingCommandArgument: boolean = false;
let currentMultistepCommand: string = '';

let renamingPanel: vscode.WebviewPanel | undefined;

let extensionContext: vscode.ExtensionContext;

// Command handler map
const commandHandlers: { [key: string]: (message: any) => void } = {
    'Preferences: Color Theme': handleColorThemeCommand,
    'Go to Line/Column...': handleGoToLine,
    'Go to File...': handleGoToFile,
    'Rename Command...': handleRenameCommand,
    'Rename Command: show chosen command': handleShowChosenCommand,
    wake: (/*message: any*/) => {
        uiController?.waitForActivation('');
    },
    loading: (/*message: any*/) => {
        uiController?.loading();
    },
    listen: (/*message: any*/) => {
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

    extensionContext = context;

    updateRemappingWindow();

    FrontEndController.setUpFrontEnd();
    //Make an instance of uiController for this session
    uiController = new UIController();

    // Register the renaming custom command
    let renamedCommandInfo = vscode.commands.registerCommand(
        'VoiceControl.renamedCommandInfo',
        (/*command, alias*/) => {},
    );

    // Setup logging
    const outputChannel = createOutputChannel(serverName);
    extensionContext.subscriptions.push(outputChannel, registerLogger(outputChannel));

    const changeLogLevel = async (c: vscode.LogLevel, g: vscode.LogLevel) => {
        const level = getLSClientTraceLevel(c, g);
        await lsClient?.setTrace(level);
    };

    extensionContext.subscriptions.push(
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
                handleServerMessage(message);
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

    extensionContext.subscriptions.push(
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
            await initializePython(extensionContext.subscriptions);
            traceLog(`Python extension loaded`);
        } else {
            await runServer();
        }
    });
}

function executeLocaleCommand(messageContent: string, locale: string) {
    const localeCommandMap: { [key: string]: { [key: string]: string } } = {
        it: commandNameToIDIta,
        tr: commandNameToIDTr,
        es: commandNameToIDEsp,
        'pt-br': commandNameToIDPt,
        fr: commandNameToIDFr,
        hu: commandNameToIDHu,
        ru: commandNameToIDRu,
        ja: commandNameToIDJap,
        ko: commandNameToIDKo,
        pl: commandNameToIDPl,
        cs: commandNameToIDCs,
        de: commandNameToIDDe,
        default: commandNameToID,
    };

    const commandMap = localeCommandMap[locale] || localeCommandMap['default'];
    const command = commandMap[messageContent];

    vscode.commands.executeCommand(command);
}

function handleServerMessage(message: any) {
    if (handleMessage(message.content)) {
        return;
    }

    switch (message.content) {
        case 'Command not found':
            handleNoCommandFound(message.parameters);
            break;
        case 'Renaming Command: Final':
            handleRenamingCommandFinal(message);
            break;
        case 'Command not renamed':
            handleCommandNotRenamed(message.parameters);
            break;
        case 'Display command suggestions':
            handleCommandSuggestions(message.parameters, locale);
            break;
        default:
            executeLocaleCommand(message.content, locale);
            uiController?.waitForActivation('');
    }
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
            FrontEndController.statusText = message;
        } else {
            FrontEndController.statusText = 'Voice Control : Waiting for activation word';
        }
        FrontEndController.color = 'blue';
        this.statusBarItem.text = '$(mic)' + FrontEndController.statusText;
        this.statusBarItem.show();

        FrontEndController.refreshStatusViewer();
        setTimeout(() => {
            if (!listening) {
                this.statusBarItem.text = '$(mic)' + 'Voice Control : Waiting for activation word';
            }
        }, 3000);
    }

    listenForCommand() {
        listening = true;
        FrontEndController.statusText = 'Voice Control : Listening for voice command...';
        FrontEndController.color = 'green';
        this.statusBarItem.text = '$(sync~spin)' + FrontEndController.statusText;
        this.statusBarItem.show();

        FrontEndController.refreshStatusViewer();
    }

    loading() {
        this.statusBarItem.text = '$(sync~loading)' + 'Voice Control : Waiting for activation word';
        this.statusBarItem.show();

        FrontEndController.refreshStatusViewer();
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

function handleRenamingCommandFinal(message: any /*locale: string,*/) {
    const alias = message.parameters[1];

    const old_alias = message.parameters[2];

    if (enableRenamingConfirmation) {
        // Initial message with Confirm and Undo buttons
        vscode.window
            .showInformationMessage('Please confirm remapping to ' + alias, 'Confirm', 'Undo')
            .then((selection) => {
                if (selection === 'Confirm') {
                    // Show new message with View remapping window and Exit buttons
                    vscode.window
                        .showInformationMessage('Action confirmed', 'View remapping window', 'Exit')
                        .then((newSelection) => {
                            if (newSelection === 'View remapping window') {
                                // Code to open the remapping window here
                                vscode.commands.executeCommand('VoiceControl.showRemappingWindow');
                            } else if (newSelection === 'Exit') {
                                showTimedMessage("Say command 'Voice Control: Show Remapping Window'", 8000);
                            }
                        });
                    uiController?.waitForActivation('Successfully renamed command to ' + alias);
                } else if (selection === 'Undo') {
                    vscode.window.showInformationMessage('Renaming undone');
                    // Code to handle undo action here
                    // if there is an old alias, reset command back to that
                    undoCommandAlias(alias, old_alias);
                    uiController?.waitForActivation('');
                }
            });
    } else {
        uiController?.waitForActivation('Successfully renamed command to ' + alias);
        showTimedMessage("Say command 'Voice Control: Show Remapping Window'", 8000);
    }
    updateRemappingWindow();
}

function undoCommandAlias(alias: string, old_alias: string) {
    const filePath = extensionContext.asAbsolutePath(path.join('bundled', 'tool', 'renaming.json'));
    const rawData = fs.readFileSync(filePath, 'utf8');
    let parsedData = JSON.parse(rawData);

    // If the command doesn't have an old alias, it doesn't need to be reverted just delete from file.
    if (old_alias === '') {
        const originalCommandName = parsedData.aliases[alias];
        delete parsedData.aliases[alias];
        delete parsedData.commands[originalCommandName];
    }
    // If there is an old alias, revert it back to its old remapping.
    else {
        const originalCommandName = parsedData.aliases[alias];
        delete parsedData.aliases[alias];
        parsedData.aliases[old_alias] = originalCommandName;
        parsedData.commands[originalCommandName] = old_alias;
    }

    fs.writeFileSync(filePath, JSON.stringify(parsedData, null, 2), 'utf8');
    updateRemappingWindow();
}

async function wait(duration: number) {
    return new Promise<void>((resolve) => {
        setTimeout(() => resolve(), duration);
    });
}

function showTimedMessage(message: string, duration: number) {
    vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: message,
            cancellable: false,
        },
        async (_progress) => {
            // Wait for the specified duration before dismissing the message
            await wait(duration);
        },
    );
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
        invalidThemeSelected = '';
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
        }
    }
    return false;
}

function updateRemappingWindow() {
    const filePath = extensionContext.asAbsolutePath(path.join('bundled', 'tool', 'renaming.json'));
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

            renamingPanel.webview.onDidReceiveMessage((message) => {
                switch (message.command) {
                    case 'rename':
                        const { newName, index } = message;
                        renameAlias(newName, index);
                        break;
                }
            });

            // And set its HTML content
            if (pathExists) {
                renamingPanel.webview.html = FrontEndController.getVCRemappingContent();
            } else {
                renamingPanel.webview.html = FrontEndController.getVCRemappingContentNoBindings();
            }
        });

        extensionContext.subscriptions.push(disposable);
    } else {
        if (pathExists) {
            renamingPanel.webview.html = FrontEndController.getVCRemappingContent();
        } else {
            renamingPanel.webview.html = FrontEndController.getVCRemappingContentNoBindings();
        }
    }
}

function renameAlias(newName: string, index: number) {
    const filePath = extensionContext.asAbsolutePath(path.join('bundled', 'tool', 'renaming.json'));
    const rawData = fs.readFileSync(filePath, 'utf8');
    let parsedData = JSON.parse(rawData);

    const originalCommandName = Object.keys(parsedData.commands)[index];

    //Add '...' to indicate that this command takes multiple steps.
    if (originalCommandName.includes('...') && !newName.includes('...')) {
        newName += '...';
    }

    const currentAlias = parsedData.commands[originalCommandName];

    delete parsedData.aliases[currentAlias];
    parsedData.aliases[newName] = originalCommandName;

    parsedData.commands[originalCommandName] = newName;

    fs.writeFileSync(filePath, JSON.stringify(parsedData, null, 2), 'utf8');

    updateRemappingWindow();
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

export function getContext() {
    return extensionContext;
}
