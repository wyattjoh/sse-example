import express from "express";
import path from "path";

const app = express();

// Respond with SSE.
app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
  });

  setInterval(() => {
    res.write(`id: ${Date.now()}\ndata: ${new Date().toISOString()}\n\n`);
  }, 1000);
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
