const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = express();
    const httpServer = http.createServer(server);
    
    const io = new Server(httpServer, {
        cors: {
            origin: "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // Хранилище для онлайн пользователей
    const onlineUsers = new Map(); // userId -> socketId
    const userSockets = new Map(); // socketId -> userId

    // Middleware для авторизации
    io.use(async (socket, next) => {
        // Временно для теста
        socket.user = {
            id: socket.handshake.auth.userId || `user_${Date.now()}`,
            email: `${socket.handshake.auth.userId || 'user'}@example.com`,
            name: socket.handshake.auth.userName || 'User'
        };
        next();
    });

    io.on('connection', (socket) => {
        const user = socket.user;
        console.log(`✅ ${user.name} (${user.id}) connected`);

        // Добавляем пользователя в список онлайн
        onlineUsers.set(user.id, socket.id);
        userSockets.set(socket.id, user.id);

        // Отправляем пользователю список всех онлайн пользователей
        const onlineUsersList = Array.from(onlineUsers.keys()).map(id => ({
            id: id,
            name: id === user.id ? user.name : `User ${id}` // В реальном проекте получаем имена из БД
        }));
        socket.emit('online_users', onlineUsersList);

        // Рассылаем всем остальным, что новый пользователь онлайн
        socket.broadcast.emit('user_online', {
            id: user.id,
            name: user.name
        });

        // Обработка личного сообщения
        socket.on('private_message', (data) => {
            const { to, message, from } = data;
            
            console.log(`Private message from ${user.name} to ${to}: ${message}`);
            
            const recipientSocketId = onlineUsers.get(to);
            
            if (recipientSocketId) {
                // Отправляем получателю
                io.to(recipientSocketId).emit('private_message', {
                    from: user.id,
                    fromName: user.name,
                    message: message,
                    timestamp: new Date()
                });
                
                // Отправляем отправителю подтверждение
                socket.emit('private_message_sent', {
                    to: to,
                    toName: `User ${to}`,
                    message: message,
                    timestamp: new Date()
                });
            } else {
                socket.emit('error', {
                    message: `Пользователь ${to} не в сети`
                });
            }
        });

        // Обработка начала печатания
        socket.on('typing', (data) => {
            const { to } = data;
            const recipientSocketId = onlineUsers.get(to);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('user_typing', {
                    from: user.id,
                    fromName: user.name
                });
            }
        });

        // Обработка остановки печатания
        socket.on('stop_typing', (data) => {
            const { to } = data;
            const recipientSocketId = onlineUsers.get(to);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('user_stop_typing', {
                    from: user.id
                });
            }
        });

        // Обработка отключения
        socket.on('disconnect', () => {
            console.log(`❌ ${user.name} (${user.id}) disconnected`);
            
            onlineUsers.delete(user.id);
            userSockets.delete(socket.id);
            
            // Рассылаем всем, что пользователь офлайн
            socket.broadcast.emit('user_offline', {
                id: user.id
            });
        });
    });
    
    server.use((req, res) => {
        return handle(req, res);
    });
    
    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
        console.log(`🚀 Server ready on http://localhost:${PORT}`);
    });
});