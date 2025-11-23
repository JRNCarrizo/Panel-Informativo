package com.Panelinformativo.transportistas.service;

import com.Panelinformativo.transportistas.dto.TransportistaDTO;
import com.Panelinformativo.transportistas.model.Transportista;
import com.Panelinformativo.transportistas.repository.TransportistaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TransportistaService {
    private final TransportistaRepository transportistaRepository;

    @Transactional
    public TransportistaDTO crearTransportista(String codigoInterno, String chofer, String vehiculo) {
        if (transportistaRepository.findByCodigoInterno(codigoInterno).isPresent()) {
            throw new IllegalArgumentException("Ya existe un transportista con ese código interno");
        }

        Transportista transportista = new Transportista();
        transportista.setCodigoInterno(codigoInterno);
        transportista.setChofer(chofer);
        transportista.setVehiculo(vehiculo);
        transportista.setActivo(true);

        transportista = transportistaRepository.save(transportista);
        return convertirADTO(transportista);
    }

    public List<TransportistaDTO> obtenerTodosLosTransportistas() {
        return transportistaRepository.findAllByOrderByCodigoInternoAsc().stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    public List<TransportistaDTO> obtenerTransportistasActivos() {
        return transportistaRepository.findByActivoTrueOrderByCodigoInternoAsc().stream()
                .map(this::convertirADTO)
                .collect(Collectors.toList());
    }

    public TransportistaDTO obtenerTransportistaPorId(Long id) {
        Transportista transportista = transportistaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Transportista no encontrado"));
        return convertirADTO(transportista);
    }

    @Transactional
    public TransportistaDTO actualizarTransportista(Long id, String codigoInterno, String chofer, String vehiculo, Boolean activo) {
        Transportista transportista = transportistaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Transportista no encontrado"));

        if (codigoInterno != null && !codigoInterno.equals(transportista.getCodigoInterno())) {
            if (transportistaRepository.findByCodigoInterno(codigoInterno).isPresent()) {
                throw new IllegalArgumentException("Ya existe un transportista con ese código interno");
            }
            transportista.setCodigoInterno(codigoInterno);
        }

        if (chofer != null) {
            transportista.setChofer(chofer);
        }

        if (vehiculo != null) {
            transportista.setVehiculo(vehiculo);
        }

        if (activo != null) {
            transportista.setActivo(activo);
        }

        transportista = transportistaRepository.save(transportista);
        return convertirADTO(transportista);
    }

    @Transactional
    public void eliminarTransportista(Long id) {
        Transportista transportista = transportistaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Transportista no encontrado"));
        
        // En lugar de eliminar físicamente, desactivar el transportista
        // Esto evita problemas de integridad referencial con pedidos asociados
        transportista.setActivo(false);
        transportistaRepository.save(transportista);
    }

    private TransportistaDTO convertirADTO(Transportista transportista) {
        TransportistaDTO dto = new TransportistaDTO();
        dto.setId(transportista.getId());
        dto.setCodigoInterno(transportista.getCodigoInterno());
        dto.setChofer(transportista.getChofer());
        dto.setVehiculo(transportista.getVehiculo());
        dto.setActivo(transportista.getActivo());
        return dto;
    }
}

