// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('voice control started correctly');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('helloworld.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello world - this is the voice control project');
	});
    // Create and show a new webview panel
    const panel = vscode.window.createWebviewPanel(
        'yourPanel', //For internals
        'Voice Control', //Shown externally as a tab
        vscode.ViewColumn.Two, 
        {
            enableScripts: true 
        }
    );

    // Set the HTML content for the webview
    panel.webview.html = getWebviewContent();
	context.subscriptions.push(disposable);
}

function getWebviewContent() {
    return `
        <h1>I AM AN HTML DISPLAY WINDOW!!</h1>
        <p>Fear me.</p>
    `;
}
