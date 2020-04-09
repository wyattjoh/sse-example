import express, { Response } from "express";
import path from "path";

const app = express();

class Chat {
  public listeners: Response[] = [];

  private send<T>(res: Response, id: number, data: T) {
    try {
      res.write(`id: ${id}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.error(err);
    }
  }

  public broadcast(author: string, color: string, message: string) {
    const id = Date.now();
    this.listeners.forEach((listener) => {
      this.send(listener, id, { author, color, message });
    });
  }

  public subscribe(res: Response, author: string) {
    this.listeners.push(res);
    chat.broadcast("system", "#a0aec0", `${author} has joined the chat`);
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

// Respond with SSE.
app.get("/api/messages", (req, res) => {
  // Get the author.
  const author = req.query.author;
  if (!author || typeof author !== "string" || author.length === 0) {
    return res.sendStatus(400);
  }

  res.writeHead(200, {
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
  });

  // Subscribe this response to the chat.
  chat.subscribe(res, author);
});

// Listen for chat events.
app.post("/api/chat", express.json({}), (req, res) => {
  // Grab the message.
  const author = (req.body || {}).author || "";
  const color = (req.body || {}).color || "";
  const message = (req.body || {}).message || "";
  if (
    typeof author === "string" &&
    author.length > 0 &&
    typeof color === "string" &&
    color.length > 0 &&
    typeof message === "string" &&
    message.length > 0
  ) {
    chat.broadcast(author, color, message);
  }

  // Finish the response.
  res.sendStatus(204);
});

// Mount static assets from the public directory.
app.use(express.static(path.join(__dirname, "..", "public")));

// Parse the port to serve at.
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3030;
app.set("port", port);

// Start the server.
app.listen(port, () => {
  console.log(`Now listening on *:${port}`);
});
