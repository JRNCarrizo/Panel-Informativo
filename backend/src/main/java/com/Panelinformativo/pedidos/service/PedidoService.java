package com.Panelinformativo.pedidos.service;

import com.Panelinformativo.grupos.model.Grupo;
import com.Panelinformativo.grupos.repository.GrupoRepository;
import com.Panelinformativo.pedidos.dto.PedidoCreateDTO;
import com.Panelinformativo.pedidos.dto.PedidoDTO;
import com.Panelinformativo.pedidos.dto.TransportistaVueltasDTO;
import com.Panelinformativo.pedidos.model.Pedido;
import com.Panelinformativo.pedidos.repository.PedidoRepository;
import com.Panelinformativo.transportistas.model.Transportista;
import com.Panelinformativo.transportistas.service.TransportistaService;
import com.Panelinformativo.usuarios.model.Usuario;
import com.Panelinformativo.zonas.model.Zona;
import com.Panelinformativo.zonas.service.ZonaService;
import com.Panelinformativo.vueltas.model.Vuelta;
import com.Panelinformativo.vueltas.service.VueltaService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PedidoService {
    private final PedidoRepository pedidoRepository;
    private final GrupoRepository grupoRepository;
    private final TransportistaService transportistaService;
    private final ZonaService zonaService;
    private final VueltaService vueltaService;

    @Transactional
    public PedidoDTO crearPedido(PedidoCreateDTO dto, Usuario usuarioCreador) {
        if (pedidoRepository.findByNumeroPlanilla(dto.getNumeroPlanilla()).isPresent()) {
            throw new IllegalArgumentException("Ya existe un pedido con ese número de planilla");
        }

        if (dto.getTransportistaNombre() == null || dto.getTransportistaNombre().trim().isEmpty()) {
            throw new IllegalArgumentException("El transporte es obligatorio");
        }

        if (dto.getCantidad() == null || dto.getCantidad() <= 0) {
            throw new IllegalArgumentException("La cantidad es obligatoria y debe ser mayor a 0");
        }

        if (dto.getVueltaNombre() == null || dto.getVueltaNombre().trim().isEmpty()) {
            throw new IllegalArgumentException("La vuelta es obligatoria");
        }

        // Crear u obtener transporte (obligatorio)
        Transportista transportista = transportistaService.crearObtenerTransportistaEntity(dto.getTransportistaNombre().trim());

        // Crear u obtener zona si se proporciona (opcional)
        Zona zona = null;
        if (dto.getZonaNombre() != null && !dto.getZonaNombre().trim().isEmpty()) {
            zona = zonaService.crearObtenerZonaEntity(dto.getZonaNombre().trim());
        }

        // Crear u obtener vuelta (obligatoria)
        Vuelta vuelta = vueltaService.crearObtenerVueltaEntity(dto.getVueltaNombre().trim());

        // Determinar fecha de entrega: usar la proporcionada o por defecto hoy
        LocalDate fechaEntrega = dto.getFechaEntrega() != null ? dto.getFechaEntrega() : LocalDate.now();
        
        // Validar que no se duplique la vuelta del mismo transporte en la misma fecha de entrega
        List<Pedido> pedidosExistentes = pedidoRepository.findByTransportistaAndVueltaAndFechaEntrega(
            transportista, vuelta, fechaEntrega
        );
        
        if (!pedidosExistentes.isEmpty()) {
            throw new IllegalArgumentException(
                String.format("El transporte '%s' ya tiene asignada la vuelta '%s' para la fecha %s", 
                    transportista.getNombre(), vuelta.getNombre(), fechaEntrega.toString())
            );
        }

        Pedido pedido = new Pedido();
        pedido.setNumeroPlanilla(dto.getNumeroPlanilla());
        pedido.setTransportista(transportista);
        pedido.setZona(zona);
        pedido.setCantidad(dto.getCantidad());
        pedido.setVuelta(vuelta);
        pedido.setFechaEntrega(fechaEntrega);
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
        // Para otros estados, ordenar por fecha de creación ascendente
        List<Pedido> pedidos;
        if (estado == Pedido.EstadoPedido.REALIZADO) {
            pedidos = pedidoRepository.findByEstadoOrderByFechaActualizacionDesc(estado);
        } else {
            pedidos = pedidoRepository.findByEstadoOrderByFechaCreacionAsc(estado);
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
        
        // Guardar el estado anterior antes de cambiarlo
        Pedido.EstadoPedido estadoAnterior = pedido.getEstado();
        
        pedido.setEstado(nuevoEstado);
        
        // Si cambia a REALIZADO, limpiar la etapa de preparación y el orden de prioridad
        if (nuevoEstado == Pedido.EstadoPedido.REALIZADO) {
            pedido.setEtapaPreparacion(null);
            pedido.setOrdenPrioridadCarga(null);
            pedido.setControlado(false); // Limpiar cuando se realiza
        }
        
        // Si vuelve a PENDIENTE desde EN_PREPARACION, solo limpiar la etapa de preparación
        // pero MANTENER el ordenPrioridadCarga para que vuelva a aparecer en la cola de prioridad
        if (nuevoEstado == Pedido.EstadoPedido.PENDIENTE && estadoAnterior == Pedido.EstadoPedido.EN_PREPARACION) {
            pedido.setEtapaPreparacion(null);
            pedido.setFechaPendienteCarga(null);
            pedido.setControlado(false); // Limpiar cuando vuelve a pendiente
            // NO limpiar ordenPrioridadCarga - mantenerlo para que vuelva a la cola de prioridad en la misma posición
        }
        
        // Si pasa a EN_PREPARACION, limpiar el orden de prioridad de carga (ya no está en la cola)
        if (nuevoEstado == Pedido.EstadoPedido.EN_PREPARACION) {
            pedido.setOrdenPrioridadCarga(null);
        }
        
        pedido = pedidoRepository.save(pedido);
        return convertirADTO(pedido);
    }

    @Transactional
    public PedidoDTO avanzarEtapaPreparacion(Long id) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado"));
        
        if (pedido.getEstado() != Pedido.EstadoPedido.EN_PREPARACION) {
            throw new IllegalArgumentException("El pedido debe estar en preparación para avanzar su etapa");
        }
        
        // Avanzar la etapa: null -> CONTROL -> PENDIENTE_CARGA -> REALIZADO
        if (pedido.getEtapaPreparacion() == null) {
            // Cuando pasa a CONTROL, establecer como sin controlar
            pedido.setEtapaPreparacion(Pedido.EtapaPreparacion.CONTROL);
            pedido.setControlado(false);
        } else if (pedido.getEtapaPreparacion() == Pedido.EtapaPreparacion.CONTROL) {
            // Cuando pasa a PENDIENTE_CARGA desde CONTROL, establecer como controlado
            pedido.setEtapaPreparacion(Pedido.EtapaPreparacion.PENDIENTE_CARGA);
            pedido.setControlado(true);
            pedido.setFechaPendienteCarga(LocalDateTime.now()); // Guardar fecha cuando pasa a PENDIENTE_CARGA
        } else if (pedido.getEtapaPreparacion() == Pedido.EtapaPreparacion.PENDIENTE_CARGA) {
            pedido.setEstado(Pedido.EstadoPedido.REALIZADO);
            pedido.setEtapaPreparacion(null);
            pedido.setControlado(false); // Limpiar cuando se realiza
        }
        
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
        
        // Actualizar transporte si se proporciona
        if (dto.getTransportistaNombre() != null && !dto.getTransportistaNombre().trim().isEmpty()) {
            Transportista transportista = transportistaService.crearObtenerTransportistaEntity(dto.getTransportistaNombre().trim());
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

        // Actualizar cantidad
        pedido.setCantidad(dto.getCantidad());

        // Actualizar vuelta si se proporciona
        if (dto.getVueltaNombre() != null && !dto.getVueltaNombre().trim().isEmpty()) {
            Vuelta vuelta = vueltaService.crearObtenerVueltaEntity(dto.getVueltaNombre().trim());
            pedido.setVuelta(vuelta);
        } else if (dto.getVueltaNombre() != null && dto.getVueltaNombre().trim().isEmpty()) {
            // Si se envía vacío, quitar la vuelta
            pedido.setVuelta(null);
        }
        
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

    // Obtener pedidos pendientes sin orden de prioridad de carga asignado (para Panel Depósito)
    public List<PedidoDTO> obtenerPedidosPendientesSinOrden() {
        return pedidoRepository.findPendientesSinOrdenPrioridadCarga().stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    // Obtener pedidos pendientes con orden de prioridad de carga (para Pantalla Pública)
    public List<PedidoDTO> obtenerPedidosConOrdenPrioridadCarga() {
        return pedidoRepository.findPendientesConOrdenPrioridadCarga().stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    // Actualizar el orden de prioridad de carga de múltiples pedidos
    @Transactional
    public List<PedidoDTO> actualizarOrdenPrioridadCarga(List<Long> pedidoIds) {
        List<Pedido> pedidos = pedidoRepository.findAllById(pedidoIds);
        
        if (pedidos.size() != pedidoIds.size()) {
            throw new IllegalArgumentException("Algunos pedidos no fueron encontrados");
        }
        
        // Verificar que todos estén en estado PENDIENTE
        for (Pedido pedido : pedidos) {
            if (pedido.getEstado() != Pedido.EstadoPedido.PENDIENTE) {
                throw new IllegalArgumentException("Solo se puede asignar orden a pedidos en estado PENDIENTE");
            }
        }
        
        // Asignar orden según la posición en la lista
        for (int i = 0; i < pedidoIds.size(); i++) {
            Long pedidoId = pedidoIds.get(i);
            Pedido pedido = pedidos.stream()
                    .filter(p -> p.getId().equals(pedidoId))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado: " + pedidoId));
            pedido.setOrdenPrioridadCarga(i + 1);
        }
        
        pedidoRepository.saveAll(pedidos);
        
        return pedidos.stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    // Remover un pedido de la cola de prioridad de carga (poner orden en null)
    @Transactional
    public PedidoDTO removerDeColaPrioridadCarga(Long id) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado"));
        
        pedido.setOrdenPrioridadCarga(null);
        pedido = pedidoRepository.save(pedido);
        
        return convertirADTO(pedido);
    }

    // Asignar un pedido a la cola de prioridad de carga (agregar al final)
    @Transactional
    public PedidoDTO agregarAColaPrioridadCarga(Long id) {
        Pedido pedido = pedidoRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pedido no encontrado"));
        
        if (pedido.getEstado() != Pedido.EstadoPedido.PENDIENTE) {
            throw new IllegalArgumentException("Solo se puede agregar a la cola pedidos en estado PENDIENTE");
        }
        
        if (pedido.getOrdenPrioridadCarga() != null) {
            throw new IllegalArgumentException("El pedido ya está en la cola de prioridad de carga");
        }
        
        // Obtener el máximo orden y agregar al final
        Integer maxOrden = pedidoRepository.findMaxOrdenPrioridadCarga();
        pedido.setOrdenPrioridadCarga(maxOrden + 1);
        pedido = pedidoRepository.save(pedido);
        
        return convertirADTO(pedido);
    }

    private PedidoDTO convertirADTO(Pedido pedido) {
        PedidoDTO dto = new PedidoDTO();
        dto.setId(pedido.getId());
        dto.setNumeroPlanilla(pedido.getNumeroPlanilla());
        dto.setEstado(pedido.getEstado());
        dto.setEtapaPreparacion(pedido.getEtapaPreparacion());
        dto.setUsuarioCreadorNombre(pedido.getUsuarioCreador().getNombreCompleto());
        dto.setFechaCreacion(pedido.getFechaCreacion());
        dto.setFechaActualizacion(pedido.getFechaActualizacion());
        dto.setFechaPendienteCarga(pedido.getFechaPendienteCarga());
        dto.setFechaEntrega(pedido.getFechaEntrega());
        dto.setOrdenPrioridadCarga(pedido.getOrdenPrioridadCarga());
        dto.setControlado(pedido.getControlado());

        if (pedido.getTransportista() != null) {
            dto.setTransportistaId(pedido.getTransportista().getId());
            dto.setTransportistaNombre(pedido.getTransportista().getNombre());
            // Para compatibilidad con frontend, mantener el campo transportista como string
            dto.setTransportista(pedido.getTransportista().getNombre());
        } else {
            // Si no hay transportista (pedidos antiguos), establecer valores por defecto
            dto.setTransportista("Sin transporte asignado");
        }

        if (pedido.getGrupoAsignado() != null) {
            dto.setGrupoId(pedido.getGrupoAsignado().getId());
            dto.setGrupoNombre(pedido.getGrupoAsignado().getNombre());
        }

        if (pedido.getZona() != null) {
            dto.setZonaId(pedido.getZona().getId());
            dto.setZonaNombre(pedido.getZona().getNombre());
        }

        dto.setCantidad(pedido.getCantidad());

        if (pedido.getVuelta() != null) {
            dto.setVueltaId(pedido.getVuelta().getId());
            dto.setVueltaNombre(pedido.getVuelta().getNombre());
        }

        return dto;
    }

    // Obtener planillas recibidas en el día actual
    public List<PedidoDTO> obtenerPlanillasRecibidasDelDia() {
        LocalDateTime inicioDia = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime finDia = inicioDia.plusDays(1);
        
        List<Pedido> pedidosDelDia = pedidoRepository.findByFechaCreacionBetween(inicioDia, finDia);
        
        return pedidosDelDia.stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    // Obtener resumen de transportistas con vueltas asignadas agrupadas por fecha de entrega
    public List<TransportistaVueltasDTO> obtenerResumenTransportistasVueltasDelDia() {
        // Obtener todos los transportistas activos
        List<com.Panelinformativo.transportistas.dto.TransportistaDTO> transportistas = transportistaService.obtenerTransportistasActivos();
        
        // Obtener todos los pedidos (no solo del día, para ver todas las fechas de entrega)
        List<Pedido> todosLosPedidos = pedidoRepository.findAll();
        
        // Agrupar vueltas por transportista y por fecha de entrega
        // Estructura: transportistaId -> fechaEntrega -> lista de vueltas
        Map<Long, Map<String, Set<String>>> vueltasPorTransportistaYFecha = new HashMap<>();
        for (Pedido pedido : todosLosPedidos) {
            if (pedido.getTransportista() != null && pedido.getVuelta() != null && pedido.getFechaEntrega() != null) {
                Long transportistaId = pedido.getTransportista().getId();
                String fechaEntrega = pedido.getFechaEntrega().toString(); // Formato: YYYY-MM-DD
                String vueltaNombre = pedido.getVuelta().getNombre();
                
                vueltasPorTransportistaYFecha
                    .computeIfAbsent(transportistaId, k -> new HashMap<>())
                    .computeIfAbsent(fechaEntrega, k -> new HashSet<>())
                    .add(vueltaNombre);
            }
        }
        
        // Construir el resumen
        List<TransportistaVueltasDTO> resumen = new ArrayList<>();
        for (com.Panelinformativo.transportistas.dto.TransportistaDTO transportista : transportistas) {
            Map<String, Set<String>> vueltasPorFecha = vueltasPorTransportistaYFecha.getOrDefault(transportista.getId(), new HashMap<>());
            
            // Convertir Set<String> a List<String> para cada fecha
            Map<String, List<String>> vueltasPorFechaList = new HashMap<>();
            for (Map.Entry<String, Set<String>> entry : vueltasPorFecha.entrySet()) {
                vueltasPorFechaList.put(entry.getKey(), new ArrayList<>(entry.getValue()));
            }
            
            TransportistaVueltasDTO dto = new TransportistaVueltasDTO();
            dto.setTransportistaId(transportista.getId());
            dto.setTransportistaNombre(transportista.getNombre());
            dto.setVueltasPorFecha(vueltasPorFechaList);
            
            resumen.add(dto);
        }
        
        return resumen;
    }
}

