/*

import { NextResponse } from "next/server";
import { Server as SocketIOServer } from "socket.io";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Объявляем io глобально
declare global {
  var io: SocketIOServer | undefined;
}

export async function GET(req: Request) {
  if (global.io) {
    return NextResponse.json({ message: "Socket.io already running" });
  }

  // @ts-ignore - нужно получить http сервер из Next.js
  const server = (await import("next")).default?.server;
  
  if (!server) {
    console.error("Could not get server instance");
    return NextResponse.json({ error: "Server not ready" }, { status: 500 });
  }

  const io = new SocketIOServer(server, {
    path: "/api/socket",
    addTrailingSlash: false,
    cors: {
      origin: "http://localhost:3000",
      credentials: true,
    },
  });

  // Аутентификация
  io.use(async (socket, next) => {
    try {
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
    console.log(`✅ User connected: ${socket.data.user?.email}`);

    socket.on("join-room", async (roomId: string) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      console.log(`📢 ${socket.data.user?.email} joined ${roomId}`);

      // Загружаем историю
      const messages = await prisma.message.findMany({
        where: { roomId },
        take: 50,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      });
      socket.emit("history", messages.reverse());
    });

    socket.on("send-message", async (data) => {
      const user = await prisma.user.findUnique({
        where: { email: socket.data.user?.email },
      });

      if (!user) return;

      const message = await prisma.message.create({
        data: {
          content: data.content,
          userId: user.id,
          roomId: data.roomId || "general",
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      });

      io.to(data.roomId || "general").emit("new-message", message);
    });

    socket.on("typing", (isTyping: boolean) => {
      socket.to(socket.data.roomId).emit("user-typing", {
        user: socket.data.user?.name || socket.data.user?.email,
        isTyping,
      });
    });

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.data.user?.email}`);
    });
  });

  global.io = io;
  return NextResponse.json({ message: "Socket.io started" });
}*/