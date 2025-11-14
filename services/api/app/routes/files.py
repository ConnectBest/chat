from fastapi import APIRouter
from pydantic import BaseModel
from ..s3 import presign_put
from ..queue import send_encode_job
router = APIRouter()
class PresignReq(BaseModel):
    filename: str
    mime: str
@router.post("/presign")
def presign(req: PresignReq):
    data = presign_put(req.filename, req.mime)
    send_encode_job(data["fileId"])
    return data
class PatchBody(BaseModel):
    status: str
@router.patch("/{file_id}")
def update_file(file_id: str, body: PatchBody):
    return {"fileId": file_id, "status": body.status}
