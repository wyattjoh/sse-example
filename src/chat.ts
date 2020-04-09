import { Response } from "express";
import Redis from "ioredis";
import { v4 as uuid } from "uuid";

enum CHANNELS {
  HISTORY = "chat:history",
  LIVE = "chat:live",
}

const SIZE = 50;
const URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

type Listener = Response;

interface Client {
  author: string;
  listener: Listener;
}

class Chat {
  private readonly clients: Client[] = [];
  private readonly subscription = new Redis(URL);
  private readonly redis = new Redis(URL);
  private readonly clientID = uuid();

  public async connect() {
    await this.subscription.subscribe(CHANNELS.LIVE);

    this.subscription.on("message", (channel, message) => {
      if (channel !== CHANNELS.LIVE) {
        return;
      }

      const { id, data, clientID } = JSON.parse(message);
      if (clientID === this.clientID) {
        return;
      }

      // Send the message to all.
      this.sendAll(id, data);
    });
  }

  private send(res: Listener, id: number, data: string) {
    try {
      res.write(`id: ${id}\ndata: ${data}\n\n`);
    } catch (err) {
      console.error(err);
    }
  }

  private sendAll(id: number, data: string) {
    // Push to each listener.
    this.clients.forEach(({ listener: res }) => {
      this.send(res, id, data);
    });
  }

  public broadcast(author: string, color: string, message: string) {
    const now = Date.now();
    const id = now;
    const data = JSON.stringify({ author, color, message, createdAt: now });

    // Send the message to all.
    this.sendAll(id, data);

    // Push to preserve in Redis.
    this.redis
      .multi()
      .lpush(CHANNELS.HISTORY, JSON.stringify({ id, data }))
      .ltrim(CHANNELS.HISTORY, 0, SIZE - 1)
      .expire(CHANNELS.HISTORY, 5 * 60)
      .exec();

    // Push to Pub/Sub.
    this.redis.publish(
      CHANNELS.LIVE,
      JSON.stringify({ id, data, clientID: this.clientID })
    );
  }

  private async replay(res: Listener) {
    const history: string[] = await this.redis.lrange(
      CHANNELS.HISTORY,
      0,
      SIZE - 1
    );
    if (history && history.length > 0) {
      for (let i = history.length; i >= 0; i--) {
        try {
          if (!history[i]) {
            continue;
          }

          const { id, data } = JSON.parse(history[i]);
          this.send(res, id, data);
        } catch (err) {
          console.error("could not parse history", history[i], err);
        }
      }
    }
  }

  public subscribe(listener: Listener, author: string) {
    this.clients.push({ listener, author });

    // Replay the history for this client.
    this.replay(listener).then(() => {
      chat.broadcast("system", "#a0aec0", `${author} has joined the chat`);
    });

    listener.on("close", () => {
      // Remove the closed response from the handler.
      const index = this.clients.findIndex(
        (client) => client.listener === listener
      );
      this.clients.splice(index, 1);

      chat.broadcast("system", "#a0aec0", `${author} has left the chat`);

      // Terminate the connection.
      listener.end();
    });
  }
}

// Global chat instance.
const chat = new Chat();

export default chat;
