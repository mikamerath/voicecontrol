export interface StringDictionary {
    [key: string]: string;
}

//If you need to add something new to this dictionary; please do so in the other supported frontend language dictionaries located at src/frontend-text-mapping-{mylanguage}.ts
export let frontendTextLookup: StringDictionary = {
    waitingForActivationWord: 'Voice Control : Waiting for activation word.',
    startingUp: 'Voice Control : Starting up...',
    listeningForCommand: 'Voice Control : Listening for voice command...',
    muted: 'Voice Control : Muted',
    sayActivationWordThenCommand: 'Say activation word, then the command to rename.',
    sayActivationWordThenAlias: 'Say activation word, then the alias for the command.',
    successfullyRenamedCommandTo: 'Successfully renamed command to ',
    couldNotFindCommand: 'Could not find command : ',
    renamingFailed: ' renaming failed.', //The space at the beginning matters here
    isMuted: 'Muted.',
    isUnmuted: 'Unmuted.',
    isNotAValidTheme: ' <-- this is not a valid theme.',
};
