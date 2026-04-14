import { Server as SocketIOServer } from "socket.io";
import { NextApiResponse } from "next";
import { Server as NetServer } from "http";
import { NextApiRequest } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // ← правильный импорт
import { prisma } from "@/lib/prisma";

export type NextApiResponseWithSocket = NextApiResponse & {
  socket: {
    server: NetServer & {
      io: SocketIOServer;
    };
  };
};

export const initSocket = (server: NetServer) => {
  if (!server.io) {
    const io = new SocketIOServer(server, {
      path: "/api/socket",
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    // Middleware для аутентификации
    io.use(async (socket, next) => {
      try {
        // Получаем session из cookie
        const session = await getServerSession(authOptions);
        
        if (session?.user) {
          socket.data.user = session.user;
          next();
        } else {
          next(new Error("Unauthorized"));
        }
      } catch (error) {
        next(new Error("Authentication error"));
      }
    });

    io.on("connection", (socket) => {
      console.log(`User connected: ${socket.data.user?.email}`);

      socket.on("join-room", (roomId: string) => {
        socket.join(roomId);
        socket.data.roomId = roomId;
        console.log(`${socket.data.user?.email} joined room: ${roomId}`);
        
        // Отправляем историю
        prisma.message.findMany({
          where: { roomId },
          take: 50,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        }).then(messages => {
          socket.emit("history", messages.reverse());
        }).catch(error => {
          console.error("Error loading messages:", error);
          socket.emit("error", "Failed to load message history");
        });
      });

      socket.on("send-message", async (data: { content: string; roomId?: string }) => {
        const roomId = data.roomId || socket.data.roomId || "general";
        
        try {
          const user = await prisma.user.findUnique({
            where: { email: socket.data.user?.email },
          });

          if (!user) return;

          const message = await prisma.message.create({
            data: {
              content: data.content,
              userId: user.id,
              roomId,
            },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          });

          io.to(roomId).emit("new-message", message);
        } catch (error) {
          console.error("Error saving message:", error);
          socket.emit("error", "Failed to send message");
        }
      });

      socket.on("typing", (isTyping: boolean) => {
        socket.to(socket.data.roomId).emit("user-typing", {
          user: socket.data.user?.name || socket.data.user?.email,
          isTyping,
        });
      });

      socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.data.user?.email}`);
      });
    });

    server.io = io;
  }
  return server.io;
};