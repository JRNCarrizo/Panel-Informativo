package com.Panelinformativo.mensajes.repository;

import com.Panelinformativo.mensajes.model.Mensaje;
import com.Panelinformativo.usuarios.model.Rol;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface MensajeRepository extends JpaRepository<Mensaje, Long> {
    // Buscar mensajes del día actual
    List<Mensaje> findByFechaDiaOrderByFechaCreacionAsc(LocalDate fechaDia);

    // Buscar mensajes no leídos para un rol destinatario específico
    List<Mensaje> findByRolDestinatarioAndLeidoFalseOrderByFechaCreacionAsc(Rol.TipoRol rolDestinatario);

    // Buscar mensajes no leídos del día actual para un rol
    List<Mensaje> findByRolDestinatarioAndFechaDiaAndLeidoFalseOrderByFechaCreacionAsc(
            Rol.TipoRol rolDestinatario, LocalDate fechaDia);

    // Contar mensajes no leídos del día actual para un rol
    long countByRolDestinatarioAndFechaDiaAndLeidoFalse(Rol.TipoRol rolDestinatario, LocalDate fechaDia);

    // Eliminar mensajes de días anteriores
    void deleteByFechaDiaBefore(LocalDate fecha);
}

