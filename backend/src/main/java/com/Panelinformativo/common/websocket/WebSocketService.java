package com.Panelinformativo.common.websocket;

import com.Panelinformativo.mensajes.dto.MensajeDTO;
import com.Panelinformativo.pedidos.dto.PedidoDTO;
import com.Panelinformativo.usuarios.model.Rol;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

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

    public void notificarNuevoMensaje(MensajeDTO mensaje) {
        // Enviar al destinatario específico según su rol
        String destino = "/topic/mensajes/" + mensaje.getRolDestinatario().name().toLowerCase();
        messagingTemplate.convertAndSend(destino, mensaje);
        messagingTemplate.convertAndSend("/topic/mensajes/nuevo", mensaje);
    }

    public void notificarMensajeLeido(Long mensajeId, Rol.TipoRol rolDestinatario, MensajeDTO mensaje) {
        // Notificar al destinatario que su mensaje fue leído (para actualizar su UI)
        messagingTemplate.convertAndSend("/topic/mensajes/leido/" + rolDestinatario.name().toLowerCase(), mensajeId);
        
        // Notificar al remitente que su mensaje fue leído (para mostrar indicador de leído)
        Rol.TipoRol rolRemitente = mensaje.getRolRemitente();
        messagingTemplate.convertAndSend("/topic/mensajes/leido-remitente/" + rolRemitente.name().toLowerCase(), mensaje);
    }

    public void notificarMensajesLeidos(Rol.TipoRol rolDestinatario, List<MensajeDTO> mensajes) {
        // Notificar al destinatario
        messagingTemplate.convertAndSend("/topic/mensajes/todos-leidos/" + rolDestinatario.name().toLowerCase(), true);
        
        // Notificar a cada remitente que sus mensajes fueron leídos
        mensajes.forEach(mensaje -> {
            Rol.TipoRol rolRemitente = mensaje.getRolRemitente();
            messagingTemplate.convertAndSend("/topic/mensajes/leido-remitente/" + rolRemitente.name().toLowerCase(), mensaje);
        });
    }
}

