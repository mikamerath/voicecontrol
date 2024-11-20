import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { getContext } from './extension';
import { lsClient } from './extension';
import { setMutedState } from './extension';

let iconPathBlue = vscode.Uri.file('');
let iconPathGreen = vscode.Uri.file('');
let iconPathGrey = vscode.Uri.file('');
let iconPathMicUnmuted = vscode.Uri.file('');
let iconPathMicMuted = vscode.Uri.file('');

let voiceControlStatusViewer: VoiceControlStatusViewer;
export class FrontEndController {
    static statusText: string = 'Voice Control is starting up...';
    static muteStatusText: string = 'Unmuted.';
    static color: string = 'grey';
    static muted: boolean = false;

    static listening: boolean = false;

    static statusBarItem: vscode.StatusBarItem;

    constructor() {}

    static setUpFrontEnd() {
        FrontEndController.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

        let context = getContext();
        iconPathBlue = vscode.Uri.file(context.asAbsolutePath('images/blue-circle.png'));
        iconPathGrey = vscode.Uri.file(context.asAbsolutePath('images/grey-circle.png'));
        iconPathGreen = vscode.Uri.file(context.asAbsolutePath('images/green-circle.png'));
        iconPathMicUnmuted = vscode.Uri.file(context.asAbsolutePath('images/mic-unmuted.png'));
        iconPathMicMuted = vscode.Uri.file(context.asAbsolutePath('images/mic-muted.png'));

        voiceControlStatusViewer = new VoiceControlStatusViewer();
        vscode.window.registerTreeDataProvider('VoiceControl', voiceControlStatusViewer);

        vscode.commands.registerCommand('VoiceControl.toggleMute', () => {
            FrontEndController.toggleMute();
        });

        FrontEndController.statusBarItem.command = 'VoiceControl.toggleMute';

        vscode.commands.registerCommand('VoiceControlStatusViewer.refresh', () => voiceControlStatusViewer.refresh());
    }

    static waitForActivation(message: string = '') {
        this.listening = false;

        FrontEndController.color = 'blue';
        FrontEndController.statusText = VoiceControlStatusViewer.getIconStatusText();

        if (message !== '') {
            FrontEndController.statusText = message;
        }

        FrontEndController.refreshStatusViewer();
        setTimeout(() => {
            if (!this.listening) {
                FrontEndController.refreshStatusViewer();
            }
        }, 3000);
    }

    static loading() {
        FrontEndController.statusText = VoiceControlStatusViewer.getIconStatusText();

        FrontEndController.refreshStatusViewer();
    }

    static listenForCommand() {
        FrontEndController.listening = true;

        FrontEndController.color = 'green';
        FrontEndController.statusText = VoiceControlStatusViewer.getIconStatusText();

        FrontEndController.refreshStatusViewer();
    }

    static refreshStatusViewer() {
        voiceControlStatusViewer.refresh();
    }

    static toggleMute() {
        FrontEndController.muted = !FrontEndController.muted;

        FrontEndController.muteStatusText = FrontEndController.muted ? 'Muted.' : 'Unmuted.';

        let micIcon = '';
        if (FrontEndController.muted) {
            micIcon = '$(close)' + '';
        } else {
            micIcon = '$(mic)' + '';
        }

        setMutedState(FrontEndController.muted);

        FrontEndController.statusText = VoiceControlStatusViewer.getIconStatusText();
        FrontEndController.refreshStatusViewer();
    }

