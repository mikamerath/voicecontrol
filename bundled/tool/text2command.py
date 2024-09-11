"""Text to Phrase Processing"""

"""Uses the phrases.txt file for available phrases (just a subset at the moment) right now. FindSimilarPhrases takes in the 
text produced from the speech to text part of the server and will either produce a list containing one phrase (if the text is an exact match) 
or a list of suggested phrases for text that is ambiguous and does not match a phrase. Uses the nltk library for natural language processing techniques."""

# Import the Natural Language Processing Library.
import string
import nltk
from nltk.tokenize import word_tokenize

import commands
import json
import os
import string

isMultiStep = False
isRenamingCommand = False
renamingInputs = []

"""This helper method takes the text (text produced from the speech to text model)
and processes it to get rid of extra characters like punctuation."""


def __preprocessText(text):
    # Break the text down into words.
    words = word_tokenize(text.lower())
    mainWords = []
    for word in words:
        # Checks if the word is alphanumeric.
        if word.isalnum():
            mainWords.append(word)
        if word.__contains__("/"):
            splitWords = word.split("/")
            for splitWord in splitWords:
                if splitWord.isalnum():
                    mainWords.append(splitWord)
        if word.__contains__("..."):
            splitWords = word.split("...")
            for splitWord in splitWords:
                if splitWord.isalnum():
                    mainWords.append(splitWord)
    return mainWords


"""Helper method that uses the jaccard similarity algorithm to find how similar two sets of 
words or two sets of characters (for one word comparisons) are. Returns a score between 0.0 (not similar) 
and 1.0(the same sets of words)."""


# A similarity near 1 indicates the two sets of words are very similar.
def __jaccardSimilarity(wordSet1, wordSet2):
    intersection = len(wordSet1.intersection(wordSet2))
    union = len(wordSet1.union(wordSet2))
    return intersection / union


"""Helper method that checks if text contains a multi-step command."""


# A similarity near 1 indicates the two sets of words are very similar.
def __setMultiStep(text):
    global isMultiStep
    if "..." in text or "Preferences: Color Theme" in text:
        isMultiStep = True
    else:
        isMultiStep = False


def __searchForAlias(text):
    extension_path = os.path.dirname(__file__)  # This assumes the script is in the `src` directory
    path = os.path.join(extension_path, 'renaming.json')
    with open(path, 'r') as renaming_file:
        data = json.load(renaming_file)
    aliases = data.get('aliases', {})
    translator = str.maketrans('', '', string.punctuation)
    cleaned_text = text.translate(translator).lower().strip().title()
    if cleaned_text in aliases:
        command = aliases[cleaned_text]
        return command
    else:
        return ""


def renameCommand(finalCommands, commands_to_use: string):
    command = finalCommands[1]
    processedText = set(__preprocessText(command))
    alias = finalCommands[2].title()
     # Find the command if it exists.
    similar_commands = searchForCommands(processedText, commands_to_use)
    command = ""
    if len(similar_commands) and similar_commands[0] != "Command not found":
        command = similar_commands[0]
        # Add alias to file
        extension_path = os.path.dirname(__file__)  # This assumes the script is in the `src` directory
        path = os.path.join(extension_path, 'renaming.json')
        with open(path, 'r') as renaming_file:
            data = json.load(renaming_file)

        old_alias = ""
        if command in data['commands']:
            old_alias = data['commands'][command]
        data['commands'][command] = alias
        data['aliases'][alias] = command
        if old_alias in data['aliases']:
            del data['aliases'][old_alias] 
        with open(path, 'w') as file:
            json.dump(data, file, indent=4)
        return [command, alias]
    else:
        return ["Command not found", finalCommands[1]]

