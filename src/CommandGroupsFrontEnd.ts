import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
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
import { commandNameToIDZhCn } from './command-mapping-zh-cn';
import { Console } from 'console';

let locale = vscode.env.language;

function getCorrectMap() {
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
        'zh-cn': commandNameToIDZhCn,
        default: commandNameToID,
    };

    return localeCommandMap[locale] || localeCommandMap['default'];
}
export async function showCommandGroups(context: vscode.ExtensionContext) {
    const filePath = context.asAbsolutePath(path.join('bundled', 'tool', 'command_groups.json'));
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
        // Ensure the directory exists
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true }); // Create the directory if it doesn't exist
        }
        // Write an empty JSON array to the file
        fs.writeFileSync(filePath, JSON.stringify([]), 'utf8');
    }
    const rawData = fs.readFileSync(filePath, 'utf8');
    let commandGroups = JSON.parse(rawData);
    const filePath2 = context.asAbsolutePath(path.join('bundled', 'tool', 'renaming.json'));
    const rawData2 = fs.readFileSync(filePath2, 'utf8');
    let parsedData = JSON.parse(rawData2);
    let commandMap = getCorrectMap();
    const availableCommands = await vscode.commands.getCommands();
    for (const key in commandMap) {
        if (commandMap.hasOwnProperty(key)) {
            const value = commandMap[key];
            if (!availableCommands.includes(value)) {
                //console.log(value);
                delete commandMap[key];
            }
        }
    }
    // Remove Renaming command from map
    if (commandMap.hasOwnProperty('Renaming Command: Final')) {
        delete commandMap['Renaming Command: Final'];
    }

    // Create HTML content
    let htmlContent = getCommandGroupHTML(context, false, commandMap);

    // Create and show a new webview panel
    let panel = vscode.window.createWebviewPanel('commandGroups', 'Command Groups', vscode.ViewColumn.One, {
        enableScripts: true,
    });
    // Handle messages from the webview
    panel.webview.onDidReceiveMessage((message) => {
        if (message.type === 'updateCommandOrder') {
            const { rowIndex, commands } = message;

            for (const command of Object.values(commands) as string[]) {
                if (command.includes('...') && !(command === commands[commands.length - 1])) {
                    showTimedMessage(command + ': Multi-step commands have to be last.', 4800);
                    return;
                }
            }
            // Update order of commands
            commandGroups[rowIndex].commands = commands;
            // Save updated command groups to file
            fs.writeFileSync(filePath, JSON.stringify(commandGroups, null, 2), 'utf8');
            panel.webview.html = getCommandGroupHTML(context, true, commandMap);
        } else if (message.type === 'updateGroupName') {
            const { index, newName } = message;
            // Update the group name in the commandGroups array
            commandGroups[index].name = newName;
            // Save updated commandGroups to the file
            fs.writeFileSync(filePath, JSON.stringify(commandGroups, null, 2), 'utf8');
        } else if (message.type === 'addCommand') {
            const { commandName, items } = message;
            const cleanedName = commandName.replace(/[^a-zA-Z]/g, '').toLowerCase();
            if (items.length === 0) {
                showTimedMessage('Ensure at least 2 commands selected.', 3800);
                return;
            }
            for (const command of items) {
                if (command.includes('...') && !(command === items[items.length - 1])) {
                    showTimedMessage(command + ': Multi-step commands have to be last.', 3800);
                    return;
                }
            }
            const parsedAliases = parsedData.aliases;
            for (const parsedCommand in parsedAliases) {
                const cleanedWord = parsedCommand.replace(/[^a-zA-Z]/g, '').toLowerCase();
                if (cleanedWord === cleanedName) {
                    showTimedMessage(parsedCommand + ' alias already exists.', 3800);
                    return;
                }
            }
            for (const key in commandMap) {
                if (Object.prototype.hasOwnProperty.call(commandMap, key)) {
                    const cleanedWord = key.replace(/[^a-zA-Z]/g, '').toLowerCase();
                    if (cleanedWord === cleanedName) {
                        showTimedMessage(key + ' command already exists.', 3800);
                        return;
                    }
                }
            }
            // Add the new command group to the commandGroups array
            commandGroups.push({
                name: commandName,
                commands: items,
            });
            // Save the updated commandGroups array to a file
            fs.writeFileSync(filePath, JSON.stringify(commandGroups, null, 2), 'utf8');
            panel.webview.html = getCommandGroupHTML(context, true, commandMap);
        } else if (message.type === 'refresh') {
            panel.webview.html = getCommandGroupHTML(context, false, commandMap);
        } else if (message.type === 'deleteCommandGroup') {
            const { rowIndex } = message;
            // Remove the corresponding group from the commandGroups array
            commandGroups.splice(rowIndex, 1);
            // Save the updated commandGroups array to the file
            fs.writeFileSync(filePath, JSON.stringify(commandGroups, null, 2), 'utf8');
            panel.webview.html = getCommandGroupHTML(context, false, commandMap);
        } else if (message.type === 'updateCommandGroupItems') {
            const { rowIndex, updatedCommands } = message;
            // Update order of commands
            commandGroups[rowIndex].commands = updatedCommands;
            // Save updated command groups to file
            fs.writeFileSync(filePath, JSON.stringify(commandGroups, null, 2), 'utf8');
            panel.webview.html = getCommandGroupHTML(context, true, commandMap);
        } else if (message.type === 'minimumReached') {
            showTimedMessage('Minimum 2 commands per group.', 3800);
        }
    });
    panel.webview.html = htmlContent;
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

