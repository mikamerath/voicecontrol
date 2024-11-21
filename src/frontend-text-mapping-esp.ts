export interface StringDictionary {
    [key: string]: string;
}

export let frontendTextLookupEsp: StringDictionary = {
    waitingForActivationWord: 'Voice Control : Esperando la palabra de activación.',
    startingUp: 'Voice Control : Puesta en marcha...',
    listeningForCommand: 'Voice Control : Escuchar comandos de voz...',
    muted: 'Voice Control : Silenciado',

    sayActivationWordThenCommand: 'Diga la palabra de activación, luego el comando para cambiar el nombre.',
    sayActivationWordThenAlias: 'Diga la palabra de activación y, a continuación, el alias del comando.',
    successfullyRenamedCommandTo: 'Se ha cambiado correctamente el nombre del comando a',
    couldNotFindCommand: 'No se pudo encontrar el comando : ',
    renamingFailed: ' Error en el cambio de nombre.', //The space at the beginning matters here
    isMuted: 'Silenciado.',
    isUnmuted: 'Sin silenciar.',
    isNotAValidTheme: ' <-- Este no es un tema válido.',
};
