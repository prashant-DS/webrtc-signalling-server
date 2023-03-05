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
  console.log("connection request from ", socket.id, " with token = ", token);
  if (!token) {
    console.log("No token received, Disconnecting ", socket.id);
    socket.emit(SOCKET_SEND_EVENTS.INVALID_TOKEN);
    socket.disconnect(true);
    return;
  }
  socket.token = token;
  socket.join(token);
  console.log(socket.id, " : joined room ", token);
  const clientsInRoom = await io.in(token).fetchSockets();
  if (clientsInRoom.length === 1) {
    console.log(socket.id, " : Single socket in room ", token);
    socket.emit(SOCKET_SEND_EVENTS.EMPTY_ROOM);
  } else {
    console.log(socket.id, " : multiple socket in room ", token);
    socket.emit(SOCKET_SEND_EVENTS.REQUEST_OFFER, {
      existingClients: clientsInRoom
        .map((s) => s.id)
        .filter((sid) => sid !== socket.id),
    });
  }

  socket.on(SOCKET_RECEIVE_EVENTS.WEBRTC_OFFER, ({ remoteClient, offer }) => {
    console.log(
      socket.id,
      " in room ",
      socket.token,
      " : Received offer for ",
      remoteClient
    );
    io.to(remoteClient).emit(SOCKET_SEND_EVENTS.REQUEST_ANSWER, {
      initiatingClient: socket.id,
      offer,
    });
  });
  socket.on(
    SOCKET_RECEIVE_EVENTS.WEBRTC_ANSWER,
    ({ initiatingClient, answer }) => {
      console.log(
        socket.id,
        " in room ",
        socket.token,
        " : Received answer for ",
        initiatingClient
      );
      io.to(initiatingClient).emit(SOCKET_SEND_EVENTS.ANSWER_OF_OFFER, {
        remoteClient: socket.id,
        answer,
      });
    }
  );
  socket.on(
    SOCKET_RECEIVE_EVENTS.NEW_ICE_CANDIDATES,
    ({ peerId, iceCandidates }) => {
      console.log(
        socket.id,
        " in room ",
        socket.token,
        " : Received new ice candidates for ",
        peerId
      );
      io.to(peerId).emit(SOCKET_SEND_EVENTS.NEW_ICE_CANDIDATES, {
        peerId: socket.id,
        iceCandidates,
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
  NEW_ICE_CANDIDATES: "NEW_ICE_CANDIDATES",
};

const SOCKET_RECEIVE_EVENTS = {
  WEBRTC_OFFER: "WEBRTC_OFFER",
  WEBRTC_ANSWER: "WEBRTC_ANSWER",
  NEW_ICE_CANDIDATES: "NEW_ICE_CANDIDATES",
};
