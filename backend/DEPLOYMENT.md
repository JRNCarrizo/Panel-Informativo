# Guía de Despliegue en Producción

## 📋 Requisitos Previos

1. **Java 21** instalado en la computadora servidor
2. **MySQL** instalado y configurado
3. **Maven** (opcional, ya viene incluido con `mvnw`)
4. Acceso a la red interna de la empresa

---

## 🔧 Paso 1: Configurar MySQL

### 1.1. Instalar MySQL (si no está instalado)
- Descargar MySQL desde: https://dev.mysql.com/downloads/mysql/
- Instalar y configurar una contraseña para el usuario `root`

### 1.2. Crear la Base de Datos
Abrir MySQL Command Line Client o MySQL Workbench y ejecutar:

```sql
CREATE DATABASE panel_informativo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'panel_user'@'localhost' IDENTIFIED BY 'tu_password_seguro';
GRANT ALL PRIVILEGES ON panel_informativo.* TO 'panel_user'@'localhost';
FLUSH PRIVILEGES;
```

**Nota:** Reemplaza `tu_password_seguro` con una contraseña segura.

---

## 🔧 Paso 2: Configurar el Backend para Producción

### 2.1. Crear archivo de configuración de producción

Editar `src/main/resources/application-prod.properties` (crear si no existe) con:

```properties
# Application
spring.application.name=Proyecto-Panel-Informativo
server.port=8080
server.address=0.0.0.0

# JWT Configuration
jwt.secret=mySecretKey123456789012345678901234567890
jwt.expiration=2592000000

# MySQL Database (Production)
spring.datasource.url=jdbc:mysql://localhost:3306/panel_informativo?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
spring.datasource.username=panel_user
spring.datasource.password=tu_password_seguro
spring.jpa.database-platform=org.hibernate.dialect.MySQLDialect
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=false

# Logging
logging.level.com.Panelinformativo=INFO
logging.level.org.springframework.security=WARN
```

### 2.2. Compilar el Backend

En la carpeta `backend`, ejecutar:

**Windows (PowerShell/CMD):**
```cmd
.\mvnw.cmd clean package -DskipTests
```

**Linux/Mac:**
```bash
./mvnw clean package -DskipTests
```

Esto generará el archivo JAR en: `backend/target/Proyecto-Panel-Informativo-0.0.1-SNAPSHOT.jar`

---

## 🔧 Paso 3: Compilar el Frontend

### 3.1. Instalar dependencias (solo la primera vez)

En la carpeta `frontend`, ejecutar:

```cmd
npm install
```

### 3.2. Compilar para producción

```cmd
npm run build
```

Esto generará los archivos estáticos en: `frontend/dist/`

---

## 🔧 Paso 4: Integrar Frontend con Backend

### 4.1. Copiar archivos del frontend al backend

Copiar todo el contenido de `frontend/dist/` a `backend/src/main/resources/static/`

**Windows:**
```cmd
xcopy /E /I frontend\dist\* backend\src\main\resources\static\
```

**Linux/Mac:**
```bash
cp -r frontend/dist/* backend/src/main/resources/static/
```

### 4.2. Recompilar el backend

```cmd
.\mvnw.cmd clean package -DskipTests
```

---

## 🔧 Paso 5: Crear Scripts de Inicio

### 5.1. Script para Windows (iniciar.bat)

Crear archivo `iniciar.bat` en la carpeta `backend`:

```batch
@echo off
echo Iniciando Panel Informativo...
echo.
java -jar -Dspring.profiles.active=prod target\Proyecto-Panel-Informativo-0.0.1-SNAPSHOT.jar
pause
```

### 5.2. Script para iniciar como servicio (opcional)

Para que se inicie automáticamente al encender la computadora, usar **NSSM** (Non-Sucking Service Manager):

1. Descargar NSSM: https://nssm.cc/download
2. Instalar el servicio:
```cmd
nssm install PanelInformativo "C:\Program Files\Java\jdk-21\bin\java.exe" "-jar -Dspring.profiles.active=prod C:\ruta\al\backend\target\Proyecto-Panel-Informativo-0.0.1-SNAPSHOT.jar"
```

---

## 🔧 Paso 6: Obtener la IP de la Computadora Servidor

### 6.1. En Windows

Abrir PowerShell o CMD y ejecutar:

```cmd
ipconfig
```

Buscar la dirección IPv4 (ejemplo: `192.168.1.100`)

### 6.2. Configurar Firewall

Asegurarse de que el puerto 8080 esté abierto en el firewall de Windows:

1. Abrir "Firewall de Windows con seguridad avanzada"
2. Crear regla de entrada para el puerto 8080 (TCP)

---

## 🔧 Paso 7: Acceder desde Otras Computadoras

### 7.1. Desde la computadora de Depósito

Abrir el navegador y acceder a:

```
http://IP_DEL_SERVIDOR:8080
```

Ejemplo: `http://192.168.1.100:8080`

### 7.2. Crear acceso directo

1. Crear un acceso directo en el escritorio
2. Propiedades → Destino: `http://192.168.1.100:8080`
3. Cambiar el ícono si se desea

---

## 📝 Resumen de Pasos Rápidos

1. ✅ Instalar MySQL y crear base de datos
2. ✅ Configurar `application-prod.properties`
3. ✅ Compilar backend: `.\mvnw.cmd clean package -DskipTests`
4. ✅ Compilar frontend: `npm run build`
5. ✅ Copiar `frontend/dist/*` a `backend/src/main/resources/static/`
6. ✅ Recompilar backend
7. ✅ Crear script `iniciar.bat`
8. ✅ Obtener IP del servidor
9. ✅ Abrir puerto 8080 en firewall
10. ✅ Acceder desde otras computadoras: `http://IP:8080`

---

## 🔒 Seguridad Adicional (Recomendado)

1. **Cambiar la clave JWT** en `application-prod.properties` por una más segura
2. **Usar HTTPS** (requiere certificado SSL)
3. **Configurar backup automático** de la base de datos MySQL
4. **Limitar acceso** por IP si es necesario

---

## 🆘 Solución de Problemas

### El backend no inicia
- Verificar que Java 21 esté instalado: `java -version`
- Verificar que MySQL esté corriendo
- Revisar los logs en la consola

### No puedo acceder desde otra computadora
- Verificar que el firewall permita el puerto 8080
- Verificar que ambas computadoras estén en la misma red
- Verificar la IP del servidor: `ipconfig`

### Error de conexión a MySQL
- Verificar que MySQL esté corriendo
- Verificar usuario y contraseña en `application-prod.properties`
- Verificar que la base de datos exista

