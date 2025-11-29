package com.Panelinformativo.pedidos.service;

import com.Panelinformativo.grupos.model.Grupo;
import com.Panelinformativo.grupos.repository.GrupoRepository;
import com.Panelinformativo.pedidos.dto.PedidoCreateDTO;
import com.Panelinformativo.pedidos.dto.PedidoDTO;
import com.Panelinformativo.pedidos.model.Pedido;
import com.Panelinformativo.pedidos.repository.PedidoRepository;
import com.Panelinformativo.transportistas.model.Transportista;
import com.Panelinformativo.transportistas.repository.TransportistaRepository;
import com.Panelinformativo.usuarios.model.Usuario;
import com.Panelinformativo.zonas.model.Zona;
import com.Panelinformativo.zonas.service.ZonaService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PedidoService {
    private final PedidoRepository pedidoRepository;
    private final GrupoRepository grupoRepository;
    private final TransportistaRepository transportistaRepository;
    private final ZonaService zonaService;

    @Transactional
    public PedidoDTO crearPedido(PedidoCreateDTO dto, Usuario usuarioCreador) {
        if (pedidoRepository.findByNumeroPlanilla(dto.getNumeroPlanilla()).isPresent()) {
            throw new IllegalArgumentException("Ya existe un pedido con ese número de planilla");
        }

        if (dto.getTransportistaId() == null) {
            throw new IllegalArgumentException("El transportista es obligatorio");
        }

        Transportista transportista = transportistaRepository.findById(dto.getTransportistaId())
                .orElseThrow(() -> new IllegalArgumentException("Transportista no encontrado"));

        // Crear u obtener zona si se proporciona
        Zona zona = null;
        if (dto.getZonaNombre() != null && !dto.getZonaNombre().trim().isEmpty()) {
            zona = zonaService.crearObtenerZonaEntity(dto.getZonaNombre().trim());
        }

        Pedido pedido = new Pedido();
        pedido.setNumeroPlanilla(dto.getNumeroPlanilla());
        pedido.setTransportista(transportista);
        pedido.setZona(zona);
        pedido.setPrioridad(dto.getPrioridad() != null ? dto.getPrioridad() : Pedido.Prioridad.NORMAL);
        pedido.setEstado(Pedido.EstadoPedido.PENDIENTE);
        pedido.setUsuarioCreador(usuarioCreador);

        pedido = pedidoRepository.save(pedido);
        return convertirADTO(pedido);
    }

    public List<PedidoDTO> obtenerTodosLosPedidos() {
        // Ordenar por fecha de creación descendente (más recientes primero)
        return pedidoRepository.findAllByOrderByFechaCreacionDesc().stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    public List<PedidoDTO> obtenerPedidosPorEstado(Pedido.EstadoPedido estado) {
        // Para pedidos REALIZADOS, ordenar por fecha de actualización descendente (más recientes primero)
        // Para otros estados, ordenar por prioridad descendente y luego por fecha de creación ascendente
        List<Pedido> pedidos;
        if (estado == Pedido.EstadoPedido.REALIZADO) {
            pedidos = pedidoRepository.findByEstadoOrderByFechaActualizacionDesc(estado);
        } else {
            pedidos = pedidoRepository.findByEstadoOrderByPrioridadDescFechaCreacionAsc(estado);
        }
        
        return pedidos.stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    public PedidoDTO obtenerPedidoPorId(Long id) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado"));
        return convertirADTO(pedido);
    }

    @Transactional
    public PedidoDTO actualizarEstadoPedido(Long id, Pedido.EstadoPedido nuevoEstado) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado"));
        pedido.setEstado(nuevoEstado);
        pedido = pedidoRepository.save(pedido);
        return convertirADTO(pedido);
    }

    @Transactional
    public PedidoDTO asignarGrupo(Long id, Long grupoId) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado"));
        
        Grupo grupo = grupoRepository.findById(grupoId)
                .orElseThrow(() -> new IllegalArgumentException("Grupo no encontrado"));

        pedido.setGrupoAsignado(grupo);
        pedido = pedidoRepository.save(pedido);
        return convertirADTO(pedido);
    }

    @Transactional
    public PedidoDTO quitarGrupo(Long id) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado"));
        
        pedido.setGrupoAsignado(null);
        pedido = pedidoRepository.save(pedido);
        return convertirADTO(pedido);
    }

    @Transactional
    public PedidoDTO actualizarPedido(Long id, PedidoCreateDTO dto) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado"));

        if (!pedido.getNumeroPlanilla().equals(dto.getNumeroPlanilla())) {
            if (pedidoRepository.findByNumeroPlanilla(dto.getNumeroPlanilla()).isPresent()) {
                throw new IllegalArgumentException("Ya existe un pedido con ese número de planilla");
            }
        }

        pedido.setNumeroPlanilla(dto.getNumeroPlanilla());
        
        if (dto.getTransportistaId() != null) {
            Transportista transportista = transportistaRepository.findById(dto.getTransportistaId())
                    .orElseThrow(() -> new IllegalArgumentException("Transportista no encontrado"));
            pedido.setTransportista(transportista);
        }

        // Actualizar zona si se proporciona
        if (dto.getZonaNombre() != null && !dto.getZonaNombre().trim().isEmpty()) {
            Zona zona = zonaService.crearObtenerZonaEntity(dto.getZonaNombre().trim());
            pedido.setZona(zona);
        } else if (dto.getZonaNombre() != null && dto.getZonaNombre().trim().isEmpty()) {
            // Si se envía vacío, quitar la zona
            pedido.setZona(null);
        }
        
        pedido.setPrioridad(dto.getPrioridad() != null ? dto.getPrioridad() : Pedido.Prioridad.NORMAL);

        pedido = pedidoRepository.save(pedido);
        return convertirADTO(pedido);
    }

    @Transactional
    public void eliminarPedido(Long id) {
        if (!pedidoRepository.existsById(id)) {
            throw new IllegalArgumentException("Pedido no encontrado");
        }
        pedidoRepository.deleteById(id);
    }

    private PedidoDTO convertirADTO(Pedido pedido) {
        PedidoDTO dto = new PedidoDTO();
        dto.setId(pedido.getId());
        dto.setNumeroPlanilla(pedido.getNumeroPlanilla());
        dto.setPrioridad(pedido.getPrioridad());
        dto.setEstado(pedido.getEstado());
        dto.setUsuarioCreadorNombre(pedido.getUsuarioCreador().getNombreCompleto());
        dto.setFechaCreacion(pedido.getFechaCreacion());
        dto.setFechaActualizacion(pedido.getFechaActualizacion());

        if (pedido.getTransportista() != null) {
            dto.setTransportistaId(pedido.getTransportista().getId());
            dto.setTransportistaCodigoInterno(pedido.getTransportista().getCodigoInterno());
            dto.setTransportistaChofer(pedido.getTransportista().getChofer());
            dto.setTransportistaVehiculo(pedido.getTransportista().getVehiculo());
            // Para compatibilidad con frontend, mantener el campo transportista como string
            dto.setTransportista(pedido.getTransportista().getChofer() + " - " + 
                                pedido.getTransportista().getVehiculo());
        } else {
            // Si no hay transportista (pedidos antiguos), establecer valores por defecto
            dto.setTransportista("Sin transportista asignado");
        }

        if (pedido.getGrupoAsignado() != null) {
            dto.setGrupoId(pedido.getGrupoAsignado().getId());
            dto.setGrupoNombre(pedido.getGrupoAsignado().getNombre());
        }

        if (pedido.getZona() != null) {
            dto.setZonaId(pedido.getZona().getId());
            dto.setZonaNombre(pedido.getZona().getNombre());
        }

        return dto;
    }
}

