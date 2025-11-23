# 🧪 Guía de Pruebas del Sistema

## 🚀 Inicio del Sistema

### 1. Iniciar el Backend

En una terminal, ejecuta:

```bash
cd backend
mvn spring-boot:run
```

**Espera hasta que veas:**
```
Started ProyectoPanelInformativoApplication in X.XXX seconds
```

El backend estará disponible en: `http://localhost:8080`

### 2. Iniciar el Frontend

En otra terminal (mantén el backend corriendo), ejecuta:

```bash
cd frontend
npm run dev
```

**Espera hasta que veas:**
```
VITE vX.X.X  ready in XXX ms
➜  Local:   http://localhost:5173/
```

El frontend estará disponible en: `http://localhost:5173`

---

## ✅ Pruebas Paso a Paso

### **Paso 1: Registrar el Primer Administrador** 👑

1. Abre tu navegador en: `http://localhost:5173`
2. Deberías ser redirigido a `/login`
3. Haz clic en: **"Registrar Administrador Principal"** (o ve a `/registro-primer-admin`)
4. Completa el formulario:
   - **Usuario:** `admin`
   - **Nombre Completo:** `Administrador Principal`
   - **Contraseña:** `admin123` (o la que prefieras)
5. Haz clic en **"Registrar"**
6. **Resultado esperado:** Deberías ser redirigido al Panel de Administración automáticamente

---

### **Paso 2: Probar el Login** 🔐

1. Cierra la sesión (botón "Salir" en el panel)
2. Verás la pantalla de login
3. Ingresa las credenciales:
   - **Usuario:** `admin`
   - **Contraseña:** `admin123`
4. Haz clic en **"Ingresar"**
5. **Resultado esperado:** Deberías ingresar al Panel de Administración

---

### **Paso 3: Crear Grupos** 👥

1. En el Panel de Administración, ve a la pestaña **"Grupos"**
2. Haz clic en **"Nuevo Grupo"**
3. Ingresa el nombre: `Grupo A`
4. Haz clic en **"Crear"**
5. **Resultado esperado:** El grupo aparece en la lista
6. Repite para crear más grupos: `Grupo B`, `Grupo C`

---

### **Paso 4: Crear Pedidos** 📦

1. Ve a la pestaña **"Pedidos"**
2. Haz clic en **"Nuevo Pedido"**
3. Completa el formulario:
   - **Número de Planilla:** `PLAN-001`
   - **Transportista:** `Transportes XYZ`
   - **Prioridad:** `ALTA`
4. Haz clic en **"Crear"**
5. **Resultado esperado:** El pedido aparece en la lista con estado "PENDIENTE"
6. Crea más pedidos con diferentes prioridades:
   - `PLAN-002` - `Transportes ABC` - Prioridad: `URGENTE`
   - `PLAN-003` - `Transportes 123` - Prioridad: `NORMAL`

---

### **Paso 5: Crear Usuario de Depósito** 👤

1. Ve a la pestaña **"Usuarios"**
2. Haz clic en **"Nuevo Usuario"**
3. Completa el formulario:
   - **Usuario:** `deposito1`
   - **Nombre Completo:** `Operador Depósito`
   - **Contraseña:** `deposito123`
4. Haz clic en **"Crear"**
5. **Resultado esperado:** El usuario aparece en la lista con rol "DEPOSITO"

---

### **Paso 6: Probar Panel de Depósito** 🏭

1. Cierra sesión (botón "Salir")
2. Inicia sesión con el usuario de depósito:
   - **Usuario:** `deposito1`
   - **Contraseña:** `deposito123`
3. **Resultado esperado:** Deberías entrar al Panel de Depósito (verde)

#### En el Panel de Depósito:

1. Verás los pedidos filtrados por **"Pendientes"** (filtro activo por defecto)
2. Para cada pedido puedes:
   - **Asignar Grupo:** Selecciona un grupo del dropdown
   - **Cambiar Estado:** Selecciona el nuevo estado
