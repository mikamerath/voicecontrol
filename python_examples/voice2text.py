from transformers import pipeline
from transformers.pipelines.audio_utils import ffmpeg_microphone_live
import torch

import text2command
# import asyncio
# import websockets

# async def send_message(command):
#     uri = "ws://localhost:6789"
#     async with websockets.connect(uri) as websocket:
#         await websocket.send(command)
#         response = await websocket.recv()
#         print(f"Received response: {response}")

device = "cuda:0" if torch.cuda.is_available() else "cpu"

classifier = pipeline(
    "audio-classification", model="MIT/ast-finetuned-speech-commands-v2", device=device
)
transcriber = pipeline(
    "automatic-speech-recognition", model="openai/whisper-base", device=device
)

# Uncomment this line to see all of the possible wake words
# print(classifier.model.config.id2label)

"""
Transcribe listens for chunk_length_s time and returns a prediction
for what was said within that time.
"""
def transcribe(chunk_length_s=5.0, stream_chunk_s=1.0):
    sampling_rate = transcriber.feature_extractor.sampling_rate

    mic = ffmpeg_microphone_live(
        sampling_rate=sampling_rate,
        chunk_length_s=chunk_length_s,
        stream_chunk_s=stream_chunk_s,
    )

    print("Start speaking...")
    for item in transcriber(mic, generate_kwargs={"max_new_tokens": 128}):
        # Uncomment to see the prediction as it happens
        # sys.stdout.write("\033[K")
        # print(item["text"], end="\r")
        if not item["partial"][0]:
            break

    return item["text"]
command = []
"""
On startup, listens for the wake word to be spoken (in this case, "go").
After the wake word has been heard, calls transcribe convert the next things
somebody says into text 
"""
def listen_for_wake_word(
    wake_word="go",
    prob_threshold=0.8,
    chunk_length_s=0.50,
    stream_chunk_s=0.25,
    debug=False,
):

    sampling_rate = classifier.feature_extractor.sampling_rate

    mic = ffmpeg_microphone_live(
        sampling_rate=sampling_rate,
        chunk_length_s=chunk_length_s,
        stream_chunk_s=stream_chunk_s,
    )
    
    print("Listening for wake word...")
    for prediction in classifier(mic):
        prediction = prediction[0]
        if debug:
            print(prediction)
        if prediction["label"] == wake_word:
            if prediction["score"] > prob_threshold:
                result = transcribe(chunk_length_s=3.0)
                print("You said: " + result)
                command = text2command.findSimilarPhrases(result)
                # This is where we'll need to message VS Code what the command is
                print(str(command))
                asyncio.run(send_message(command))
                prediction["label"] = ""
                
#asyncio.run(send_message(command))            
listen_for_wake_word()