import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, Db, ObjectId } from "mongodb";

describe("Message Operations (MongoDB)", () => {
  let mongoServer: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    // 啟動 in-memory MongoDB（不會碰到你真正的 Mongo Atlas）
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    client = await MongoClient.connect(uri);
    db = client.db("test-db");
  });

  afterAll(async () => {
    await client.close();
    await mongoServer.stop();
  });

  test("should create and read a message document", async () => {
    const messages = db.collection("messages");

    const doc = {
      channelId: new ObjectId(),
      userId: new ObjectId(),
      content: "Test message for unit test",
      isDeleted: false,
      createdAt: new Date(),
    };

    const insertResult = await messages.insertOne(doc);
    expect(insertResult.insertedId).toBeDefined();

    const found = await messages.findOne({ _id: insertResult.insertedId });
    expect(found).not.toBeNull();
    expect(found?.content).toBe("Test message for unit test");
  });

  test("should query messages by channelId with sort & limit", async () => {
    const messages = db.collection("messages");
    const channelId = new ObjectId();

    // 插入 3 筆不同時間的訊息
    const now = Date.now();
    await messages.insertMany([
      {
        channelId,
        userId: new ObjectId(),
        content: "msg-1",
        createdAt: new Date(now - 3000),
      },
      {
        channelId,
        userId: new ObjectId(),
        content: "msg-2",
        createdAt: new Date(now - 2000),
      },
      {
        channelId,
        userId: new ObjectId(),
        content: "msg-3",
        createdAt: new Date(now - 1000),
      },
    ]);

    const docs = await messages
      .find({ channelId })
      .sort({ createdAt: -1 })
      .limit(2)
      .toArray();

    // 應該只拿到兩筆，且是最新的兩筆
    expect(docs).toHaveLength(2);
    expect(docs[0].content).toBe("msg-3");
    expect(docs[1].content).toBe("msg-2");
  });
});