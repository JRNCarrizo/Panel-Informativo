import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

let stompClient = null;
let currentOnMessage = null;
let currentOnError = null;
let isConnecting = false; // Flag para evitar múltiples conexiones simultáneas

// Función para obtener la URL base del backend
const getBackendBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Si no es localhost, usar la misma IP para el backend
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:8080`;
    }
  }
  // Por defecto, usar localhost
  return 'http://localhost:8080';
};

export const connectWebSocket = (onMessage, onError) => {
  // Guardar los callbacks
  currentOnMessage = onMessage;
  currentOnError = onError;
  
  // Si ya existe una conexión activa, no crear otra
  if (stompClient && stompClient.connected) {
    console.log('WebSocket ya está conectado, reutilizando conexión existente');
    return stompClient;
  }
  
  // Si ya se está conectando, no crear otra conexión
  if (isConnecting) {
    console.log('WebSocket ya se está conectando, esperando...');
    return stompClient;
  }
  
  // Si existe un cliente pero no está conectado, limpiarlo
  if (stompClient) {
    try {
      if (stompClient.connected) {
        stompClient.deactivate();
      }
    } catch (err) {
      console.warn('Error desconectando cliente previo:', err);
    }
    stompClient = null;
  }
  
  // Marcar que estamos conectando
  isConnecting = true;

  try {
    const backendUrl = getBackendBaseUrl();
    const socket = new SockJS(`${backendUrl}/ws`);
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: (frame) => {
        console.log('Conectado a WebSocket', frame);
        isConnecting = false; // Marcar que ya se conectó
        try {
          // Usar la referencia del cliente directamente en lugar de stompClient
          if (!client || !client.connected) {
            console.warn('Cliente STOMP no está conectado aún');
            return;
          }

          // Usar currentOnMessage en lugar de onMessage para que siempre use el callback más reciente
          const messageHandler = currentOnMessage || onMessage;
          
          if (!messageHandler) {
            console.warn('No hay handler de mensajes configurado');
            return;
          }
          
          client.subscribe('/topic/pedidos', (message) => {
            try {
              messageHandler(JSON.parse(message.body));
            } catch (err) {
              console.error('Error procesando mensaje WebSocket:', err);
            }
          });
          client.subscribe('/topic/pedidos/nuevo', (message) => {
            try {
              messageHandler(JSON.parse(message.body));
            } catch (err) {
              console.error('Error procesando mensaje WebSocket:', err);
            }
          });
          client.subscribe('/topic/pedidos/actualizado', (message) => {
            try {
              messageHandler(JSON.parse(message.body));
            } catch (err) {
              console.error('Error procesando mensaje WebSocket:', err);
            }
          });
          client.subscribe('/topic/pedidos/eliminado', (message) => {
            try {
              messageHandler({ tipo: 'eliminado', id: JSON.parse(message.body) });
            } catch (err) {
              console.error('Error procesando mensaje WebSocket:', err);
            }
          });
          console.log('Suscripciones a canales WebSocket establecidas');
        } catch (err) {
          console.error('Error suscribiéndose a canales WebSocket:', err);
          isConnecting = false; // Resetear flag si hay error
          const errorHandler = currentOnError || onError;
          if (errorHandler) errorHandler(err);
        }
      },
      onStompError: (frame) => {
        console.error('Error en STOMP:', frame);
        isConnecting = false; // Resetear flag si hay error
        const errorHandler = currentOnError || onError;
        if (errorHandler) errorHandler(frame);
      },
      onWebSocketError: (event) => {
        console.error('Error en WebSocket:', event);
        isConnecting = false; // Resetear flag si hay error
        const errorHandler = currentOnError || onError;
        if (errorHandler) errorHandler(event);
      },
      onDisconnect: () => {
        console.log('Desconectado de WebSocket');
        isConnecting = false; // Resetear flag al desconectar
      },
    });

    stompClient = client;
    client.activate();
    return client;
  } catch (error) {
    console.error('Error conectando WebSocket:', error);
    isConnecting = false; // Resetear flag si hay error
    const errorHandler = currentOnError || onError;
    if (errorHandler) errorHandler(error);
    return null;
  }
};

export const disconnectWebSocket = () => {
  if (stompClient) {
    try {
      stompClient.deactivate();
    } catch (error) {
      console.error('Error desconectando WebSocket:', error);
    }
    stompClient = null;
  }
  isConnecting = false; // Resetear flag al desconectar
};

export default { connectWebSocket, disconnectWebSocket };

