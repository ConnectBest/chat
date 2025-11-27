import os, json, pika
from ffmpeg import transcode
def consume():
    print("worker starting...")
    params = pika.URLParameters(f"amqp://{os.getenv('RABBITMQ_DEFAULT_USER')}:{os.getenv('RABBITMQ_DEFAULT_PASS')}@rabbitmq:5672/")
    conn = pika.BlockingConnection(params)
    print("worker connected to rabbitmq")
    ch = conn.channel()
    ch.queue_declare(queue="encode")
    def handler(chx, method, props, body):
        msg = json.loads(body)
        res = transcode(msg["fileKey"])
        print("encoded", msg["fileKey"], res)
        chx.basic_ack(delivery_tag=method.delivery_tag)
    ch.basic_consume(queue="encode", on_message_callback=handler)
    ch.start_consuming()
if __name__ == "__main__":
    consume()
