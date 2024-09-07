"""Text to Phrase Processing"""

"""Uses the phrases.txt file for available phrases (just a subset at the moment) right now. FindSimilarPhrases takes in the 
text produced from the speech to text part of the server and will either produce a list containing one phrase (if the text is an exact match) 
or a list of suggested phrases for text that is ambiguous and does not match a phrase. Uses the nltk library for natural language processing techniques."""

# Import the Natural Language Processing Library. 
import string
import nltk
from nltk.tokenize import word_tokenize

import commands

isMultiStep = False

"""This helper method takes the text (text produced from the speech to text model)
and processes it to get rid of extra characters like punctuation."""
def __preprocessText(text):
    # Break the text down into words.
    words = word_tokenize(text.lower())
    mainWords = []
    for word in words:
        # Checks if the word is alphanumeric.
        if(word.isalnum()):
            mainWords.append(word)
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
    if '...' in text or 'Preferences: Color Theme' in text:
        isMultiStep = True
    else:
        isMultiStep = False

"""Uses the file of available phrases (that are mapped to various VSCode commands) and 
finds the phrases that are the most similar to the text. Uses pre-processing and jaccard methods.
Returns a list of similar phrases."""
def findSimilarPhrases(text):
    # Limit on number of suggested commands...will be taken from configuration settings later on. 
    # For now, hardcoded to 3. This limit cannot be greater than the amount of commands in the file.
    commandLimit = 2
    commandCount = 0

    # List of available phrases that are similar to the text.
    similarPhrases = [] # use this for ambiguous text for suggestions 
    similarPhrase = [] # use this if text matches phrase 
    finalCommands = [] # final list of commands

    global isMultiStep
    global multiStepCommand
    
    if(isMultiStep):
        text = text.lstrip()
        text = text.translate(str.maketrans('','',string.punctuation))
        finalCommands.append(text)
        isMultiStep = False
        return finalCommands
    # Find all similar phrases to the text. 
    processedText = set(__preprocessText(text))
    for phrase in commands.commands:  
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
            return similarPhrase
        else:
            # This ensures that similar commands don't get automatically executed. Has to be superrr close.
            if(similarity >= 0.50):
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

    # Exact command, suggested commands (lower index=most similar), or command not found.
    return finalCommands
