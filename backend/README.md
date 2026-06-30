# Backend Ahora Pan

Backend Node.js/Express que mantiene conectado el bot de WhatsApp, expone endpoints para acciones del dashboard y coordina notificaciones, pedidos, sesiones del bot, ALERTA PAN y pagos SumUp.

## Responsabilidades

- Conectar WhatsApp mediante Baileys.
- Procesar mensajes entrantes del cliente.
- Mantener sesiones conversacionales en Supabase (`bot_sessions`).
- Crear pedidos (`orders`) desde el flujo del bot.
- Enviar notificaciones WhatsApp por cambios de estado.
- Ejecutar broadcast premium ALERTA PAN.
- Crear y validar checkouts SumUp.
- Invitar clientes individualmente o en lote.
- Aplicar reglas server-side de autorizacion por panaderia.

## Stack

| Area | Tecnologia |
| --- | --- |
| Runtime | Node.js |
| API | Express 5 |
| Lenguaje | TypeScript |
| WhatsApp | `@whiskeysockets/baileys` |
| Base de datos | Supabase Postgres |
| Realtime | Supabase Realtime |
| Pagos | SumUp API |
| Logs | Pino + `console` |
| Seguridad API | Supabase Auth token + rate limit |

## Estructura

```text
backend/
  src/
    index.ts                    Entry point: Express, Baileys, endpoints y arranque
    bot/
      flow.handler.ts           Maquina de estados del bot WhatsApp
    database/
      supabase.ts               Cliente Supabase del backend
    services/
      bakery.service.ts         Horarios y strikes
      notification.service.ts   Suscripcion Realtime de respaldo
      order.service.ts          Codigos cortos de pedidos
      session.service.ts        Sesiones persistentes del bot
    types/
      index.ts                  Tipos de carrito, producto y estado
    utils/
      constants.ts              Saludos, opciones y rate limit conversacional
      formatter.ts              Formato de cantidades
  auth_info_baileys/            Sesion local de WhatsApp, no versionar
  scratch/                      Scripts de prueba/mantenimiento
```

## Variables de entorno

Copia el ejemplo:

```bash
cp .env.example .env
```

Contenido esperado:

```env
PORT=3000

SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_solo_backend
SUPABASE_KEY=tu_anon_key_opcional

FRONTEND_APP_URL=http://localhost:5173

SUMUP_API_KEY=
SUMUP_MERCHANT_CODE=
```

Notas importantes:

- `SUPABASE_SERVICE_ROLE_KEY` debe vivir solo en backend. Nunca debe llegar al frontend.
- Si no existe `SUPABASE_SERVICE_ROLE_KEY`, el cliente usa `SUPABASE_KEY` como fallback, pero para sesiones del bot y operaciones internas se recomienda service role.
- `FRONTEND_APP_URL` se usa para redirigir de vuelta desde SumUp.
- `SUMUP_API_KEY` y `SUMUP_MERCHANT_CODE` solo son necesarios para ALERTA PAN con pagos reales.

## Instalacion y desarrollo

```bash
npm install
npm run dev
```

Al iniciar por primera vez, Baileys imprime un QR en la terminal. Escanealo desde WhatsApp para vincular el numero del bot.

La sesion queda guardada en:

```text
backend/auth_info_baileys/
```

Ese directorio es sensible: contiene credenciales de WhatsApp y debe mantenerse fuera de Git.

## Scripts

```bash
npm run dev      # desarrollo con ts-node-dev
npm run build    # compila TypeScript a dist/
npm start        # ejecuta dist/index.js
```

