package com.Panelinformativo.mensajes.service;

import com.Panelinformativo.common.websocket.WebSocketService;
import com.Panelinformativo.mensajes.dto.MensajeCreateDTO;
import com.Panelinformativo.mensajes.dto.MensajeDTO;
import com.Panelinformativo.mensajes.model.Mensaje;
import com.Panelinformativo.mensajes.repository.MensajeRepository;
import com.Panelinformativo.usuarios.model.Rol;
import com.Panelinformativo.usuarios.model.Usuario;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MensajeService {
    private final MensajeRepository mensajeRepository;
    private final WebSocketService webSocketService;

    @Transactional
    public MensajeDTO crearMensaje(MensajeCreateDTO dto, Usuario remitente) {
        Mensaje mensaje = new Mensaje();
        mensaje.setContenido(dto.getContenido());
        mensaje.setRemitente(remitente);
        mensaje.setRolDestinatario(dto.getRolDestinatario());
        mensaje.setLeido(false);
        mensaje.setFechaDia(LocalDate.now());

        mensaje = mensajeRepository.save(mensaje);

        MensajeDTO mensajeDTO = convertirADTO(mensaje);
        
        // Notificar vía WebSocket al destinatario
        webSocketService.notificarNuevoMensaje(mensajeDTO);

        return mensajeDTO;
    }

    public List<MensajeDTO> obtenerMensajesDelDia(Rol.TipoRol rolDestinatario) {
        LocalDate hoy = LocalDate.now();
        List<Mensaje> mensajes = mensajeRepository.findByFechaDiaOrderByFechaCreacionAsc(hoy);
        
        // Filtrar mensajes donde el usuario es destinatario o remitente
        return mensajes.stream()
                .filter(m -> m.getRolDestinatario().equals(rolDestinatario) || 
                           m.getRemitente().getRol().getNombre().equals(rolDestinatario))
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    public long contarMensajesNoLeidos(Rol.TipoRol rolDestinatario) {
        LocalDate hoy = LocalDate.now();
        return mensajeRepository.countByRolDestinatarioAndFechaDiaAndLeidoFalse(rolDestinatario, hoy);
    }

    @Transactional
    public void marcarMensajeComoLeido(Long mensajeId, Rol.TipoRol rolUsuario) {
        Mensaje mensaje = mensajeRepository.findById(mensajeId)
                .orElseThrow(() -> new IllegalArgumentException("Mensaje no encontrado"));

        // Solo el destinatario puede marcar como leído
        if (mensaje.getRolDestinatario().equals(rolUsuario) && !mensaje.getLeido()) {
            mensaje.setLeido(true);
            mensajeRepository.save(mensaje);
            
            // Convertir a DTO para enviar al remitente
            MensajeDTO mensajeDTO = convertirADTO(mensaje);
            
            // Notificar actualización vía WebSocket (tanto al destinatario como al remitente)
            webSocketService.notificarMensajeLeido(mensajeId, rolUsuario, mensajeDTO);
        }
    }

    @Transactional
    public void marcarTodosComoLeidos(Rol.TipoRol rolDestinatario) {
        LocalDate hoy = LocalDate.now();
        List<Mensaje> mensajesNoLeidos = mensajeRepository
                .findByRolDestinatarioAndFechaDiaAndLeidoFalseOrderByFechaCreacionAsc(rolDestinatario, hoy);
        
        mensajesNoLeidos.forEach(m -> m.setLeido(true));
        mensajeRepository.saveAll(mensajesNoLeidos);
        
        // Convertir a DTOs para enviar a los remitentes
        List<MensajeDTO> mensajesDTO = mensajesNoLeidos.stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
        
        // Notificar actualización vía WebSocket (tanto al destinatario como a los remitentes)
        webSocketService.notificarMensajesLeidos(rolDestinatario, mensajesDTO);
    }

    // Limpiar mensajes de días anteriores (ejecutar al inicio de cada día)
    @Scheduled(cron = "0 0 0 * * ?") // Todos los días a medianoche
    @Transactional
    public void limpiarMensajesAntiguos() {
        LocalDate hoy = LocalDate.now();
        mensajeRepository.deleteByFechaDiaBefore(hoy);
    }

    // También podemos ejecutar esta limpieza cuando se accede a los mensajes
    @Transactional
    public void limpiarMensajesAntiguosSiEsNuevoDia() {
        LocalDate hoy = LocalDate.now();
        // Verificar si hay mensajes de días anteriores
        if (mensajeRepository.count() > 0) {
            mensajeRepository.deleteByFechaDiaBefore(hoy);
        }
    }

    private MensajeDTO convertirADTO(Mensaje mensaje) {
        MensajeDTO dto = new MensajeDTO();
        dto.setId(mensaje.getId());
        dto.setContenido(mensaje.getContenido());
        dto.setRemitenteId(mensaje.getRemitente().getId());
        dto.setRemitenteNombre(mensaje.getRemitente().getNombreCompleto());
        dto.setRolRemitente(mensaje.getRemitente().getRol().getNombre());
        dto.setRolDestinatario(mensaje.getRolDestinatario());
        dto.setLeido(mensaje.getLeido());
        dto.setFechaCreacion(mensaje.getFechaCreacion());
        return dto;
    }
}

