import { io } from 'socket.io-client';
import { getToken } from './api.js';

// One shared socket connection. It connects same-origin (Vite proxies /socket.io
// to the API in dev; Nginx proxies it in production) and authenticates with the
// same JWT as the REST calls.
export function connectSocket() {
  return io({
    path: '/socket.io',
    auth: { token: getToken() },
    transports: ['websocket'],
  });
}
