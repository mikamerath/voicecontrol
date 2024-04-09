"""Text to Phrase Processing"""

"""Uses the phrases.txt file for available phrases (just a subset at the moment) right now. FindSimilarPhrases takes in the 
text produced from the speech to text part of the server and will either produce a list containing one phrase (if the text is an exact match) 
or a list of suggested phrases for text that is ambiguous and does not match a phrase. Uses the nltk library for natural language processing techniques."""

"""The stopwords used for preprocessing the text and phrases does need to be customized in order to not remove words that are needed 
to distinguish between certain commands. This model will also need to be edited as more phrases are added. This is a simple rough 
draft to hopefully use for the prototype/expand upon in the final project. """

# Import the Natural Language Processing Library. 
import nltk
from nltk.tokenize import word_tokenize

import commands


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
words are. Returns a score between 0.0 (not similar) and 1.0(the same sets of words)."""
# A similarity near 1 indicates the two sets of words are very similar.
def __jaccardSimilarity(wordSet1, wordSet2):
    intersection = len(wordSet1.intersection(wordSet2))
    union = len(wordSet1.union(wordSet2))
    return intersection / union 

"""Similar to the method above but for one word commands"""
def __jaccardSimilarityOneWord(str1: str, str2: str) -> float:
    # Convert the strings to sets of characters
    set1, set2 = set(str1), set(str2)
    str1_first = next(iter(set1))
    str2_first = next(iter(set2))
    set3 = set(str1_first)
    set4 = set(str2_first)
    # Calculate intersection and union
    intersection = set3.intersection(set4)
    union = set3.union(set4)
    # Calculate and return Jaccard similarity
    return len(intersection) / len(union)

"""Uses the file of available phrases (that are mapped to various VSCode commands) and 
finds the phrases that are the most similar to the text. Uses pre-processing and jaccard methods.
Returns a list of similar phrases."""
def findSimilarPhrases(text):
    # Limit on number of suggested commands...will be taken from configuration settings later on. 
    # For now, hardcoded to 3. This limit cannot be greater than the amount of commands in the file.
    commandLimit = 3
    commandCount = 0

    # List of available phrases that are similar to the text.
    similarPhrases = [] # use this for ambiguous text for suggestions 
    similarPhrase = [] # use this if text matches phrase 

    # Get the current available phrases that are mapped to commands (dummy data in the file for now).    

    # Find all similar phrases to the text. 
    processedText = set(__preprocessText(text))
    # Check for unideal speech outputs.
    if(len(processedText) == 1):
        if "redu" in processedText:
            processedText.add("redo")
            processedText.remove("redu")
    for phrase in commands.commands:
        processedPhrase = set(__preprocessText(phrase))
        if(len(processedText) == 1):
            similarity = __jaccardSimilarityOneWord(processedText, processedPhrase)
        else:
            similarity = __jaccardSimilarity(processedText, processedPhrase)
        # If the text matches a phrase exactly, return just that phrase. 
        if(similarity == 1.0):
            # Remove the newline from the phrase.
            similarPhrase.append(phrase.split("\n")[0])
            return similarPhrase
        # No exact phrases were found, so suggest some options.
        else:
            similarPhrases.append((similarity, phrase.split("\n")[0]))
            commandCount+=1
    # Find the most similar phrases based on the command limit. 
    similarPhrases.sort() # Phrases are sorted in ascending order (most similar in higher indices).
    finalCommands = []
    # Return the number of suggested command equals to the command limit, only if there are enough commands in the file.
    if(commandLimit <= commandCount):
        for phrase in similarPhrases[-commandLimit:]:
            finalCommands.append(phrase[1]) # Extract the command from the tuple.

    return finalCommands