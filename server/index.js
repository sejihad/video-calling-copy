const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(
  cors({
    origin: "*",
  })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomName) => {
    socket.join(roomName);
    console.log(`${socket.id} joined room: ${roomName}`);
    socket.to(roomName).emit("user-joined", socket.id);
  });

  socket.on("call", ({ roomName, offer }) => {
    socket.to(roomName).emit("incoming-call", { from: socket.id, offer });
  });

  socket.on("answer", ({ roomName, answer }) => {
    socket.to(roomName).emit("call-answered", { from: socket.id, answer });
  });

  socket.on("ice-candidate", ({ roomName, candidate }) => {
    socket.to(roomName).emit("ice-candidate", { from: socket.id, candidate });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});