    static getVCRemappingContent(): string {
        let context = getContext();
        let originalCommands: string[] = [''];
        let renamedCommands: string[] = [''];

        originalCommands.pop(); // Removing the empty element added initially
        renamedCommands.pop();

        const filePath = context.asAbsolutePath(path.join('bundled', 'tool', 'renaming.json'));

        const rawData = fs.readFileSync(filePath, 'utf8');
        let parsedData = JSON.parse(rawData);

        const parsedCommands = parsedData.commands;

        // Populate the original and renamed commands arrays
        for (const parsedCommand in parsedCommands) {
            if (parsedCommands.hasOwnProperty(parsedCommand)) {
                const value = parsedCommands[parsedCommand];
                originalCommands.push(value);
                renamedCommands.push(parsedCommand);
            }
        }

        // Generate the dynamic HTML for the command list
        let parsedCommandList = '<div class="command-list">';
        for (let i = 0; i < originalCommands.length; i++) {
            parsedCommandList += `
            <div class="menu-item" data-index="${i}">
                <span class="original-command">${originalCommands[i]}</span>
                <span class="arrow">→</span>
                <span class="renamed-command">${renamedCommands[i]}</span>
                <button onClick="handleDelete(${i})">Remove</button>
            </div>`;
        }
        parsedCommandList += '</div>'; // Close the command list container

        // Return the complete HTML structure
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Remapping Window</title>
<style>
    body {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        height: 100vh;
        margin: 0;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background-color: var(--vscode-editor-background);
        color: var(--vscode-button-foreground);
        padding: 0;
    }

    .message-box {
        justify-content: center;
        display: flex;
        flex-direction: column;
        width: 50%;
        max-width: none;
        margin-top: 20px;
        text-align: left;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        border: 1px solid var(--vscode-editor-background);
        position: relative;
    }

    .message-box .background-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: var(--vscode-editor-background);
        z-index: -1;
        border-radius: 8px;
    }

    .message-box h1 {
        font-size: 20px;
        margin-bottom: 15px;
        color: var(--vscode-editor-foreground);
    }

    .command-list {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 80%;
        max-width: 600px;
        margin: 0 auto 15px;
        font-size: 18px;
        color: var(--vscode-editor-foreground);
        background-color: var(--vscode-editor-background);
        border: 1px solid var(--vscode-editor-foreground);
        border-radius: 8px;
        padding: 10px;
    }

    .menu-item {
        display: flex;
        justify-content: space-between;
        padding: 10px 15px;
        margin-bottom: 8px;
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-radius: 4px;
        width: 100%;
        box-sizing: border-box;
    }

    .original-command, .renamed-command {
        flex: 1;
        font-size: 16px;
        color: var(--vscode-button-foreground);
    }

    .arrow{
        .font-size: 18px;
        margin: 0 10px;
        color: var(--vscode-editor-foreground);
    }

    .menu-item span, .menu-item input {
        font-size: 16px;
        color: var(--vscode-button-foreground);
        flex: 1;
        text-align: left;
    }

    .menu-item input {
        background-color: var(--vscode-button-background);
        border: none;
        outline: none;
        border-bottom: 1px solid #569cd6;
    }

    .menu-item button {
        text-align: center;
        margin-bottom: 8px;
    }

    #searchInput {
        background-color: var(--vscode-button-background);
        border: none;
        outline: none;
        border-bottom: 1px solid #569cd6;
        text-align: center;
        margin-bottom: 8px;
        color: white;

    }

    ::placeholder {
        color: white;
      }

</style>

</head>
<body>
    <div class="message-box">
        <div class="background-overlay"></div> <!-- This div applies the darkened background -->
        <h1>Remap Voice Bindings</h1>
        <button class="menu-item" onClick="handleClearAll()">Clear All</button>
        <input type="text" id="searchInput" placeholder="Search...">
        ${parsedCommandList} <!-- Inject the dynamically generated command list here -->
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function handleDelete(index) {
            vscode.postMessage({
                command: 'delete',
                index: index
            });
        }

        function handleClearAll() {
            vscode.postMessage({
                command: 'clear',
            }); 
        }

        function handleRename(newValue, index) {
            vscode.postMessage({
                command: 'rename',
                newName: newValue,
                index: index
            });
        }

        document.querySelectorAll('.menu-item').forEach((item) => {
            const originalSpan = item.querySelector('.original-command');
            const index = item.dataset.index;
            const removeButton = item.querySelector('.remove-button');

            originalSpan.addEventListener('click', function () {
                const currentText = originalSpan.innerText;
                const input = document.createElement('input');
                input.type = 'text';
                input.value = currentText;

                item.replaceChild(input, originalSpan);

                input.addEventListener('keydown', function (event) {
                    if (event.key === 'Enter') {
                        const newValue = input.value;
                        handleRename(newValue, index);

                        originalSpan.innerText = newValue;
                        item.replaceChild(originalSpan, input);
                    }
                });

                input.addEventListener('blur', function () {
                    const newValue = input.value;
                    handleRename(newValue, index);

                    originalSpan.innerText = newValue;
                    item.replaceChild(originalSpan, input);
                });

                input.focus();
            });
        });
    </script>
    <script>
        function handleSearchInput(value) {
            
            const menuItems = document.querySelectorAll(".command-list .menu-item");

            menuItems.forEach(item => {
                const alias = item.querySelector(".original-command").textContent.toLowerCase();
                const command = item.querySelector(".renamed-command").textContent.toLowerCase();
            
                if (alias.includes(value.toLowerCase()) || command.includes(value.toLowerCase())) {
                    item.style.display = "block";
                } else {
                    item.style.display = "none";
                }
            });
        }
        const searchInput = document.getElementById("searchInput");
        searchInput.oninput = function() {handleSearchInput(searchInput.value)};
    </script>
