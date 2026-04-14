import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth"; // ← правильный импорт
import Chat from "@/features/messanger/components/Chat";

export default async function ChatPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-800">💬 Real-time Chat</h1>
          <p className="text-gray-600 mt-2">
            Общайтесь в реальном времени с помощью Socket.io
          </p>
        </div>
        <Chat />
      </div>
    </div>
  );
}