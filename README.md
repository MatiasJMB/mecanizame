# Mecanízame

CRM multi-tenant para talleres mecánicos diésel (Chile). Cada taller gestiona sus
clientes, vehículos, servicios y órdenes de trabajo; un panel de super-admin administra
los talleres de la plataforma, sus cobros y aprobaciones.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 19 · TypeScript · Vite · React Router 7 · Tailwind CSS v4 |
| Backend de datos | Supabase (PostgreSQL + Auth + RLS) |
| Backend WhatsApp | Node/Express + Baileys |

El aislamiento entre talleres (multi-tenancy) se aplica en la base con **Row Level
Security** sobre `current_org_id()`; las mutaciones sensibles pasan por RPCs
`SECURITY DEFINER`. Un mismo usuario puede pertenecer a varios talleres con distintos
roles (dueño / administrador / empleado) y cambiar entre ellos.

## Estructura

```
frontend/
  src/
    api/        Capa de acceso a datos: envuelve las RPCs de Supabase en funciones tipadas
    components/ Componentes de UI reutilizables
    context/    Providers de React (Auth, Theme, Search)
    hooks/      Hooks reutilizables
    lib/        Utilidades puras (formato, billing, roles, errores…)
    pages/      Vistas por ruta
    types/      Tipos de dominio compartidos
backend/        Servicio Node/Baileys (WhatsApp)
supabase/
  migrations/   Esquema y RPCs versionados (aplicar en orden)
```

El alias `@/` apunta a `frontend/src`.

## Correr en local

Requisitos: Node 20+, Docker (para Supabase local) y el CLI de Supabase.

```bash
# 1) Backend de datos (Supabase local)
supabase start                       # levanta Postgres + Auth + Studio

# 2) Frontend
cd frontend
cp .env.example .env.local           # completa las variables de Supabase local
npm install
npm run dev                          # http://localhost:5173
```

Studio (dashboard local): http://localhost:54323

### Provisión del super-admin

El super-admin **no** se otorga por email en el registro. Tras registrar la cuenta,
se asigna a mano sobre la base:

```bash
docker exec -i supabase_db_<proyecto> psql -U postgres < supabase/seed_super_admin.sql
```

## Variables de entorno

Ver `frontend/.env.example`. Las claves locales de Supabase son de demostración; en
producción se usan las del proyecto real. Nunca se commitea `.env.local`.

---

Proyecto personal. Todos los derechos reservados.