// Get HTML window
function getCommandGroupHTML(context: vscode.ExtensionContext, addingGroup: boolean, commandMap: any): string {
    const filePath = context.asAbsolutePath(path.join('bundled', 'tool', 'command_groups.json'));
    let rawData = fs.readFileSync(filePath, 'utf8');
    let commandGroups = JSON.parse(rawData);

    let commandsJson = JSON.stringify(Object.keys(commandMap));
    const filePath2 = context.asAbsolutePath(path.join('bundled', 'tool', 'renaming.json'));
    const rawData2 = fs.readFileSync(filePath2, 'utf8');
    let parsedData = JSON.parse(rawData2);
    let htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Command Groups</title>
            <style>
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th, td {
                    padding: 8px;
                    text-align: left;
                    border: 1px solid #ddd;
                }
                tr:not(:first-child):hover {
                    background-color: #787373 !important;
                }
                .dropdown {
                    position: relative;
                    width: 100%;
                    font-size: 14px;
                    background-color: black;
                    color: white;
                    border: 1px solid #ddd;
                    cursor: pointer;
                }
                .dropdown-header {
                    padding: 8px;
                    background-color: black;
                    color: white;
                    border: 1px solid #ddd;
                }
                .dropdown-list {
                    display: none;
                    position: absolute;
                    width: 100%;
                    max-height: 200px;
                    overflow-y: auto;
                    background-color: black;
                    color: white;
                    border: 1px solid #ddd;
                    z-index: 1000;
                }
                .dropdown-list .dropdown-item {
                    padding: 8px;
                    cursor: default;
                    background-color: black;
                }
                .dropdown-list .dropdown-item:hover {
                    background-color: #575757;
                }
                .dropdown.open .dropdown-list {
                    display: block;
                }
                .edit-mode select {
                    display: none;
                }
                .validation-message {
                    color: red;
                    font-size: 12px;
                    margin-top: 4px;
                }
                ul.draggable-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    background: black;
                    color: white;
                    display: none;
                }
                .edit-mode ul.draggable-list {
                    display: block;
                }
                ul.draggable-list li {
                    padding: 5px;
                    border: 1px solid #ddd;
                    background: black;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: grab;
                }
                ul.draggable-list li:hover {
                    background-color: #575757;
                }
                .item-delete-btn {
                    color: white;
                    background: #e74c3c;
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    margin-left: 5px;
                }
                .item-delete-btn:hover {
                    background: #c0392b;
                }
                .edit-mode .delete-btn {
                    display: inline-block;
                    background: #e74c3c;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    text-align: center;
                    cursor: pointer;
                    line-height: 18px;
                    margin-right: 8px;
                }
                .edit-mode .delete-btn:hover {
                    background: #c0392b;
                }
                .edit-btn {
                    float: right;
                    background: #3498db;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    cursor: pointer;
                }
                .edit-btn:hover {
                    background: #2980b9;
                }
                .hidden {
                    display: none !important;
                } 
                .form-section {
                    margin-right: 20px;
                }
                .form-section label {
                    display: block;
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                .form-section input[type="text"] {
                    width: 100%;
                    padding: 8px;
                    margin-bottom: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                .search-adddropdown {
                    position: relative;
                }
                #search-results {
                    position: absolute;
                    background-color: white;
                    border: 1px solid #ddd;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                    width: 100%;
                    max-height: 200px;
                    overflow-y: auto;
                    z-index: 100;
                    display: none;
                }
                .search-result {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px;
                    cursor: pointer;
                }
                .search-result:hover {
                    background-color: #f0f0f0;
                }
                .add-btn {
                    background-color: #3498db;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .add-btn:hover {
                    background-color: #2980b9;
                }
                .command-list {
                    margin-top: 10px;
                    max-height: 200px;
                    overflow-y: auto;
                    border: 1px solid #ddd;
                    padding: 10px;
                }
                .command-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 5px 10px;
                    border: 1px solid #ddd;
                    margin-bottom: 5px;
                    background-color: #f9f9f9;
                    cursor: grab;
                }
                .command-item:hover {
                    background-color: #eaeaea;
                }
                .delete-btn {
                    background-color: #e74c3c;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .delete-btn:hover {
                    background-color: #c0392b;
                }
                .bottom-buttons {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 20px;
                }
                .bottom-buttons button {
                    margin-left: 10px;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .add-group-btn {
                    background-color: #27ae60;
                    color: white;
                }
                .add-group-btn:hover {
                    background-color: #1e8449;
                }
                .cancel-btn {
                    background-color: #e74c3c;
                    color: white;
                }
                .cancel-btn:hover {
                    background-color: #c0392b;
                }
                .dropbtn {
                    background-color: #04AA6D;
                    color: white;
                    padding: 16px;
                    font-size: 16px;
                    border: none;
                    cursor: pointer;
                }
                
                /* adddropdown button on hover & focus */
                .dropbtn:hover, .dropbtn:focus {
                    background-color: #3e8e41;
                }
                
                /* The search field */
                #myInput {
                    box-sizing: border-box;
                    background-image: url('searchicon.png');
                    background-position: 14px 12px;
                    background-repeat: no-repeat;
                    font-size: 16px;
                    padding: 8px 8px 8px 8px;
                    border: none;
                    border-bottom: 1px solid #ddd;
                }
                
                /* The search field when it gets focus/clicked on */
                #myInput:focus {outline: 3px solid #ddd;}
                
                /* The container <div> - needed to position the adddropdown content */
                .adddropdown {
                    position: relative;
                    display: inline-block;
                }
                
                /* adddropdown Content (Hidden by Default) */
                .adddropdown-content {
                    display: none;
                    position: absolute;
                    background-color: #f6f6f6;
                    max-width: 200px;
                    border: 1px solid #ddd;
                    z-index: 1;
                }
                #commandsList {
                    max-height: 200px; /* Make the list scrollable */
                    overflow-y: scroll; /* Enable scrolling */
                }
                .container {
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                    margin: auto;
                    width: 60%;
                    gap: 20px;
                    margin-bottom: 25px;
                    padding-top: 20px;
                    padding-bottom: 20px;
                    border: 2px solid white;
                }
                /* Links inside the adddropdown */
                .adddropdown-content a {
                    color: black;
                    padding: 12px 16px;
                    text-decoration: none;
                    display: block;
                }
                .draggable-list-add {
                    width: 250px;
                    border: 1px solid #ccc;
                    background-color: #f9f9f9;
                }

                .draggable-list-add ul {
                    list-style-type: none;
                    padding: 0;
                }

                .draggable-list-add li {
                    margin: 5px 0;
                    padding: 10px;
                    background-color: #fff;
                    border: 1px solid #ccc;
                    color: #000;
                    font-weight: bold;
                    cursor: grab;
                }
                #myInput {
                    width: 200px; /* Set the width of the input field */
                }
                .draggable-list-add li.dragging {
                    opacity: 0.5;
                }
                /* Change color of adddropdown links on hover */
                .adddropdown-content a:hover {background-color: #f1f1f1}
                
                /* Show the adddropdown menu (use JS to add this class to the .adddropdown-content container when the user clicks on the adddropdown button) */
                .show {display:block;} 

                .button {
                    background-color: #04AA6D;
                    border: none;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    text-decoration: none;
                    display: inline-block;
                    font-size: 16px;
                    margin: 4px 2px;
                    cursor: pointer;
                }
            </style>
        </head>
        <body>
            <h1>
                Command Groups
                <button class="edit-btn" id="edit-button" onclick="toggleEditMode()">Edit / Add</button>
            </h1>
             <!-- Adding Command Group Name -->
            <div class="container hidden">
                <div class="form-section">
                <input type="text" id="group-name" placeholder="Command Group Name">
                </div>
                <div class="adddropdown">
                    <input
                        type="text"
                        placeholder="Search.."
                        id="myInput"
                        onkeyup="filterFunction()"
                        onclick="toggleadddropdown(event)"
                    />
                    <div id="myadddropdown" class="adddropdown-content">
                        <div id="commandsList"></div>
                    </div>
                </div>
                
                <div id="draggableList" class="draggable-list-add">
                    <h4 style="color: #000; text-align: center;">Selected Commands</h4>
                    <ul id="dragList"></ul>
                </div>  
                
                <button id="addButton" class="button" style="border-radius: 30%;">+Add</button>
                <script> 
                    // Parse the commands passed from the extension
                    const commands = JSON.parse(${JSON.stringify(commandsJson)});
                    const maxDraggableItems = 7;
                    let draggableItems = [];
                    // Populate the adddropdown dynamically
                    function populateadddropdown() {
                        const commandsList = document.getElementById("commandsList");
                        commandsList.innerHTML = ""; // Clear any existing commands
                        commands.forEach(command => {
                            const link = document.createElement("a");
                            link.href = "#"; // Placeholder URL
                            link.textContent = command;
                            link.onclick = () => addToDraggableList(command);
                            commandsList.appendChild(link);
                        });
                    }
                    function addToDraggableList(command) {
                        if (draggableItems.length >= maxDraggableItems) {
                        return;
                        }
                        draggableItems.push(command);

                        const list = document.getElementById("dragList");
                        const listItem = document.createElement("li");
                        listItem.textContent = command;
                        listItem.setAttribute("data-command", command); 
                        listItem.draggable = true;

                        // Create delete button
                        const deleteButton = document.createElement("button");
                        deleteButton.textContent = "Delete";
                        deleteButton.style.marginLeft = "10px"; // Add some spacing
                        deleteButton.onclick = () => removeFromDraggableList(command, listItem);

                        // Add drag event listeners
                        listItem.addEventListener("dragstart", handleDragStart);
                        listItem.addEventListener("dragover", handleDragOver);
                        listItem.addEventListener("drop", handleDrop);
                        listItem.addEventListener("dragend", handleDragEnd);

                        // Append delete button to the list item
                        listItem.appendChild(deleteButton);
                        list.appendChild(listItem);
                    }

                    // Remove item from draggable list
                    function removeFromDraggableList(command, listItem) {
                        // Remove from the array
                        draggableItems = draggableItems.filter(item => item !== command);

                        // Remove from the DOM
                        listItem.remove();
                    }

                    // Drag-and-drop event handlers
                    let draggedItem = null;

                    function handleDragStart(event) {
                        draggedItem = event.target;
                        event.target.classList.add("dragging");
                        event.dataTransfer.effectAllowed = "move";
                    }

                    function handleDragOver(event) {
                        event.preventDefault(); // Allow drop
                        const list = document.getElementById("dragList");
                        const afterElement = getDragAfterElement(list, event.clientY);
                        const draggingElement = document.querySelector(".dragging");

                        if (afterElement == null) {
                            list.appendChild(draggingElement);
                        } else {
                            list.insertBefore(draggingElement, afterElement);
                        }
                    }

                    function handleDrop(event) {
                        event.preventDefault();
                    }

                    function handleDragEnd(event) {
                        event.target.classList.remove("dragging");
                        draggedItem = null;
                    }

                    // Utility function to get the element after which the dragged item should be placed
                    function getDragAfterElement(container, y) {
                        const draggableElements = [
                            ...container.querySelectorAll("li:not(.dragging)"),
                        ];

                        return draggableElements.reduce(
                            (closest, child) => {
                                const box = child.getBoundingClientRect();
                                const offset = y - box.top - box.height / 2;
                                if (offset < 0 && offset > closest.offset) {
                                    return { offset: offset, element: child };
                                } else {
                                    return closest;
                                }
                            },
                            { offset: Number.NEGATIVE_INFINITY }
                        ).element;
                    }

                    // Toggle adddropdown visibility
                    function toggleadddropdown(event) {
                        event.stopPropagation(); // Prevent document click listener from hiding the adddropdown
                        const adddropdown = document.getElementById("myadddropdown");
                        adddropdown.classList.toggle("show");
                        populateadddropdown(); // Populate when the adddropdown is shown

                        // Close adddropdown when clicking outside
                        document.addEventListener("click", closeadddropdownOnClickOutside);
                    }

                    // Close adddropdown if clicked outside
                    function closeadddropdownOnClickOutside(event) {
                        const adddropdown = document.getElementById("myadddropdown");
                        const input = document.getElementById("myInput");

                        if (!adddropdown.contains(event.target) && event.target !== input) {
                            adddropdown.classList.remove("show");
                            document.removeEventListener("click", closeadddropdownOnClickOutside); // Clean up listener
                        }
                    }

                    // Filter commands
                    function filterFunction() {
                        const input = document.getElementById("myInput");
                        const filter = input.value.toUpperCase();
                        const commandsList = document.getElementById("commandsList");
                        const links = commandsList.getElementsByTagName("a");
                        for (let i = 0; i < links.length; i++) {
                            const txtValue = links[i].textContent || links[i].innerText;
                            if (txtValue.toUpperCase().indexOf(filter) > -1) {
                                links[i].style.display = "";
                            } else {
                                links[i].style.display = "none";
                            }
                        }
                    }
                    var isEditMode = false;
                </script>
            </div>
            
            <table id="command-groups-table">
                <tr>
                    <th class="empty-column hidden"></th>
                    <th>Name</th>
                    <th>Commands</th>
                </tr>
                ${commandGroups
                    .map(
                        (group: { name: string; commands: string[] }, index: number) => `
                    <tr data-index="${index}">
                        <td class="delete-column hidden" style="width:1%"></td>
                        <td>
                            <span class="group-name">${group.name || 'Unnamed Group'}</span>
                            <input class="rename-input" type="text" value="${
                                group.name || 'Unnamed Group'
                            }" style="display: none;" />
                        </td>
                        <td>
                            <div class="dropdown" id="dropdown-${index}">
                                <div class="dropdown-header">Commands:</div>
                                <div class="dropdown-list">
                                    ${group.commands
                                        .map(
                                            (command) => `
                                            <div class="dropdown-item">${command}</div>
                                        `,
                                        )
                                        .join('')}
                                </div>
                            </div>
                            <script>  
                                if(!isEditMode) {
                                    
                                    document.addEventListener('DOMContentLoaded', () => {
                                        const dropdowns = document.querySelectorAll('.dropdown');
                                        dropdowns.forEach((dropdown) => {
                                            const header = dropdown.querySelector('.dropdown-header');
                                            const list = dropdown.querySelector('.dropdown-list');

                                            header.addEventListener('click', (event) => {
                                                if (isEditMode) {
                                                    return;
                                                }
                                                event.stopPropagation(); // Prevent document click listener from triggering

                                                
                                                const isOpen = dropdown.classList.contains('open');
                                                dropdowns.forEach((d) => d.classList.remove('open')); // Close all first
                                                dropdown.classList.add('open'); // Open only the clicked one
                                            });

                                            list.addEventListener('click', (event) => {
                                                event.stopPropagation(); // Prevent clicks inside the dropdown from closing it
                                            });
                                        });

                                        // Close all dropdowns when clicking anywhere else on the document
                                        document.addEventListener('click', () => {
                                            dropdowns.forEach((dropdown) => {
                                                dropdown.classList.remove('open');
                                            });
                                        });
                                    }); 
                                }
                            </script>
                            <ul class="draggable-list">
                                ${group.commands
                                    .map(
                                        (command, itemIndex) => `
                                    <li draggable="true" data-item-index="${itemIndex}">
                                        ${command}
                                        <button class="item-delete-btn" data-item-index="${itemIndex}">x</button>
                                    </li>
                                `,
                                    )
                                    .join('')}
                            </ul>
                        </td>
                    </tr>
                `,
                    )
                    .join('')}
            </table>
            <script>
                const editButton = document.getElementById('edit-button');
                const table = document.getElementById('command-groups-table');
                const container = document.querySelector('.container');
                const addButton = document.getElementById('addButton');
                const groupNameInput = document.getElementById('group-name');
                const draggableList = document.getElementById('dragList');

                // Add Button Clicked
                addButton.addEventListener('click', () => {
                    const commandName = groupNameInput.value.trim();
                    const items = [];
                    draggableList.querySelectorAll('li').forEach((item) => {
                        const command = item.getAttribute('data-command');
                        if (command) {
                            items.push(command);
                        }
                    });
                    vscode.postMessage({
                        type: 'addCommand',
                        commandName: commandName,
                        items: items,
                    });
                });            
                var isEditMode = false;
                const vscode = acquireVsCodeApi();
                function toggleEditMode() {
                    isEditMode = !isEditMode;
                }    
                editButton.addEventListener('click', () => {
                    editButton.textContent = isEditMode ? 'Done' : 'Edit';
                    table.classList.toggle('edit-mode', isEditMode);
                    if(${addingGroup} == false){
                        vscode.postMessage({
                            type: 'refresh'
                        });
                    }
                    if (isEditMode) {
                        container.classList.remove('hidden');
                    } else {
                        container.classList.add('hidden');
                    }
                    document.querySelectorAll('.delete-column').forEach((col) => {
                        col.innerHTML = isEditMode
                            ? '<button class="delete-btn">x</button>'
                            : '';
                        col.classList.toggle('hidden', !isEditMode);
                    });
                    document.querySelectorAll('.empty-column').forEach((col) => {
                        col.classList.toggle('hidden', !isEditMode);
                    });
                    document.querySelectorAll('.group-name').forEach((span) => {
                        span.style.display = isEditMode ? 'none' : 'inline';
                    });

                    document.querySelectorAll('.rename-input').forEach((input) => {
                        input.style.display = isEditMode ? 'inline' : 'none';
                    });

                    if (!isEditMode) {
                        // Remove all validation messages when exiting edit mode
                        document.querySelectorAll('.validation-message').forEach((message) => {
                            message.remove(); // Completely remove from DOM
                        });
                    }
                });

                table.addEventListener('input', (event) => {
                    if (event.target.classList.contains('rename-input')) {
                        const input = event.target;
                        const row = input.closest('tr');
                        const index = row.getAttribute('data-index');
                        const newName = input.value.trim();

                        // Check if validation message exists
                        let validationMessage = row.querySelector('.validation-message');
                        if (!validationMessage) {
                            validationMessage = document.createElement('div');
                            validationMessage.className = 'validation-message';
                            validationMessage.style.color = 'red';
                            validationMessage.style.fontSize = '12px';
                            row.querySelector('td:nth-child(2)').appendChild(validationMessage);
                        }

                        // Validate the name
                        if (!validateGroupName(newName)) {
                            validationMessage.textContent = 'Invalid group name. Only letters, numbers, spaces are allowed.';
                        } else {
                            // Send a message to save the valid new name
                            vscode.postMessage({
                                type: 'updateGroupName',
                                index: parseInt(index, 10), // Convert index to number
                                newName: newName, // Pass the new valid name
                            });
                            validationMessage.textContent = ''; // Clear the message if valid
                            //commandGroups[index].name = newName; // Update name if valid
                        }
                    }
                });

                table.addEventListener('blur', (event) => {
                    if (event.target.classList.contains('rename-input')) {
                        const input = event.target;
                        const row = input.closest('tr');
                        const validationMessage = row.querySelector('.validation-message');
                        // Remove validation message if input is valid
                        if (validationMessage && validateGroupName(input.value.trim())) {
                            validationMessage.textContent = '';
                        }
                    }
                }, true);

                table.addEventListener('click', (event) => {
                    const target = event.target;
                    // Handle row delete
                    if (target.classList.contains('delete-btn')) {
                        const row = target.closest('tr');
                        const index = row.getAttribute('data-index');
                        vscode.postMessage({
                            type: 'deleteCommandGroup',
                            rowIndex: parseInt(index, 10)
                        });
                        row.remove();
                    }

                    // Handle item delete in list
                    if (target.classList.contains('item-delete-btn')) {
                        const row = target.closest('tr');
                        const rowIndex = row.getAttribute('data-index');
                        const itemIndex = target.getAttribute('data-item-index');
                        // Get the updated list of commands
                        const currentCommands = Array.from(row.querySelectorAll('li')).map((li) =>
                            li.childNodes[0].textContent.trim()
                        );
                        if(currentCommands.length == 2){
                            vscode.postMessage({
                                type: 'minimumReached',
                            });
                            return;
                        }
                        // Remove the item from the DOM
                        const listItem = target.closest('li');
                        listItem.remove();

                        // Get the updated list of commands
                        const updatedCommands = Array.from(row.querySelectorAll('li')).map((li) =>
                            li.childNodes[0].textContent.trim()
                        );

                        // Send the updated list to TypeScript
                        vscode.postMessage({
                            type: 'updateCommandGroupItems',
                            rowIndex: parseInt(rowIndex, 10),
                            updatedCommands: updatedCommands,
                        });
                    }
                });
                // used to inform user multi-step commands need to be last
                var sentMessage = false;
                document.querySelectorAll('.draggable-list').forEach((list) => {
                    list.addEventListener('dragstart', (event) => {
                        event.target.classList.add('dragging');
                    });
                    list.addEventListener('dragend', (event) => {
                        event.target.classList.remove('dragging');
                        const rowIndex = event.target.closest('tr').getAttribute('data-index');
                        sentMessage = false;
                        // Ensure "..." item is at the end
                        const items = Array.from(list.children);
                        const lastItem = items[items.length - 1];
                        const containsEllipsis = (item) => item.textContent.includes("...");
                        const invalidItems = items.slice(0, -1).filter(containsEllipsis);

                        // Move invalid "..." items to the end
                        if (invalidItems.length > 0) {
                            invalidItems.forEach((item) => {
                                list.appendChild(item); // Append to the end
                            });
                        }

                        const reorderedCommands = Array.from(list.children).map((li) => {
                            const commandText = li.firstChild.textContent.trim(); // Get only the first text node
                            return commandText;
                        });

                        vscode.postMessage({
                            type: 'updateCommandOrder',
                            rowIndex: parseInt(rowIndex, 10),
                            commands: reorderedCommands,
                        });
                    });

                    list.addEventListener('dragover', (event) => {
                        event.preventDefault();
                        const afterElement = getDragAfterElement(list, event.clientY);
                        const draggingElement = document.querySelector('.dragging');

                        // Ensure multi-step command is not moved to a position other than the end
                        if (draggingElement.textContent.includes("...")) {
                            const isLast = draggingElement === list.lastElementChild;
                            if (!isLast) {
                                // Trigger a message to TypeScript immediately
                                const rowIndex = draggingElement.closest('tr').getAttribute('data-index');
                                const reorderedCommands = Array.from(list.children).map((li) => {
                                    const commandText = li.firstChild.textContent.trim();
                                    return commandText;
                                });
                                if(!sentMessage){
                                    vscode.postMessage({
                                        type: 'updateCommandOrder',
                                        rowIndex: parseInt(rowIndex, 10),
                                        commands: reorderedCommands,
                                    });
                                }
                                
                                sentMessage = true;
                                // Prevent moving the luti-step command item from the last position
                                return;
                            }
                        }

                        if (afterElement == null) {
                            list.appendChild(draggingElement);
                        } else {
                            list.insertBefore(draggingElement, afterElement);
                        }
                    });
                });
                
                function getDragAfterElement(container, y) {
                    const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];

                    return draggableElements.reduce((closest, child) => {
                        const box = child.getBoundingClientRect();
                        const offset = y - box.top - box.height / 2;
                        if (offset < 0 && offset > closest.offset) {
                            return { offset, element: child };
                        } else {
                            return closest;
                        }
                    }, { offset: Number.NEGATIVE_INFINITY }).element;
                }

                function validateGroupName(name) {
                    const regularExpression = /^[a-zA-Z\\s]+$/;
                    if (!regularExpression.test(name)) {
                        return false;
                    }

                    const commands = JSON.parse(${JSON.stringify(commandsJson)});
                    const cleanedName = name.replace(/[^a-zA-Z]/g, '').toLowerCase();
                    for (const command of commands) {
                        const cleanedCommand = command.replace(/[^a-zA-Z]/g, '').toLowerCase();
                        if (cleanedCommand === cleanedName) {
                            return false;
                        }
                    }

                    const parsedData = ${JSON.stringify(parsedData)};
                    for (const aliasKey in parsedData.aliases) {
                        const cleanedAlias = aliasKey.replace(/[^a-zA-Z]/g, '').toLowerCase();
                        if (cleanedAlias === cleanedName) {
                            return false;
                        }
                    }
                    return true;
                }
                if (${addingGroup}) {
                    editButton.click();
                }
            </script>


        </body>
        </html>
    `;
    return htmlContent;
}
