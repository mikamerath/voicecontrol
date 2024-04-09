// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
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
import { StringDictionary, commandNameToID } from './command-mapping';

let lsClient: LanguageClient | undefined;
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // This is required to get server name and module. This should be
    // the first thing that we do in this extension.
    const serverInfo = loadServerDefaults();
    const serverName = serverInfo.name;
    const serverId = serverInfo.module;

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
            lsClient?.onNotification('custom/notification', async (message) => {
                traceLog('Received message from Python:', message);
                vscode.commands.executeCommand(commandNameToID[message.content]).then(
                    () => {
                        traceLog(message.content + ' executed');
                    },
                    (err) => {
                        traceError('Error executing ' + message.content + ' command:', err);
                    },
                );
                let commnadName: string = message.content;
                if (commnadName.toLowerCase().includes('go to line'.toLowerCase())) {
                    let lineNum: Promise<number> = extractNumber(message.content);
                    if ((await lineNum) !== -1) {
                        goToLine(await lineNum);
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

        registerCommand(`${serverId}.startUI`, () => {
            startUI();
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

    startUI();
}

export async function deactivate(): Promise<void> {
    if (lsClient) {
        await lsClient.stop();
    }
}
export async function goToLine(lineNumber: number): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const position = editor.selection.active;
        const newPosition = position.with(lineNumber - 1, 0);
        const newSelection = new vscode.Selection(newPosition, newPosition);
        editor.selection = newSelection;
        editor.revealRange(newSelection, vscode.TextEditorRevealType.InCenter);
    }
}

export async function extractNumber(input: string): Promise<number> {
    const match = input.match(/\d+/);
    if (match) {
        return parseInt(match[0], 10);
    }
    return -1;
}

let statusBarItem: vscode.StatusBarItem;
export function startUI() {
    console.log('Starting UI');
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

    // Show message in the status bar
    statusBarItem.text = 'Voice Control : Waiting for activation word';
    statusBarItem.show();

    // Clear the status bar after a delay (e.g., 5 seconds)
    //setTimeout(() => {
    //statusBarItem.hide();
    //}, 5000);
    vscode.window.showInformationMessage('Voice Control will give you its status in the bottom left corner :)');
}