## Endpoints

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/` | Health check. |
| `POST` | `/api/notify-status` | Notifica por WhatsApp cambios de estado de pedidos. |
| `POST` | `/api/broadcast` | Envia ALERTA PAN a clientes de una panaderia. |
| `GET` | `/api/alerta-pan/access-status` | Consulta/actualiza estado premium, incluyendo checkouts pendientes de SumUp. |
| `POST` | `/api/alerta-pan/create-checkout` | Crea checkout SumUp para ALERTA PAN. |
| `POST` | `/api/alerta-pan/simulate-success` | Simula pago exitoso para pruebas. |
| `POST` | `/api/invite-customer` | Envia invitacion individual por WhatsApp. |
| `POST` | `/api/invite-customers-bulk` | Envia invitaciones masivas con delay en segundo plano. |

Los endpoints que operan sobre una panaderia validan el token de Supabase recibido en:

```http
Authorization: Bearer <access_token>
```

## Flujo WhatsApp

El bot se implementa en `src/bot/flow.handler.ts`.

Flujo resumido:

1. Cliente escribe `hola`, `menu`, `pan`, `ayuda` u otro saludo soportado.
2. El bot revisa si existe una ultima panaderia usada para ofrecer fast track.
3. Si no hay fast track, pide region, comuna y ciudad/sector.
4. Muestra panaderias activas.
5. Valida horario, productos activos y strikes.
6. Muestra categorias y menu.
7. El cliente elige cantidad por kilo o unidades.
8. El carrito se confirma.
9. Se crea una orden en `orders` con estado `PENDING`.
10. El dashboard recibe el pedido por Supabase Realtime.

La sesion del cliente se guarda en `bot_sessions` para no perder el paso si el proceso se reinicia o si el usuario tarda en responder.

## Estados de pedido

| Estado | Uso |
| --- | --- |
| `PENDING` | Pedido recibido y pendiente de preparacion. |
| `READY` | Pedido listo; se notifica al cliente y corre temporizador de retiro. |
| `DELIVERED` | Pedido entregado; se notifica y se elimina. |
| `REJECTED` | Pedido cancelado; se notifica y se elimina. |
| `EXPIRED` | Pedido vencido por no retiro; suma strike y se elimina. |

## Reglas de negocio

- Rate limit conversacional por cliente: `RATE_LIMIT_MS`.
- Maximo 2 pedidos activos por cliente entre `PENDING` y `READY`.
- Horarios se evaluan en zona `America/Santiago`.
- Una panaderia inactiva (`is_active = false`) no aparece para clientes.
- Los strikes se contabilizan por relacion `bakery_customers`.
- ALERTA PAN requiere `is_alert_unlocked`, admin global o pago SumUp vigente.
- El admin global esta actualmente hardcodeado como `matias.moreno101@gmail.com`.

## Integracion con Supabase

El backend usa:

- `bakeries`
- `products`
- `categories`
- `orders`
- `customers`
- `bakery_customers`
- `bot_sessions`
- `profiles`
- `invitation_keys`
- `settings`

Para que Realtime funcione, `orders` debe estar agregado a la publicacion `supabase_realtime`.

## Deploy

Build:

```bash
npm ci --omit=dev
npm run build
npm start
```

Recomendado en produccion:

- Ejecutar con PM2, systemd o Docker.
- Mantener persistente `auth_info_baileys/`.
- Usar variables de entorno reales del servidor.
- Restringir CORS a los dominios del frontend.
- Exponer solo el puerto/API necesario.

Ejemplo PM2:

```bash
pm2 start dist/index.js --name ahora-pan-bot
pm2 save
```

## Riesgos y mejoras pendientes

- `src/index.ts` concentra endpoints, pagos, WhatsApp y autorizacion. Conviene separar rutas/controladores.
- `/api/notify-status` y la suscripcion Realtime de `notification.service.ts` pueden duplicar avisos `READY` si no se controla idempotencia.
- El admin global deberia salir de una variable de entorno o de `profiles.role`.
- CORS esta abierto en desarrollo. En produccion debe restringirse.
- No hay tests automatizados para el flujo conversacional ni endpoints criticos.
- Los mensajes del bot estan acoplados al rubro panaderia; para escalar a barberias u otros rubros conviene parametrizar textos y pasos.

