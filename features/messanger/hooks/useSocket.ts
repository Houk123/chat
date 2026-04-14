"use client";

import { useEffect, useState } from "react";
import io, { Socket } from "socket.io-client";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

export const useSocket = (roomId: string = "general") => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Инициализируем socket
    const socketInstance = io({
      path: "/api/socket",
      transports: ["polling", "websocket"],
    });

    socketInstance.on("connect", () => {
      console.log("✅ Connected to socket");
      setIsConnected(true);
      socketInstance.emit("join-room", roomId);
    });

    socketInstance.on("disconnect", () => {
      console.log("❌ Disconnected from socket");
      setIsConnected(false);
    });

    socketInstance.on("history", (msgs: Message[]) => {
      setMessages(msgs);
    });

    socketInstance.on("new-message", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    socketInstance.on("user-typing", ({ user, isTyping }) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        if (isTyping) newSet.add(user);
        else newSet.delete(user);
        return newSet;
      });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [roomId]);

  const sendMessage = (content: string) => {
    if (socket && content.trim()) {
      socket.emit("send-message", { content, roomId });
    }
  };

  const sendTyping = (isTyping: boolean) => {
    if (socket) {
      socket.emit("typing", isTyping);
    }
  };

  return { messages, sendMessage, sendTyping, isConnected, typingUsers: Array.from(typingUsers) };
};