3. Prueba asignar grupos y cambiar estados:
   - Asigna `Grupo A` al pedido `PLAN-001`
   - Cambia el estado a `EN_PROCESO`
   - **Resultado esperado:** El pedido se actualiza en tiempo real

4. Cambia el filtro a **"En Proceso"** para ver los pedidos en proceso
5. Cambia el estado de un pedido a **"REALIZADO"**
6. Cambia el filtro a **"Realizados"** para ver los pedidos completados

---

### **Paso 7: Probar Pantalla Pública** 📺

1. Abre una **nueva pestaña** del navegador (mantén la sesión activa en la otra)
2. Ve a: `http://localhost:5173/pantalla`
3. **Resultado esperado:** Deberías ver:
   - **Columna izquierda:** Pedidos Pendientes (naranja)
   - **Columna derecha:** Pedidos En Proceso (azul)
   - Actualización automática cada 30 segundos

4. **Prueba de actualización en tiempo real:**
   - En la pestaña del Panel de Depósito, cambia el estado de un pedido
   - Observa la pantalla pública (debería actualizarse automáticamente vía WebSocket)

---

### **Paso 8: Probar Eliminación (Admin)** 🗑️

1. Vuelve a la pestaña del Panel de Administración (o cierra sesión y vuelve a entrar como admin)
2. En la pestaña **"Pedidos"**
3. Haz clic en **"Eliminar"** en algún pedido
4. Confirma la eliminación
5. **Resultado esperado:** El pedido desaparece de la lista y de la pantalla pública (si estaba visible)

---

## 🔍 Verificaciones Adicionales

### Verificar Base de Datos H2 (Opcional)

1. Con el backend corriendo, ve a: `http://localhost:8080/h2-console`
2. Configuración:
   - **JDBC URL:** `jdbc:h2:mem:testdb`
   - **Usuario:** `sa`
   - **Contraseña:** (déjalo vacío)
3. Haz clic en **"Connect"**
4. Ejecuta: `SELECT * FROM usuarios;`
5. Deberías ver los usuarios creados

---

## ✅ Checklist de Funcionalidades

- [ ] Registrar primer administrador
- [ ] Login con administrador
- [ ] Crear grupos
- [ ] Crear pedidos
- [ ] Crear usuarios de depósito
- [ ] Login con usuario de depósito
- [ ] Asignar grupos a pedidos
- [ ] Cambiar estados de pedidos
- [ ] Ver pantalla pública
- [ ] Actualización en tiempo real (WebSocket)
- [ ] Eliminar pedidos (como admin)
- [ ] Filtros por estado en panel de depósito

---

## 🐛 Si algo no funciona

### Backend no inicia
- Verifica que el puerto 8080 esté libre
- Revisa los logs en la consola
- Verifica que Java 21 esté instalado

### Frontend no inicia
- Verifica que Node.js esté instalado
- Ejecuta `npm install` en la carpeta frontend
- Verifica que el puerto 5173 esté libre

### Error de conexión
- Verifica que ambos (backend y frontend) estén corriendo
- Revisa la consola del navegador (F12) para ver errores
- Verifica que las URLs en `axios.js` sean correctas (`http://localhost:8080`)

### WebSocket no funciona
- Verifica que el backend esté corriendo
- Revisa la consola del navegador para errores de conexión
- Verifica que no haya un firewall bloqueando la conexión

---

## 🎯 Pruebas Rápidas (Resumen)

1. **Backend:** `mvn spring-boot:run` → Espera mensaje "Started"
2. **Frontend:** `npm run dev` → Espera URL local
3. **Registrar Admin:** `/registro-primer-admin` → Crear primer usuario
4. **Login:** Usar credenciales creadas
5. **Crear Pedidos:** Panel Admin → Pestaña Pedidos → Nuevo Pedido
6. **Asignar Grupos:** Panel Depósito → Asignar grupo y cambiar estado
7. **Ver Pantalla:** `/pantalla` → Ver actualización en tiempo real

¡Listo! Ahora tienes todo funcionando con arquitectura modular. 🎉

