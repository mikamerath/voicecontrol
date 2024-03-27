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
from nltk.corpus import stopwords 
from nltk.stem import WordNetLemmatizer


"""This helper method takes the text (text produced from the speech to text model)
and processes it using NLP techniques to produce a list of its main words."""
def __preprocessText(text):
    # Break the text down into words.
    words = word_tokenize(text.lower())
    # Remove all the common words.
    commonWords = set(stopwords.words("english"))
    # Remove common words that help distinguish commands for more model customization (need to find better way to do this).
    commonWords.remove("up")
    commonWords.remove("down")
    commonWords.remove("above")
    commonWords.remove("below")
    mainWords = []
    for word in words:
        # Checks if the word is alphanumeric and is not a common word.
        if(word.isalnum() and word not in commonWords):
            mainWords.append(word)
    # Reduce different forms of word to one single form.
    lemmatizer = WordNetLemmatizer()
    finalWords = []
    for word in mainWords:
        finalWords.append(lemmatizer.lemmatize(word))
    return finalWords

"""Helper method that uses the jaccard similarity algorithm to find how similar two sets of 
words are. Returns a score between 0.0 (not similar) and 1.0(the same sets of words)."""
# A similarity near 1 indicates the two sets of words are very similar.
def __jaccardSimilarity(wordSet1, wordSet2):
    intersection = len(wordSet1.intersection(wordSet2))
    union = len(wordSet1.union(wordSet2))
    return intersection / union 

"""Uses the file of available phrases (that are mapped to various VSCode commands) and 
finds the phrases that are the most similar to the text. Uses pre-processing and jaccard methods.
Returns a list of similar phrases."""
def findSimilarPhrases(text):
    # Limit on number of suggested commands...will be taken from configuration settings later on. 
    # For now, hardcoded to 3. 
    commandLimit = 3

    # List of available phrases that are similar to the text.
    similarPhrases = [] # use this for ambiguous text for suggestions 
    similarPhrase = [] # use this if text matches phrase 

    # Get the current available phrases that are mapped to commands (dummy data in the file for now). 
    file = open("./python_examples/commands.txt", "r")
    phrases = file.readlines()
    file.close()    

    # Find all similar phrases to the text. 
    processedText = set(__preprocessText(text))
    for phrase in phrases:
        processedPhrase = set(__preprocessText(phrase))
        similarity = __jaccardSimilarity(processedText, processedPhrase)
        # If the text matches a phrase exactly, return just that phrase. 
        if(similarity == 1.0):
            # Remove the newline from the phrase.
            similarPhrase.append(phrase.split("\n")[0])
            print(similarPhrase)
            return similarPhrase
        # No exact phrases were found, so suggest some options.
        elif(similarity >= 0.50):
            if commandLimit !=0:
                similarPhrases.append(phrase.split("\n")[0])
                commandLimit-=1
    print(similarPhrases)
    return similarPhrases

# Testing 
findSimilarPhrases("Terminal: Create New Terminal") # exact command so should return one command
findSimilarPhrases("resize terminal") # should return suggestions
findSimilarPhrases("Add cursor above") # exact command so should return one command
findSimilarPhrases("Delete line") # exact command so should return one command
findSimilarPhrases("add cursor") # should return suggestions 
