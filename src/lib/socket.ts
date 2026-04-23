import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let connectionPromise: Promise<Socket> | null = null;

function createSocket() {
  return io({
    autoConnect: false,
  });
}

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Promise<Socket> {
  if (socket?.connected) {
    return Promise.resolve(socket);
  }

  if (!socket) {
    socket = createSocket();
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error("Socket initialization failed"));
      return;
    }

    const activeSocket = socket;

    const handleConnect = () => {
      cleanup();
      connectionPromise = null;
      resolve(activeSocket);
    };

    const handleError = (error: Error) => {
      cleanup();
      connectionPromise = null;
      reject(error);
    };

    const cleanup = () => {
      activeSocket.off("connect", handleConnect);
      activeSocket.off("connect_error", handleError);
    };

    activeSocket.on("connect", handleConnect);
    activeSocket.on("connect_error", handleError);
    activeSocket.connect();
  });

  return connectionPromise;
}

export function disconnectSocket() {
  if (!socket) return;

  connectionPromise = null;
  socket.disconnect();
}
