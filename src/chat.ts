import { Response } from "express";
import Redis from "ioredis";

const SIZE = 50;
const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");

class Chat {
  public listeners: Response[] = [];

  private send(res: Response, id: number, data: string) {
    try {
      res.write(`id: ${id}\ndata: ${data}\n\n`);
    } catch (err) {
      console.error(err);
    }
  }

  public broadcast(author: string, color: string, message: string) {
    const id = Date.now();
    const data = JSON.stringify({ author, color, message });

    // Push to each listener.
    this.listeners.forEach((listener) => {
      this.send(listener, id, data);
    });

    // Push to preserve in Redis.
    redis
      .multi()
      .lpush("history", data)
      .ltrim("history", 0, SIZE - 1)
      .exec();
  }

  private async replay(res: Response) {
    const history: string[] = await redis.lrange("history", 0, SIZE - 1);
    if (history && history.length > 0) {
      for (let i = history.length; i >= 0; i--) {
        this.send(res, i, history[i]);
      }
    }
  }

  public subscribe(res: Response, author: string) {
    this.listeners.push(res);

    // Replay the history for this client.
    this.replay(res).then(() => {
      chat.broadcast("system", "#a0aec0", `${author} has joined the chat`);
    });

    res.on("close", () => {
      // Remove the closed response from the handler.
      const index = this.listeners.indexOf(res);
      this.listeners.splice(index, 1);

      chat.broadcast("system", "#a0aec0", `${author} has left the chat`);

      // Terminate the connection.
      res.end();
    });
  }
}

// Global chat instance.
const chat = new Chat();

export default chat;
