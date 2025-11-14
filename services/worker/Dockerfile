FROM python:3.11-slim
WORKDIR /app
COPY worker/requirements.txt .
RUN pip install -r requirements.txt
COPY worker ./worker
CMD ["python","-m","worker.main"]
