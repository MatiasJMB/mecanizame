# Frontend Ahora Pan

Dashboard web de Ahora Pan construido con React, Vite, TypeScript y Tailwind CSS.

Este README existe solo como referencia rapida del paquete frontend. La documentacion completa del proyecto esta en el README de la raiz y en `docs/PROJECT_DOCUMENTATION.md`.

## Responsabilidades

- Autenticacion con Supabase Auth.
- Dashboard de pedidos en tiempo real por panaderia.
- Gestion de productos, categorias, perfil y horarios.
- Panel admin para panaderias, clientes, productos, claves y ajustes.
- Flujo premium ALERTA PAN con SumUp.
- Invitaciones individuales y masivas a clientes por WhatsApp mediante el backend.

## Variables

Crear `frontend/.env.local` a partir de `frontend/.env.example`.

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_publica
VITE_BACKEND_URL=http://localhost:3000
```

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

En desarrollo, Vite escucha en `http://localhost:5173` y proxya `/api` hacia `VITE_BACKEND_URL` o `http://localhost:3000`.

## Deploy

`npm run build` genera `dist/`. Si se publica en Vercel, revisar `vercel.json` y actualizar el rewrite `/api/:path*` para apuntar al backend real.
