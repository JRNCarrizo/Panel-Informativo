package com.Panelinformativo.common.websocket;

import com.Panelinformativo.pedidos.dto.PedidoDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class WebSocketService {
    private final SimpMessagingTemplate messagingTemplate;

    public void notificarNuevoPedido(PedidoDTO pedido) {
        messagingTemplate.convertAndSend("/topic/pedidos", pedido);
        messagingTemplate.convertAndSend("/topic/pedidos/nuevo", pedido);
    }

    public void notificarActualizacionPedido(PedidoDTO pedido) {
        messagingTemplate.convertAndSend("/topic/pedidos", pedido);
        messagingTemplate.convertAndSend("/topic/pedidos/actualizado", pedido);
    }

    public void notificarEliminacionPedido(Long pedidoId) {
        messagingTemplate.convertAndSend("/topic/pedidos/eliminado", pedidoId);
    }
}

