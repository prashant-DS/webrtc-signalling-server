import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
  transports: ["websocket"],
});
httpServer.listen(8080, () => {
  console.log("listening on 8080");
});

io.on("connection", async (socket) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    socket.emit(SOCKET_SEND_EVENTS.INVALID_TOKEN);
    socket.disconnect(true);
    return;
  }
  socket.token = token;
  socket.join(token);
  const clientsInRoom = await io.in(token).fetchSockets();
  if (clientsInRoom.length === 1) {
    socket.emit(SOCKET_SEND_EVENTS.EMPTY_ROOM);
  } else {
    socket.emit(SOCKET_SEND_EVENTS.REQUEST_OFFER, {
      existingClients: clientsInRoom
        .map((s) => s.id)
        .filter((sid) => sid !== socket.id),
    });
  }

  socket.on(SOCKET_RECEIVE_EVENTS.WEBRTC_OFFER, ({ remoteClient, offer }) => {
    io.to(remoteClient).emit(SOCKET_SEND_EVENTS.REQUEST_ANSWER, {
      initiatingClient: socket.id,
      offer,
    });
  });
  socket.on(
    SOCKET_RECEIVE_EVENTS.WEBRTC_ANSWER,
    ({ initiatingClient, answer }) => {
      io.to(initiatingClient).emit(SOCKET_SEND_EVENTS.ANSWER_OF_OFFER, {
        remoteClient: socket.id,
        answer,
      });
    }
  );
});

const SOCKET_SEND_EVENTS = {
  INVALID_TOKEN: "INVALID_TOKEN",
  EMPTY_ROOM: "EMPTY_ROOM",
  REQUEST_OFFER: "REQUEST_OFFER",
  REQUEST_ANSWER: "REQUEST_ANSWER",
  ANSWER_OF_OFFER: "ANSWER_OF_OFFER",
};

const SOCKET_RECEIVE_EVENTS = {
  WEBRTC_OFFER: "WEBRTC_OFFER",
  WEBRTC_ANSWER: "WEBRTC_ANSWER",
};
