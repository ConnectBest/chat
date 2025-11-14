import time
def transcode(file_key: str):
    time.sleep(2)
    return {"thumbnails": [file_key + ".jpg"], "variants": [file_key + ".mp4"]}
