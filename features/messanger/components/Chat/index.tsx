"use client";

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

interface User {
    id: string;
    name: string;
    email?: string;
}

interface Message {
    from: string;
    fromName: string;
    to?: string;
    toName?: string;
    message: string;
    timestamp: Date;
}

export default function Chat() {
    const { data: session, status } = useSession();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [userTyping, setUserTyping] = useState<string | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout>();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Прокрутка к последнему сообщению
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (status !== 'authenticated') return;

        // Получаем ID пользователя из сессии
        const userId = session.user?.id || session.user?.email;
        
        const socketInstance = io({
            withCredentials: true,
            auth: {
                userId: userId,
                userName: session.user?.name
            }
        });

        socketInstance.on('connect', () => {
            console.log('Socket connected');
            setIsConnected(true);
        });

        socketInstance.on('disconnect', () => {
            console.log('Socket disconnected');
            setIsConnected(false);
        });

        socketInstance.on('online_users', (users: User[]) => {
            console.log('Online users:', users);
            setOnlineUsers(users.filter(u => u.id !== userId));
        });

        socketInstance.on('user_online', (user: User) => {
            console.log('User online:', user);
            setOnlineUsers(prev => {
                if (prev.find(u => u.id === user.id)) return prev;
                return [...prev, user];
            });
        });

        socketInstance.on('user_offline', (data: { id: string }) => {
            console.log('User offline:', data);
            setOnlineUsers(prev => prev.filter(u => u.id !== data.id));
            if (selectedUser?.id === data.id) {
                setSelectedUser(null);
            }
        });

        socketInstance.on('private_message', (message: Message) => {
            console.log('New private message:', message);
            setMessages(prev => [...prev, message]);
        });

        socketInstance.on('private_message_sent', (message: Message) => {
            console.log('Message sent:', message);
            setMessages(prev => [...prev, message]);
        });

        socketInstance.on('user_typing', (data: { from: string, fromName: string }) => {
            if (selectedUser?.id === data.from) {
                setUserTyping(data.fromName);
                setTimeout(() => setUserTyping(null), 1500);
            }
        });

        socketInstance.on('error', (error) => {
            console.error('Socket error:', error);
            alert(error.message);
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, [status, session]);

    // Обработка печатания
    useEffect(() => {
        if (!socket || !selectedUser || !isConnected) return;

        const handleTyping = () => {
            if (!isTyping) {
                setIsTyping(true);
                socket.emit('typing', { to: selectedUser.id });
            }
            
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                setIsTyping(false);
                socket.emit('stop_typing', { to: selectedUser.id });
            }, 1000);
        };

        const inputElement = document.getElementById('message-input');
        if (inputElement) {
            inputElement.addEventListener('input', handleTyping);
            return () => {
                inputElement.removeEventListener('input', handleTyping);
                clearTimeout(typingTimeoutRef.current);
            };
        }
    }, [socket, selectedUser, isConnected, isTyping]);

    const sendMessage = () => {
        if (input.trim() && socket && selectedUser && isConnected) {
            socket.emit('private_message', {
                to: selectedUser.id,
                message: input,
                from: session?.user?.id || session?.user?.email
            });
            setInput('');
            setIsTyping(false);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        }
    };

    const selectUser = (user: User) => {
        setSelectedUser(user);
        setMessages([]);
        setUserTyping(null);
    };

    if (status === 'loading') {
        return <div style={{ padding: "1rem" }}>Загрузка...</div>;
    }

    if (status !== 'authenticated') {
        return <div style={{ padding: "1rem" }}>
            Пожалуйста, войдите в систему для доступа к чату
        </div>;
    }

    return (
        <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif" }}>
            {/* Список пользователей */}
            <div style={{ 
                width: "300px", 
                borderRight: "1px solid #ccc", 
                background: "#f5f5f5",
                display: "flex",
                flexDirection: "column"
            }}>
                <div style={{ padding: "1rem", borderBottom: "1px solid #ccc", background: "#fff" }}>
                    <h3>Личные сообщения</h3>
                    <div style={{ fontSize: "12px", color: isConnected ? "green" : "red" }}>
                        {isConnected ? "● Онлайн" : "● Офлайн"}
                    </div>
                </div>
                
                <div style={{ flex: 1, overflowY: "auto" }}>
                    <div style={{ padding: "0.5rem", fontWeight: "bold", background: "#eee" }}>
                        Онлайн ({onlineUsers.length})
                    </div>
                    {onlineUsers.length === 0 ? (
                        <div style={{ padding: "1rem", textAlign: "center", color: "#999" }}>
                            Нет пользователей онлайн
                        </div>
                    ) : (
                        onlineUsers.map(user => (
                            <div
                                key={user.id}
                                onClick={() => selectUser(user)}
                                style={{
                                    padding: "1rem",
                                    cursor: "pointer",
                                    borderBottom: "1px solid #eee",
                                    background: selectedUser?.id === user.id ? "#e3f2fd" : "white",
                                    transition: "background 0.2s"
                                }}
                                onMouseEnter={(e) => {
                                    if (selectedUser?.id !== user.id) {
                                        e.currentTarget.style.background = "#f0f0f0";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (selectedUser?.id !== user.id) {
                                        e.currentTarget.style.background = "white";
                                    }
                                }}
                            >
                                <div style={{ fontWeight: "bold" }}>{user.name}</div>
                                <div style={{ fontSize: "12px", color: "green" }}>● Онлайн</div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Область чата */}
            {selectedUser ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    {/* Header */}
                    <div style={{ 
                        padding: "1rem", 
                        borderBottom: "1px solid #ccc", 
                        background: "#fff",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                    }}>
                        <div>
                            <strong>{selectedUser.name}</strong>
                            <div style={{ fontSize: "12px", color: "green" }}>Онлайн</div>
                        </div>
                        <button 
                            onClick={() => setSelectedUser(null)}
                            style={{ padding: "5px 10px", cursor: "pointer" }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Сообщения */}
                    <div style={{ 
                        flex: 1, 
                        overflowY: "auto", 
                        padding: "1rem",
                        background: "#fafafa"
                    }}>
                        {messages.length === 0 ? (
                            <div style={{ textAlign: "center", color: "#999", marginTop: "2rem" }}>
                                Нет сообщений. Напишите что-нибудь!
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
                                const isMyMessage = msg.from === (session?.user?.id || session?.user?.email);
                                return (
                                    <div
                                        key={idx}
                                        style={{
                                            display: "flex",
                                            justifyContent: isMyMessage ? "flex-end" : "flex-start",
                                            marginBottom: "1rem"
                                        }}
                                    >
                                        <div style={{
                                            maxWidth: "70%",
                                            padding: "0.5rem 1rem",
                                            borderRadius: "10px",
                                            background: isMyMessage ? "#007bff" : "#e9ecef",
                                            color: isMyMessage ? "white" : "black",
                                            wordWrap: "break-word"
                                        }}>
                                            <div style={{ fontSize: "12px", marginBottom: "5px" }}>
                                                {!isMyMessage && <strong>{msg.fromName}</strong>}
                                            </div>
                                            <div>{msg.message}</div>
                                            <div style={{ 
                                                fontSize: "10px", 
                                                marginTop: "5px",
                                                textAlign: "right",
                                                opacity: 0.7
                                            }}>
                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        {userTyping && (
                            <div style={{ color: "#999", fontSize: "12px", fontStyle: "italic" }}>
                                {userTyping} печатает...
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div style={{ 
                        padding: "1rem", 
                        borderTop: "1px solid #ccc", 
                        background: "#fff",
                        display: "flex",
                        gap: "10px"
                    }}>
                        <input
                            id="message-input"
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                            style={{
                                flex: 1,
                                padding: "0.5rem",
                                border: "1px solid #ccc",
                                borderRadius: "5px",
                                outline: "none"
                            }}
                            placeholder="Введите сообщение..."
                            disabled={!isConnected}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!isConnected}
                            style={{
                                padding: "0.5rem 1rem",
                                background: "#007bff",
                                color: "white",
                                border: "none",
                                borderRadius: "5px",
                                cursor: "pointer"
                            }}
                        >
                            Отправить
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ 
                    flex: 1, 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    color: "#999"
                }}>
                    Выберите пользователя для начала чата
                </div>
            )}
        </div>
    );
}