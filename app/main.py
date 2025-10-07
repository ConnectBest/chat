from flask import Flask

app = Flask(__name__)

@app.get("/")
def root():
    return "Hello from ConnectBest 👋\n"

if __name__ == "__main__":
    # Bind to 0.0.0.0 for Docker, default port 8080
    app.run(host="0.0.0.0", port=8080)
