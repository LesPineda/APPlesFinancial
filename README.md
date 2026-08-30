# Backend de Finanzas Personales

Este proyecto es la inicialización del backend para una aplicación de finanzas personales diseñada para mejorar el flujo de caja, enviar alertas tempranas de pago y optimizar la liquidación de deudas.

## Stack Tecnológico

- **Node.js** con **Express** y **TypeScript** para un desarrollo rápido, tipado seguro y arquitectura limpia en capas.
- **PostgreSQL** como motor de base de datos relacional para garantizar consistencia transaccional.
- **Prisma ORM** v6 para la gestión de datos, esquemas de tablas y migraciones automatizadas.

---

## Estructura del Código

- `prisma/schema.prisma`: Esquema de Prisma que define las tablas `cuentas`, `transacciones`, y `deudas`.
- `src/app.ts`: Punto de entrada que inicializa Express, Cors, el analizador de JSON, la ruta de salud y el middleware global de manejo de errores.
- `src/config/database.ts`: Exporta el cliente de Prisma para consultas en toda la aplicación.
- `src/middlewares/`:
  - `error.middleware.ts`: Maneja de manera centralizada los errores HTTP (`AppError`) y errores de restricción única o de registro inexistente de Prisma.
  - `validation.middleware.ts`: Middleware de verificación básica de campos obligatorios en peticiones HTTP POST.
- `src/services/` y `src/controllers/`: Contienen la lógica de negocio y los controladores HTTP para `Accounts`, `Transactions`, `Debts` y `Webhooks`.

---

## Configuración Inicial

### 1. Requisitos Previos

- **Node.js**: v20.9.0 o superior (compatible con Prisma 6).
- **PostgreSQL**: Instancia activa y con base de datos creada.

### 2. Variables de Entorno

Crea o edita el archivo `.env` en la raíz del proyecto y ajusta la cadena de conexión de PostgreSQL:

```env
PORT=3000
DATABASE_URL="postgresql://USUARIO:CONTRASEÑA@localhost:5432/NOMBRE_BD?schema=public"
```

### 3. Instalar Dependencias

```bash
npm install
```

### 4. Generar Cliente y Migraciones de Prisma

Si la base de datos ya está configurada en tu archivo `.env`, ejecuta lo siguiente para aplicar el esquema físico y crear las tablas:

```bash
npm run prisma:migrate
```

*Nota: Si sólo deseas generar los tipos estáticos de Prisma sin realizar migraciones físicas inmediatas, puedes correr:*

```bash
npx prisma generate
```

---

## Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo local con recarga en caliente (`ts-node-dev`).
- `npm run build`: Compila los archivos TypeScript a JavaScript nativo en la carpeta `dist`.
- `npm run start`: Inicia el servidor a partir de los archivos compilados en `dist`.
- `npm run prisma:migrate`: Corre las migraciones de Prisma sobre tu base de datos PostgreSQL.
- `npm run prisma:studio`: Abre la consola visual de Prisma en tu navegador para interactuar con los datos.

---

## Documentación de Endpoints (API)

Todas las rutas están bajo el prefijo `/api`.

### 1. Cuentas (`/api/accounts`)
Representa cuentas de banco, tarjetas de crédito o efectivo.

- **GET `/api/accounts`**: Retorna la lista de todas las cuentas.
- **GET `/api/accounts/:id`**: Retorna el detalle de una cuenta específica.
- **POST `/api/accounts`**: Crea una nueva cuenta.
  - *Payload*:
    ```json
    {
      "nombre": "Nequi",
      "tipo": "DEBITO", // DEBITO, CREDITO o EFECTIVO
      "saldo_actual": 150000.00
    }
    ```
- **PUT `/api/accounts/:id`**: Actualiza campos específicos de la cuenta.
- **DELETE `/api/accounts/:id`**: Elimina la cuenta.

### 2. Transacciones (`/api/transactions`)
Ingresos o gastos que modifican el saldo de la cuenta de forma atómica.

- **GET `/api/transactions`**: Retorna todas las transacciones ordenadas por fecha.
- **GET `/api/transactions/:id`**: Detalle de una transacción.
- **POST `/api/transactions`**: Registra una nueva transacción y actualiza automáticamente el saldo (`saldo_actual`) de la cuenta asociada.
  - *Payload*:
    ```json
    {
      "cuenta_id": "UUID-CUENTA",
      "tipo": "GASTO", // INGRESO o GASTO
      "monto": 25000.00,
      "fecha_transaccion": "2026-08-05T07:30:00Z",
      "descripcion": "Compra en supermercado"
    }
    ```
- **PUT `/api/transactions/:id`**: Modifica la transacción y reajusta automáticamente los saldos de las cuentas afectadas (antigua y nueva, si cambia de cuenta).
- **DELETE `/api/transactions/:id`**: Elimina la transacción y revierte de forma atómica el saldo de la cuenta.

### 3. Deudas (`/api/debts`)
Obligaciones financieras con detalles de intereses y plazos de pago.

- **GET `/api/debts`**: Retorna todas las deudas vigentes.
- **POST `/api/debts`**: Registra una nueva deuda vinculada a una cuenta.
  - *Payload*:
    ```json
    {
      "cuenta_id": "UUID-CUENTA",
      "saldo_total": 4500000.00,
      "tasa_interes_ea": 28.50, // Tasa Efectiva Anual en %
      "pago_minimo": 180000.00,
      "fecha_corte": "2026-08-15T00:00:00Z",
      "fecha_limite_pago": "2026-09-01T00:00:00Z"
    }
    ```
- **PUT `/api/debts/:id`**: Actualiza los detalles de la deuda.
- **DELETE `/api/debts/:id`**: Elimina la deuda.

#### 📈 Priorización de Deudas (`GET /api/debts/prioritize?method=...`)
Servicio que retorna las deudas ordenadas bajo las dos metodologías financieras estándar:
- **Avalancha (`GET /api/debts/prioritize?method=Avalancha`)**: Ordena las deudas de **mayor a menor tasa de interés** (`tasa_interes_ea` desc). Ideal para ahorrar dinero en intereses totales.
- **Bola de Nieve (`GET /api/debts/prioritize?method=Bola de Nieve`)**: Ordena las deudas de **menor a mayor saldo total** (`saldo_total` asc). Ideal para el refuerzo motivacional rápido al liquidar saldos pequeños primero.

---

### 4. Webhooks para Automatización (`POST /api/webhooks/transactions`)
Endpoint diseñado para recibir payloads estructurados de plataformas externas (Open Finance, parseadores de notificaciones o SMS bancarios de Nequi o Davivienda).

- **Payload**:
  ```json
  {
    "cuenta_nombre": "Davivienda",
    "monto": 45000.00,
    "tipo": "GASTO", // INGRESO o GASTO
    "fecha": "2026-08-05T07:45:00Z",
    "descripcion": "Pago PSE en comercio"
  }
  ```

#### Comportamiento Resiliente:
1. Si no existe una cuenta con el nombre proporcionado (por ejemplo, `"Davivienda"`), el sistema **crea automáticamente la cuenta** con tipo `DEBITO` y saldo inicial de `$0.00`.
2. Registra la transacción con la fecha y descripción correspondientes.
3. Actualiza de manera **atómica** (mediante transacción de base de datos de Prisma) el saldo de la cuenta sumando (`INGRESO`) o restando (`GASTO`) el monto del payload.
