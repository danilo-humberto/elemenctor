const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".jpeg": "image/jpeg",
};
http
  .createServer((req, res) => {
    let file;
    try {
      file = path.resolve(
        __dirname,
        "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
      );
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (file === __dirname) file = path.join(file, "index.html");
    if (!file.startsWith(__dirname + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
      });
      res.end(data);
    });
  })
  .listen(4173, "127.0.0.1", () =>
    console.log("Elemenctor: http://127.0.0.1:4173"),
  );
