import pika, os, json
def send_encode_job(file_key: str):
    params = pika.URLParameters(f"amqp://{os.getenv('RABBITMQ_DEFAULT_USER')}:{os.getenv('RABBITMQ_DEFAULT_PASS')}@rabbitmq:5672/")
    conn = pika.BlockingConnection(params)
    ch = conn.channel()
    ch.queue_declare(queue="encode")
    ch.basic_publish("", "encode", json.dumps({"fileKey": file_key}))
    conn.close()