</body>
</html>

    `;
    }

    static getVCRemappingContentNoBindings() {
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
            color: #569cd6;
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
}

export class VoiceControlStatusViewer implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
        new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private statusIcon: vscode.TreeItem;
    private muteIcon: vscode.TreeItem;

    constructor() {
        this.statusIcon = new vscode.TreeItem(FrontEndController.statusText, vscode.TreeItemCollapsibleState.Expanded);
        this.statusIcon.tooltip = 'Displays a status update for the Voice Control extension.';
        this.statusIcon.iconPath = iconPathBlue; // Assign the icon path to the tree item

        this.muteIcon = new vscode.TreeItem(
            FrontEndController.muteStatusText,
            vscode.TreeItemCollapsibleState.Expanded,
        );
        this.muteIcon.tooltip = 'Enabled status for your microphone.';
        this.muteIcon.iconPath = iconPathMicUnmuted;

        this.muteIcon.command = { command: 'VoiceControl.toggleMute', title: 'Toggle Mute' };
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        this.statusIcon.label = FrontEndController.statusText;
        this.muteIcon.label = FrontEndController.muteStatusText;
        this.updateIcons();
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        this.statusIcon.label = FrontEndController.statusText;
        this.muteIcon.label = FrontEndController.muteStatusText;
        this.updateIcons();
        if (!element) {
            return [this.statusIcon, this.muteIcon];
        }

        return [];
    }

    updateIcons() {
        switch (FrontEndController.color) {
            case 'blue':
                this.statusIcon.iconPath = iconPathBlue;
                break;
            case 'grey':
                this.statusIcon.iconPath = iconPathGrey;
                break;
            case 'green':
                this.statusIcon.iconPath = iconPathGreen;
                break;
        }

        switch (FrontEndController.muted) {
            case true:
                this.muteIcon.iconPath = iconPathMicMuted;
                this.statusIcon.iconPath = iconPathGrey;
                break;

            case false:
                this.muteIcon.iconPath = iconPathMicUnmuted;
                break;
        }
    }

    static updateStatusBarText() {
        let micIcon = '$(mic)' + '';

        if (FrontEndController.muted) {
            micIcon = '$(close)' + '';
        }

        switch (FrontEndController.color) {
            case 'blue':
                FrontEndController.statusBarItem.text = micIcon + ' waiting for activation word.';
                FrontEndController.statusBarItem.show();
                return;
            case 'grey':
                FrontEndController.statusBarItem.text = micIcon + ' starting up...';
                return;
            case 'green':
                FrontEndController.statusBarItem.text = '$(sync~spin)' + ' listening for voice command...';
                FrontEndController.statusBarItem.show();
                return;

            default:
                return 'Voice Control';
        }
    }

    static getIconStatusText(): string {
        VoiceControlStatusViewer.updateStatusBarText();
        if (FrontEndController.muted) {
            return 'Muted';
        }

        switch (FrontEndController.color) {
            case 'blue':
                return 'Voice Control : Waiting for activation word.';
            case 'grey':
                return 'Voice Control : Starting up...';
                break;
            case 'green':
                return 'Voice Control : Listening for voice command...';
            default:
                return 'Voice Control';
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}
