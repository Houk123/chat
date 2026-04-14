import { Server } from "socket.io";

export default function handler(req, res) {
  // Проверяем, запущен ли уже сервер
  if (!res.socket.server.io) {
    console.log("Запуск Socket.IO сервера...");
    const io = new Server(res.socket.server, {
      path: "/api/socket", // Путь должен совпадать с клиентским
      addTrailingSlash: false,
      cors: { origin: "*" }, // Настройте CORS для продакшена
    });

    io.on("connection", (socket) => {
      console.log("Подключен пользователь:", socket.id);
      
      // Пример: обработка сообщения
      socket.on("send-message", (msg) => {
        // Отправляем сообщение всем клиентам
        io.emit("new-message", { id: socket.id, text: msg });
      });

      socket.on("disconnect", () => {
        console.log("Пользователь отключился:", socket.id);
      });
    });

    res.socket.server.io = io;
  }
  res.end();
}