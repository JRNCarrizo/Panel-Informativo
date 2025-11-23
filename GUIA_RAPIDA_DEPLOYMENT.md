# 🚀 Guía Rápida de Despliegue

## Resumen Ejecutivo

Esta guía te ayudará a desplegar el Panel Informativo en la computadora de la empresa para que:
- ✅ Se pueda abrir fácilmente como cualquier aplicación
- ✅ Otras computadoras en la red puedan acceder
- ✅ Todo funcione de forma estable y profesional

---

## 📋 Checklist de Preparación

### En la Computadora Servidor (Administración):

- [ ] Java 21 instalado
- [ ] MySQL instalado y corriendo
- [ ] Base de datos `panel_informativo` creada
- [ ] Usuario MySQL creado con permisos
- [ ] Firewall configurado (puerto 8080 abierto)
- [ ] IP de la computadora anotada

### En las Computadoras Cliente (Depósito):

- [ ] Navegador web instalado (Chrome, Edge, Firefox)
- [ ] Conectadas a la misma red que el servidor

---

## 🔧 Pasos de Instalación (Una Sola Vez)

### 1. Configurar MySQL

```sql
CREATE DATABASE panel_informativo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'panel_user'@'localhost' IDENTIFIED BY 'tu_password_seguro';
GRANT ALL PRIVILEGES ON panel_informativo.* TO 'panel_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Configurar Backend

1. Editar `backend/src/main/resources/application-prod.properties`
2. Cambiar:
   - `spring.datasource.username=panel_user`
   - `spring.datasource.password=tu_password_seguro` (el que creaste arriba)

### 3. Compilar Todo

**En la carpeta `backend`:**
```cmd
.\mvnw.cmd clean package -DskipTests
```

**En la carpeta `frontend`:**
```cmd
npm install
npm run build
```

### 4. Integrar Frontend con Backend

**Windows:**
```cmd
xcopy /E /I frontend\dist\* backend\src\main\resources\static\
```

**Linux/Mac:**
```bash
cp -r frontend/dist/* backend/src/main/resources/static/
```

### 5. Recompilar Backend

```cmd
cd backend
.\mvnw.cmd clean package -DskipTests
```

### 6. Obtener la IP del Servidor

```cmd
ipconfig
```

Buscar "Dirección IPv4" (ejemplo: `192.168.1.100`)

### 7. Configurar Firewall

1. Abrir "Firewall de Windows con seguridad avanzada"
2. Reglas de entrada → Nueva regla
3. Puerto → TCP → 8080
4. Permitir conexión
5. Aplicar a todos los perfiles
6. Nombre: "Panel Informativo - Puerto 8080"

---

## 🎯 Uso Diario

### En la Computadora Servidor:

**Opción 1: Doble clic en el script**
- Hacer doble clic en `backend/iniciar.bat`
- La aplicación se iniciará automáticamente

**Opción 2: Desde la línea de comandos**
```cmd
cd backend
.\iniciar.bat
```

### En las Computadoras Cliente (Depósito):

1. Abrir navegador
2. Ir a: `http://IP_DEL_SERVIDOR:8080`
   - Ejemplo: `http://192.168.1.100:8080`
3. Iniciar sesión

### Crear Acceso Directo en Cliente:

1. Clic derecho en escritorio → Nuevo → Acceso directo
2. Ubicación: `http://192.168.1.100:8080`
3. Nombre: "Panel Informativo"
4. Cambiar ícono (opcional)

---

## 🔄 Actualizar la Aplicación

Cuando necesites actualizar:

1. **Detener** la aplicación (Ctrl+C en la ventana del servidor)
2. **Compilar** nuevamente (pasos 3-5 de instalación)
3. **Reiniciar** con `iniciar.bat`

---

## 🆘 Solución de Problemas

### "No puedo acceder desde otra computadora"
- ✅ Verificar que el firewall permita el puerto 8080
- ✅ Verificar que ambas estén en la misma red
- ✅ Verificar la IP: `ipconfig` en el servidor

### "Error al iniciar - Java no encontrado"
- ✅ Instalar Java 21 desde: https://adoptium.net/
- ✅ Verificar instalación: `java -version`

### "Error de conexión a MySQL"
- ✅ Verificar que MySQL esté corriendo
- ✅ Verificar usuario y contraseña en `application-prod.properties`
- ✅ Verificar que la base de datos exista

### "La página no carga"
- ✅ Verificar que el backend esté corriendo
- ✅ Verificar que los archivos estén en `backend/src/main/resources/static/`
- ✅ Recompilar frontend y backend

---

## 📞 Información Importante

- **Puerto:** 8080
- **URL Local:** http://localhost:8080
- **URL Red:** http://[IP_SERVIDOR]:8080
- **Base de Datos:** MySQL (panel_informativo)
- **Perfil de Producción:** `prod` (usa `application-prod.properties`)

---

## 🔒 Seguridad

1. **Cambiar la clave JWT** en `application-prod.properties`:
   ```properties
   jwt.secret=una_clave_muy_larga_y_segura_aqui
   ```

2. **Usar contraseña segura** para MySQL

3. **Backup regular** de la base de datos MySQL

---

## 📝 Notas Finales

- El servidor debe estar encendido para que las otras computadoras puedan acceder
- Si cambia la IP del servidor, actualizar los accesos directos en los clientes
- Considerar usar una IP fija (estática) para el servidor

