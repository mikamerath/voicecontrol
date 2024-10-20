import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { getContext } from './extension';

let iconPathBlue = vscode.Uri.file('');
let iconPathGreen = vscode.Uri.file('');
let iconPathGrey = vscode.Uri.file('');

let voiceControlStatusViewer: VoiceControlStatusViewer;
export class FrontEndController {
    constructor() {}

    static statusText: string = 'Voice Control is starting up...';
    static color: string = 'grey';

    static setUpFrontEnd() {
        let context = getContext();
        iconPathBlue = vscode.Uri.file(context.asAbsolutePath('images/blue-circle.png'));
        iconPathGrey = vscode.Uri.file(context.asAbsolutePath('images/grey-circle.png'));
        iconPathGreen = vscode.Uri.file(context.asAbsolutePath('images/green-circle.png'));

        voiceControlStatusViewer = new VoiceControlStatusViewer();
        vscode.window.registerTreeDataProvider('VoiceControl', voiceControlStatusViewer);
        vscode.commands.registerCommand('VoiceControlStatusViewer.refresh', () => voiceControlStatusViewer.refresh());
    }

    static refreshStatusViewer() {
        voiceControlStatusViewer.refresh();
    }

    static getVCRemappingContent(): string {
        let context = getContext();
        let originalCommands: string[] = [''];
        let renamedCommands: string[] = [''];

        const backgroundColor = new vscode.ThemeColor('editor.background');

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
                <span>${renamedCommands[i]}</span>
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
        }
        .message-box {
            margin-top: 50px;
            text-align: center;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            border: 1px solid var(vscode--editor-background);
            width: 400px;
            position: relative; /* Allows child elements to position themselves relative to this */
        }
        .message-box .background-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: var(--vscode-editor-background);
            z-index: -1; /* Keep this behind the text */
            border-radius: 8px;
        }
        .message-box h1 {
            font-size: 24px;
            margin-bottom: 20px;
            color: var(--vscode-editor-foreground);
            position: relative;
        }
        .command-list {
            margin-top: 20px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-editor-foreground);
            border-radius: 8px;
            padding: 15px;
            position: relative;
        }
        .menu-item {
            display: flex;
            justify-content: space-between;
            padding: 10px 15px;
            margin-bottom: 10px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-radius: 4px;
        }
        .menu-item input {
            background-color: var(--vscode-button-background);
            filter: brightness(0.5); /* Darken the background */
            color: var(--vscode-button-foreground);
            border: none;
            border-bottom: 1px solid #569cd6;
            outline: none;
            width: 100%;
        }
        span {
            color: var(--vscode-button-foreground);
        }
    </style>
</head>
<body>
    <div class="message-box">
        <div class="background-overlay"></div> <!-- This div applies the darkened background -->
        <h1>Remap Voice Bindings</h1>
        ${parsedCommandList} <!-- Inject the dynamically generated command list here -->
    </div>

    <script>
        const vscode = acquireVsCodeApi();

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
}

export class VoiceControlStatusViewer implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
        new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private newTreeItem: vscode.TreeItem;

    constructor() {
        this.newTreeItem = new vscode.TreeItem(FrontEndController.statusText, vscode.TreeItemCollapsibleState.Expanded);
        this.newTreeItem.tooltip = 'Displays a status update for the Voice Control extension.';
        this.newTreeItem.iconPath = iconPathBlue; // Assign the icon path to the tree item
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        this.newTreeItem.label = FrontEndController.statusText;
        this.updateColor();
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        this.newTreeItem.label = FrontEndController.statusText;
        this.updateColor();
        if (!element) {
            return [this.newTreeItem];
        }

        return [];
    }

    updateColor() {
        switch (FrontEndController.color) {
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
