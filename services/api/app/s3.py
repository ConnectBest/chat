import boto3, os, uuid
S3 = boto3.client("s3",
    endpoint_url=os.getenv("S3_ENDPOINT"),
    aws_access_key_id=os.getenv("MINIO_ROOT_USER"),
    aws_secret_access_key=os.getenv("MINIO_ROOT_PASSWORD"),
    region_name=os.getenv("S3_REGION","us-east-1"))
BUCKET = os.getenv("S3_BUCKET","chat-files")
PUBLIC_BASE = os.getenv("S3_PUBLIC_BASE","http://localhost:9000/chat-files")
def new_object_key(filename: str) -> str:
    ext = filename.split(".")[-1] if "." in filename else "bin"
    return f"uploads/{uuid.uuid4()}.{ext}"
def presign_put(filename: str, mime: str):
    key = new_object_key(filename)
    url = S3.generate_presigned_url("put_object",
        Params={"Bucket": BUCKET, "Key": key, "ContentType": mime},
        ExpiresIn=3600)
    return {"uploadUrl": url, "fileId": key, "publicUrl": f"{PUBLIC_BASE}/{key}"}
