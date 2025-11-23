# Panel Informativo - Sistema de Gestión de Pedidos

Sistema en red interna para gestión de pedidos entre oficina de administración y depósito, con actualización en tiempo real.

## 🚀 Características

- **Dos roles de usuario:**
  - **Administración**: Crear, editar y eliminar pedidos. Gestionar usuarios y grupos.
  - **Depósito**: Asignar grupos responsables y actualizar estados de pedidos.

- **Actualización en tiempo real** mediante WebSockets
- **Pantalla pública** para visualización en depósito (estilo pantallas de turnos)
- **Autenticación JWT** segura
- **Base de datos**: H2 para desarrollo, MySQL para producción

## 📋 Requisitos

- Java 21
- Node.js 20+ 
- Maven 3.6+
- MySQL 8.0+ (para producción)

## 🛠️ Instalación y Configuración

### Backend

1. Navegar a la carpeta backend:
```bash
cd backend
```

2. El proyecto usa Maven, las dependencias se descargarán automáticamente al compilar.

3. Configurar la base de datos en `src/main/resources/application.properties`:
   - **Desarrollo**: Ya configurado con H2 (en memoria)
   - **Producción**: Descomentar las líneas de MySQL y configurar:
     ```properties
     spring.datasource.url=jdbc:mysql://localhost:3306/panel_informativo
     spring.datasource.username=tu_usuario
     spring.datasource.password=tu_password
     ```

4. Ejecutar el backend:
```bash
# Windows
mvnw.cmd spring-boot:run

# Linux/Mac
./mvnw spring-boot:run
```

El backend estará disponible en `http://localhost:8080`

### Frontend

1. Navegar a la carpeta frontend:
```bash
cd frontend
```

2. Instalar dependencias:
```bash
npm install
```

3. Ejecutar en modo desarrollo:
```bash
npm run dev
```

El frontend estará disponible en `http://localhost:5173`

## 🎯 Uso del Sistema

### Primer Inicio

1. Acceder a `http://localhost:5173/registro-primer-admin`
2. Registrar el primer administrador (solo se puede hacer una vez)
3. Este administrador tendrá todos los permisos

### Login

1. Acceder a `http://localhost:5173/login`
2. Ingresar credenciales
3. El sistema redirigirá según el rol:
   - **ADMIN** → Panel de Administración
   - **DEPOSITO** → Panel de Depósito

### Panel de Administración

- **Gestión de Pedidos**: Crear nuevos pedidos con número de planilla, transportista y prioridad
- **Gestión de Grupos**: Crear grupos responsables para el armado de pedidos
- **Gestión de Usuarios**: Crear nuevos usuarios (quedan con rol DEPOSITO por defecto)

### Panel de Depósito

- **Asignar Grupos**: Asignar grupos responsables a cada pedido
- **Actualizar Estados**: Cambiar el estado de los pedidos (Pendiente → En Proceso → Realizado)
- **Filtros**: Ver pedidos por estado

### Pantalla Pública

- Acceder a `http://localhost:5173/pantalla`
- Muestra los pedidos pendientes y en proceso en tiempo real
- Ideal para proyectar en una pantalla en el depósito

## 🔧 Configuración para Producción

### Backend

1. Cambiar a MySQL en `application.properties`
2. Crear la base de datos:
```sql
CREATE DATABASE panel_informativo;
```

3. El sistema creará las tablas automáticamente al iniciar

### Frontend

1. Compilar para producción:
```bash
npm run build
```

2. Los archivos estarán en la carpeta `dist/`

3. Configurar el servidor web (nginx, Apache, etc.) para servir los archivos estáticos

## 📡 API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/registro-primer-admin` - Registrar primer administrador
- `POST /api/auth/registro` - Registrar nuevo usuario

### Pedidos
- `GET /api/pedidos` - Obtener todos los pedidos
- `GET /api/pedidos/estado/{estado}` - Obtener pedidos por estado
- `POST /api/pedidos` - Crear pedido (ADMIN)
- `PUT /api/pedidos/{id}` - Actualizar pedido (ADMIN)
- `PUT /api/pedidos/{id}/estado` - Actualizar estado (DEPOSITO)
- `PUT /api/pedidos/{id}/grupo` - Asignar grupo (DEPOSITO)
- `DELETE /api/pedidos/{id}` - Eliminar pedido (ADMIN)

### Grupos
- `GET /api/grupos` - Obtener todos los grupos
- `GET /api/grupos/activos` - Obtener grupos activos
- `POST /api/grupos` - Crear grupo (ADMIN)
- `PUT /api/grupos/{id}` - Actualizar grupo (ADMIN)
- `DELETE /api/grupos/{id}` - Eliminar grupo (ADMIN)

### Usuarios
- `GET /api/usuarios` - Obtener todos los usuarios (ADMIN)
- `PUT /api/usuarios/{id}/estado` - Actualizar estado usuario (ADMIN)
- `DELETE /api/usuarios/{id}` - Eliminar usuario (ADMIN)

## 🔐 Seguridad

- Autenticación basada en JWT
- Contraseñas encriptadas con BCrypt
- Roles y permisos por endpoint
- CORS configurado para desarrollo

## 📝 Notas

- El primer usuario registrado será siempre ADMIN
- Los usuarios registrados después serán DEPOSITO por defecto
- Los pedidos se actualizan en tiempo real mediante WebSockets
- La pantalla pública se actualiza automáticamente cada 30 segundos

## 🐛 Solución de Problemas

### Error de conexión a la base de datos
- Verificar que MySQL esté corriendo
- Verificar credenciales en `application.properties`
- Verificar que la base de datos exista

### Error de CORS
- Verificar que el frontend esté en `http://localhost:5173`
- Ajustar `corsConfigurationSource` en `SecurityConfig.java` si es necesario

### WebSocket no conecta
- Verificar que el backend esté corriendo
- Verificar la URL en `websocketService.js`

## 📄 Licencia

Este proyecto es de uso interno.

