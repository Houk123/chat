export async function initSocket() {
    if (typeof window === "undefined") {
      try {
        await fetch("http://localhost:3000/api/socket");
        console.log("✅ Socket.io initialized");
      } catch (error) {
        console.error("❌ Failed to initialize socket:", error);
      }
    }
  }