def searchForCommands(processedText: set, commands_to_use: list):
    global renamingInputs
    global isMultiStep
    global multiStepCommand
    global isRenamingCommand
    finalCommands = []
    similarPhrases = [] # use this for ambiguous text for suggestions
    similarPhrase = [] # use this if text matches phrase
    # Limit on number of suggested commands...will be taken from configuration settings later on.
    # For now, hardcoded to 2. This limit cannot be greater than the amount of commands in the file.
    commandLimit = 2
    commandCount = 0
    # Normal command process
    for phrase in commands_to_use:
        processedPhrase = set(__preprocessText(phrase))
        if(len(processedText) == 1 and len(processedPhrase) == 1):
            processedTextChars = set(list(processedText)[0])
            processedPhraseChars = set(list(processedPhrase)[0])
            similarity = __jaccardSimilarity(processedTextChars, processedPhraseChars)
        else:
            similarity = __jaccardSimilarity(processedText, processedPhrase)
        if(similarity == 1.0):
            similarPhrase.append(phrase.split("\n")[0])
            __setMultiStep(phrase.split("\n")[0])
            if(similarPhrase[0] == "Rename Command..."): 
                isRenamingCommand = True
            return similarPhrase
        else:
            # This ensures that similar commands don't get automatically executed. Has to be superrr close.
            if(similarity >= 0.80):
                similarPhrases.append((similarity, phrase.split("\n")[0]))
                __setMultiStep(phrase.split("\n")[0])
                commandCount+=1
    similarPhrases.sort() # Phrases are sorted in ascending order (most similar in higher indices).
    print(similarPhrases)
    if(commandLimit <= commandCount):
        __setMultiStep(phrase.split("\n")[0])
        for phrase in similarPhrases[:-commandLimit-1:-1]:
            finalCommands.append(phrase[1]) # Most similar in lower index.
    elif commandCount > 0:
        for phrase in similarPhrases[::-1]:
            finalCommands.append(phrase[1]) # Most similar in lower index.
    else:
        finalCommands.append("Command not found")

    # Check if this is a renaming command
    if(finalCommands.__len__() > 0 and (finalCommands[0] == "Rename Command..." or finalCommands[0] == "Rinomina Comando...")):
        isRenamingCommand = True

    # Exact command, suggested commands (lower index=most similar), or command not found.
    return finalCommands


"""Uses the file of available phrases (that are mapped to various VSCode commands) and 
finds the phrases that are the most similar to the text. Uses pre-processing and jaccard methods.
Returns a list of similar phrases."""


def findSimilarPhrases(text, locale):
    finalCommands = [] # final list of commands
    global renamingInputs
    global isMultiStep
    global isRenamingCommand

    locale_to_commands = {
        "en": commands.commands,
        "it": commands.commands_italian,
    }
    commands_to_use = locale_to_commands[locale]

    if isMultiStep:
        # Check to see if this is input for renaming.
        if(isRenamingCommand):
            text = text.lstrip()
            text = text.translate(str.maketrans('','',string.punctuation))
            renamingInputs.append(text)
            if(renamingInputs.__len__() == 1):
                finalCommands.append("Rename Command: show chosen command")
                isMultiStep = True
            else:
                finalCommands.append("Renaming Command: Final")
                finalCommands.append(renamingInputs[0])
                finalCommands.append(text)
                isMultiStep = False
                isRenamingCommand = False
                commandAndAlias = renameCommand(finalCommands, commands_to_use)
                if commandAndAlias[0] == "Command not found":
                    finalCommands[0] = "Command not renamed"
                    finalCommands[1] = commandAndAlias[1]
                else:
                    finalCommands[1] = commandAndAlias[0]
                    finalCommands[2] = commandAndAlias[1]
                renamingInputs.clear()
            return finalCommands
        text = text.lstrip()
        text = text.translate(str.maketrans("", "", string.punctuation))
        finalCommands.append(text)
        isMultiStep = False
        return finalCommands
    # Find all similar phrases to the text.
    processedText = set(__preprocessText(text))
    # Check for an alias match first.
    command_from_alias = __searchForAlias(text)
    if command_from_alias:
        finalCommands.append(command_from_alias)
    else:
        finalCommands = searchForCommands(processedText, commands_to_use)
    if finalCommands[0] == 'Command not found':
        finalCommands.append(text)

    # Exact command, suggested commands (lower index=most similar), or command not found.
    return finalCommands
