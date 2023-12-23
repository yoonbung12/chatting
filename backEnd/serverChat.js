const http = require("http");
const express = require("express");
const app = express();
// 소켓이 http모듈로 생성된 서버에서만 동작
const server = http.createServer(app);
const PORT = 8000;

// cors 이슈 : 다른 서버에서 보내는 요청을 제한함
const cors = require("cors");
const { access } = require("fs");
app.use(cors());

const io = require("socket.io")(server, {
  cors: {
    origin: "http://localhost:3000",
  },
});

const userIdArr = {};
const userRoomIdArr = {};

const updateAllRoom = (roomId) => {
  // userRoomIdArr에서 roomId와 일치하는 socket.id찾기
  const socketIdInRoom = Object.values(userRoomIdArr).filter(
    (socketId) => userRoomIdArr[socketId] === roomId
  );

  // userRoomIdArr에서 socketIdInRoom 배열과 잎치하는 socket.id : userId저장
  const userInRoom = socketIdInRoom.reduce((acc, socketId) => {
    acc[socketId] = userIdArr[socketId];
    return acc;
  }, {});

  if (roomId === "FRONTEND") io.emit("updateFrontList", userInRoom);
  else if (roomId === "BACKEND") io.emit("updateBackList", userInRoom);
  else io.emit("updateFullList", userInRoom);
};

const updateUserList = () => {
  io.emit("userList", userIdArr);
};

io.on("connection", (socket) => {
  console.log("socket id", socket.id);

  socket.on("entry", (res) => {
    if (Object.values(userIdArr).includes(res.userId)) {
      //닉네임이 중복될 경우에
      socket.emit("error", {
        msg: "중복된 아이디가 존재하여 입장이 불가합니다.",
      });
    } else {
      // 중복되지 않을 경우에
      // 해당하는 단체방에 입장
      socket.join(res.roomId);
      userRoomIdArr[socket.id] = res.roomId;
      // 특정 방에 속한 모든 클라이언트에게 전달
      io.to(res.roomId).emit("notice", {
        msg: `${res.userId}님이 입장하셨습니다.`,
      });
      socket.emit("entrySuccess", { userId: res.userId });
      userIdArr[socket.id] = res.userId;
      updateUserList();
      updateAllRoom(res.roomId);
    }
    console.log(userIdArr);
    console.log(userRoomIdArr);
    // 중복된다는 오류 메세지를 보내주던지
  });

  socket.on("disconnect", () => {
    let deleteAllRoom;
    if (userIdArr[socket.id]) {
      io.to(userRoomIdArr[socket.id]).emit("notice", {
        msg: `${userIdArr[socket.id]}님이 퇴장하셨습니다.`,
      });
      socket.leave(userRoomIdArr[socket.id]);
      deleteAllRoom = userRoomIdArr[socket.id];
      delete userRoomIdArr[socket.id];
      delete userIdArr[socket.id];
    }
    console.log(userIdArr);
    updateUserList();
    updateAllRoom(deleteAllRoom);
  });

  // 실습 4번
  socket.on("sendMsg", (res) => {
    if (res.dm === "all") {
      io.emit("chat", { userId: res.userId, msg: res.msg });
    } else {
      // io.to(소켓 아이디).emit()
      io.to(res.dm).emit("chat", {
        userId: res.userId,
        msg: res.msg,
        dm: true,
      });
      socket.emit("chat", { userId: res.userId, msg: res.msg, dm: true });
    }
  });
});

server.listen(PORT, function () {
  console.log(`Sever Open: ${PORT}`);
});
