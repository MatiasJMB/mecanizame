import path from 'path';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';
import { supabase } from './database/supabase';
import { initRealtimeSubscription } from './services/notification.service';
import { handleMessageFlow } from './bot/flow.handler';
import { incrementStrikes } from './services/bakery.service';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Limite de 100 por IP
    message: { status: 'error', message: 'Too many requests from this IP, please try again after 15 minutes' }
});

const notifyLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 30, // maximo 30 notificaciones por minuto
    message: { status: 'error', message: 'Too many notification requests' }
});

app.use(generalLimiter);

const PORT = process.env.PORT || 3000;
const ADMIN_EMAIL = 'matias.moreno101@gmail.com';
const ALERT_PLANS = {
    plus: {
        monthly: { amount: 12990, label: 'Plus Mensual', durationMonths: 1 },
        yearly: { amount: 119990, label: 'Plus Anual', durationMonths: 12 },
    },
    pro: {
        monthly: { amount: 19990, label: 'Pro Mensual', durationMonths: 1 },
        yearly: { amount: 189990, label: 'Pro Anual', durationMonths: 12 },
    },
} as const;
let globalSock: any = null;
const lastMessageTimes = new Map<string, number>();

type AlertPlanKey = keyof typeof ALERT_PLANS;
type AlertBillingCycle = keyof typeof ALERT_PLANS.plus;

function addMonths(date: Date, months: number) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}

async function getAuthenticatedUser(req: Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice('Bearer '.length);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;

    return data.user;
}

async function getAuthorizedBakery(req: Request, bakeryId: number) {
    const user = await getAuthenticatedUser(req);
    if (!user) return { user: null, bakery: null, isAdmin: false };

    const { data: bakery, error } = await supabase
        .from('bakeries')
        .select('*')
        .eq('id', bakeryId)
        .single();

    const isAdmin = user.email === ADMIN_EMAIL;
    if (error || !bakery) return { user, bakery: null, isAdmin };
    if (!isAdmin && bakery.user_id !== user.id) return { user, bakery: null, isAdmin: false };

    return { user, bakery, isAdmin };
}

async function expireAlertIfNeeded(bakery: any) {
    const accessUntil = bakery?.alert_access_until ? new Date(bakery.alert_access_until) : null;
    if (!bakery?.is_alert_unlocked || !accessUntil || accessUntil > new Date()) {
        return bakery;
    }

    await supabase
        .from('bakeries')
        .update({
            is_alert_unlocked: false,
            alert_subscription_status: 'expired',
        })
        .eq('id', bakery.id);

    return {
        ...bakery,
        is_alert_unlocked: false,
        alert_subscription_status: 'expired',
    };
}

async function getSumUpCheckout(checkoutId: string) {
    const apiKey = process.env.SUMUP_API_KEY;
    if (!apiKey) {
        throw new Error('SUMUP_API_KEY no configurada en backend/.env');
    }

    const response = await fetch(`https://api.sumup.com/v0.1/checkouts/${checkoutId}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    });

    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.message || 'No se pudo consultar el checkout de SumUp');
    }

    return payload;
}

function getFrontendBaseUrl(req: Request) {
    return process.env.FRONTEND_APP_URL || req.headers.origin || 'http://localhost:5173';
}

function getAlertPlan(plan: string, billingCycle: string) {
    const normalizedPlan = plan as AlertPlanKey;
    const normalizedBillingCycle = billingCycle as AlertBillingCycle;

    if (!ALERT_PLANS[normalizedPlan]?.[normalizedBillingCycle]) {
        return null;
    }

    return ALERT_PLANS[normalizedPlan][normalizedBillingCycle];
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
    });

    globalSock = sock;

    sock.ev.on('creds.update', saveCreds);

    (sock.ev as any).on('lid-mapping.update', (mappings: any[]) => {
        for (const mapping of mappings) {
            console.log(`📡 Mapeo LID detectado: ${mapping.lid} -> ${mapping.pn}`);
            supabase.from('customers')
                .update({ real_phone: mapping.pn })
                .eq('phone_number', mapping.lid)
                .then(({ error }) => {
                    if (error) console.log('💡 Nota: No se pudo guardar mapeo LID. Asegúrate de haber corrido el SQL en Supabase.');
                });
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 440;

            if (statusCode === 440) {
                console.error('⚠️ [CONFLICTO] WhatsApp está conectado en otro lugar. Deteniendo reconexión automática para evitar bucles.');
            }

            console.log('Connection closed due to:', lastDisconnect?.error, ', reconnecting:', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('WhatsApp connection opened successfully!');
        }
    });

    initRealtimeSubscription(globalSock);

    sock.ev.on('messages.upsert', async (m) => {
        await handleMessageFlow(sock, m, lastMessageTimes);
    });
}

app.get('/', (req, res) => {
    res.send({ status: 'success', message: 'Bot backend is running' });
});

// ENDPOINT DIRECTO: Notificar cambio de estado al cliente vía WhatsApp
// El frontend llama esto cuando la panadería marca un pedido como LISTO o ENTREGADO
app.post('/api/notify-status', notifyLimiter, async (req, res) => {
    try {
        const { order_id, new_status } = req.body;
        if (!order_id || !new_status) {
            return res.status(400).send({ status: 'error', message: 'Missing order_id or new_status' });
        }

        // Obtener datos de la orden
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', order_id)
            .single();

        if (orderError || !order) {
            console.error('❌ Orden no encontrada:', order_id);
            return res.status(404).send({ status: 'error', message: 'Order not found' });
        }

        if (!globalSock) {
            console.error('❌ Bot no conectado a WhatsApp');
            return res.status(503).send({ status: 'error', message: 'WhatsApp bot not connected' });
        }

        if (new_status === 'READY') {
            let expiryMinutes = 30;
            let enableWarning = true;
            let warningMinutes = 10;
            let bakeryData: any = null;

            try {
                const { data } = await supabase
                    .from('bakeries')
                    .select('name, order_expiry_minutes, enable_order_warning, order_warning_minutes')
                    .eq('id', order.bakery_id)
                    .single();

                if (data) {
                    bakeryData = data;
                    expiryMinutes = data.order_expiry_minutes || 30;
                    enableWarning = data.enable_order_warning ?? true;
                    warningMinutes = data.order_warning_minutes || 10;
                }
            } catch (e) {
                console.error("Error obteniendo configuración de la panadería:", e);
            }

            const mensaje = [
                `🔔 *¡Tu pedido está listo!*`,
                ``,
                `Tu código de retiro es: *${order.short_code}*`,
                ``,
                `📋 *Detalle del pedido:*`,
                order.items_description,
                ``,
                `📍 Acércate a la caja y muestra este código para retirar y pagar.`,
                ``,
                `⏳ *Importante:* Tienes *${expiryMinutes} minutos* para retirarlo. Si no llegas a tiempo, tu pedido se cancelará automáticamente.`,
            ].join('\n');

            await globalSock.sendMessage(order.customer_phone, { text: mensaje });
            console.log(`✅ Notificación READY enviada a ${order.customer_phone} (Tiempo: ${expiryMinutes}m)`);

            // AUTO-CANCELACIÓN
            console.log(`⏳ Temporizador de ${expiryMinutes} min activado para orden ${order.short_code}`);

            // 1. AVISO PREVIO (Si está habilitado)
            if (enableWarning && expiryMinutes > warningMinutes) {
                const warningDelay = (expiryMinutes - warningMinutes) * 60 * 1000;
                setTimeout(async () => {
                    try {
                        const { data: checkOrder } = await supabase
                            .from('orders')
                            .select('status')
                            .eq('id', order_id)
                            .single();

                        if (checkOrder && checkOrder.status === 'READY') {
                            const warningMsg = [
                                `⚠️ *¡Tu pedido está por expirar!*`,
                                ``,
                                `Te quedan solo *${warningMinutes} minutos* para retirar tu pedido *${order.short_code}*.`,
                                ``,
                                `📍 *${bakeryData?.name || 'La panadería'}*`,
                                `Recuerda que si no retiras a tiempo, el pedido será cancelado automáticamente.`,
                            ].join('\n');

                            await globalSock.sendMessage(order.customer_phone, { text: warningMsg });
                            console.log(`⚠️ Aviso preventivo enviado a ${order.customer_phone} (${warningMinutes}m restantes)`);
                        }
                    } catch (e) {
                        console.error('Error en aviso preventivo:', e);
                    }
                }, warningDelay);
            }

            // 2. CANCELACIÓN FINAL
            setTimeout(async () => {
                try {
                    const { data: checkOrder } = await supabase
                        .from('orders')
                        .select('status')
                        .eq('id', order_id)
                        .single();

                    if (checkOrder && checkOrder.status === 'READY') {
                        console.log(`⏳ Orden ${order.short_code} expirada por timeout (${expiryMinutes} min)`);

                        // Notificar al cliente
                        if (globalSock) {
                            const cancelMsg = [
                                `❌ *Pedido cancelado*`,
                                ``,
                                `Lamentablemente, tu pedido *${order.short_code}* fue cancelado porque no se retiró a tiempo (${expiryMinutes} minutos).`,
                                ``,
                                `Si deseas hacer un nuevo pedido, escribe *hola* y con gusto te atendemos. 🥖`,
                            ].join('\n');
                            await globalSock.sendMessage(order.customer_phone, { text: cancelMsg });
                        }

                        // Marcar como expirado y eliminar
                        await supabase.from('orders').update({ status: 'EXPIRED' }).eq('id', order_id);
                        await supabase.from('orders').delete().eq('id', order_id);

                        // Incrementar strikes
                        await incrementStrikes(order.bakery_id, order.customer_phone);
                    }
                } catch (e) {
                }
            }, expiryMinutes * 60 * 1000);

        } else if (new_status === 'DELIVERED') {
            const mensaje = [
                `✅ *¡Pedido entregado!*`,
                ``,
                `Tu pedido *${order.short_code}* fue recibido correctamente.`,
                ``,
                `🥖 ¡Muchas gracias por comprar en *Ahora Pan*!`,
                `Esperamos que lo disfrutes. Nos vemos pronto 😊`,
            ].join('\n');

            await globalSock.sendMessage(order.customer_phone, { text: mensaje });
            console.log(`✅ Notificación DELIVERED enviada a ${order.customer_phone}`);

            // Auto-borrar la orden entregada
            try {
                await supabase.from('orders').delete().eq('id', order_id);
                console.log(`🗑️ Pedido ${order.short_code} entregado y eliminado.`);
            } catch (e) {
                console.error('Error eliminando pedido:', e);
            }

        } else if (new_status === 'REJECTED') {
            const reason = order.cancellation_reason || 'No especificado';
            const mensaje = [
                `❌ *Pedido cancelado por la panadería*`,
                ``,
                `Lamentamos informarte que tu pedido *${order.short_code}* ha sido cancelado.`,
                ``,
                `🔴 Motivo: *${reason}*`,
                ``,
                `📦 Detalle del pedido original:`,
                order.items_description || 'No disponible',
            ].join('\n');

            await globalSock.sendMessage(order.customer_phone, { text: mensaje });
            await supabase.from('orders').delete().eq('id', order_id);
            console.log(`✅ Notificación REJECTED enviada a ${order.customer_phone} y orden borrada.`);

        } else if (new_status === 'MODIFIED') {
            const removedItems = req.body.removed_items;
            const removedSection = removedItems
                ? `\n❌ *Artículos removidos por falta de stock:*\n${removedItems.split(', ').map((i: string) => `• ${i}`).join('\n')}\n`
                : '';

            const mensaje = [
                `⚠️ *¡Tu pedido ha sido modificado!*`,
                ``,
                `La panadería ha realizado un cambio en tu pedido *${order.short_code}*.`,
                removedSection,
                `📝 *Nuevo detalle de productos:*`,
                order.items_description || 'No disponible',
                ``,
                `💰 *Nuevo total a pagar en caja: $${new Intl.NumberFormat('es-CL').format(order.total_amount)}*`,
                ``,
                `Te avisaremos en cuanto esté listo. 😊`,
            ].join('\n');

            await globalSock.sendMessage(order.customer_phone, { text: mensaje });
            // Resetear flag de notificación
            await supabase.from('orders').update({ needs_modification_notify: false }).eq('id', order_id);
            console.log(`✅ Notificación MODIFIED enviada a ${order.customer_phone}`);
        }

        res.send({ status: 'success', message: `Notification sent for ${new_status}` });
    } catch (e: any) {
        console.error('🔥 Error en notify-status:', e);
        res.status(500).send({ status: 'error', message: e.message || 'Internal error' });
    }
});

app.post('/api/broadcast', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { bakery_id } = req.body;
        if (!bakery_id) return res.status(400).send({ status: 'error', message: 'Missing bakery_id' });

        const { bakery, isAdmin, user } = await getAuthorizedBakery(req, Number(bakery_id));
        if (!user) return res.status(401).send({ status: 'error', message: 'Sesion no valida' });
        if (!bakery) return res.status(404).send({ status: 'error', message: 'Bakery not found or access denied' });

        const refreshedBakery = await expireAlertIfNeeded(bakery);
        if (!isAdmin && !refreshedBakery.is_alert_unlocked) {
            return res.status(403).send({ status: 'error', message: 'Esta funcion requiere ALERTA PAN desbloqueada.' });
        }

        const bakeryName = refreshedBakery.name || 'tu panaderia favorita';
        const allPhones: string[] = [];

        try {
            const { data: bcData } = await supabase
                .from('bakery_customers')
                .select('customer_phone')
                .eq('bakery_id', bakery_id);
            if (bcData) allPhones.push(...bcData.map(c => c.customer_phone));
        } catch (e) {
            console.log('bakery_customers no disponible, usando solo orders');
        }

        try {
            const { data: orderData } = await supabase
                .from('orders')
                .select('customer_phone')
                .eq('bakery_id', bakery_id);
            if (orderData) allPhones.push(...orderData.map(o => o.customer_phone));
        } catch (e) {
            console.log('Error consultando orders');
        }

        const uniquePhones = [...new Set(allPhones)];
        console.log(`Broadcast para bakery ${bakery_id} (${bakeryName}): ${uniquePhones.length} clientes encontrados`);

        if (!globalSock) {
            console.error('Bot no conectado a WhatsApp');
            return res.status(503).send({ status: 'error', message: 'Bot WhatsApp no conectado', foundClients: uniquePhones.length });
        }

        let sent = 0;
        for (const phone of uniquePhones) {
            try {
                await globalSock.sendMessage(phone, { text: `📢 *¡PAN RECIEN HECHO EN ${bakeryName.toUpperCase()}!*\n\nTe avisamos que acabamos de sacar pan directo del horno.\n\nEscribe *hola* para reservar tu pedido desde tu celular.` });
                sent++;
                console.log(`Broadcast enviado a ${phone}`);
            } catch (e) {
                console.error(`Error enviando broadcast a ${phone}:`, e);
            }
        }

        return res.send({ status: 'success', sentTo: sent, totalClients: uniquePhones.length });
    } catch (e) {
        console.error('Error critico en broadcast premium:', e);
        return next();
    }
});

app.get('/api/alerta-pan/access-status', async (req: Request, res: Response) => {
    try {
        const bakeryId = Number(req.query.bakery_id);
        if (!bakeryId) {
            return res.status(400).send({ status: 'error', message: 'Missing bakery_id' });
        }

        const { bakery, isAdmin, user } = await getAuthorizedBakery(req, bakeryId);
        if (!user) return res.status(401).send({ status: 'error', message: 'Sesion no valida' });
        if (!bakery) return res.status(404).send({ status: 'error', message: 'Bakery not found or access denied' });

        const refreshedBakery = await expireAlertIfNeeded(bakery);
        const checkoutId = refreshedBakery.alert_sumup_checkout_id;

        if (checkoutId && refreshedBakery.alert_subscription_status === 'pending') {
            const checkout: any = await getSumUpCheckout(checkoutId);

            if (checkout?.status === 'PAID') {
                const durationMonths = Number(refreshedBakery.alert_duration_months) || 1;
                const activeUntil = addMonths(new Date(), durationMonths);

                const { data: updatedBakery, error: updateError } = await supabase
                    .from('bakeries')
                    .update({
                        is_alert_unlocked: true,
                        alert_subscription_status: 'active',
                        alert_access_until: activeUntil.toISOString(),
                        alert_last_paid_at: new Date().toISOString(),
                    })
                    .eq('id', bakeryId)
                    .select('*')
                    .single();

                if (updateError) {
                    throw new Error('Pago confirmado, pero falta correr la migracion SQL de ALERTA PAN en Supabase.');
                }

                return res.send({
                    status: 'success',
                    access: {
                        isAdmin,
                        isUnlocked: true,
                        bakeryName: updatedBakery?.name || refreshedBakery.name,
                        subscriptionStatus: 'active',
                        plan: updatedBakery?.alert_plan || refreshedBakery.alert_plan || 'plus',
                        billingCycle: updatedBakery?.alert_billing_cycle || refreshedBakery.alert_billing_cycle || 'monthly',
                        accessUntil: updatedBakery?.alert_access_until || activeUntil.toISOString(),
                        pendingCheckoutId: checkoutId,
                        checkoutStatus: checkout.status,
                    },
                });
            }

            if (checkout?.status === 'FAILED' || checkout?.status === 'EXPIRED') {
                const nextStatus = checkout.status === 'EXPIRED' ? 'expired' : 'inactive';
                const { data: updatedBakery, error: updateError } = await supabase
                    .from('bakeries')
                    .update({
                        is_alert_unlocked: false,
                        alert_subscription_status: nextStatus,
                    })
                    .eq('id', bakeryId)
                    .select('*')
                    .single();

                if (updateError) {
                    throw new Error('No se pudo actualizar el estado premium de ALERTA PAN en Supabase.');
                }

                return res.send({
                    status: 'success',
                    access: {
                        isAdmin,
                        isUnlocked: isAdmin,
                        bakeryName: updatedBakery?.name || refreshedBakery.name,
                        subscriptionStatus: updatedBakery?.alert_subscription_status || nextStatus,
                        plan: updatedBakery?.alert_plan || refreshedBakery.alert_plan || 'plus',
                        billingCycle: updatedBakery?.alert_billing_cycle || refreshedBakery.alert_billing_cycle || 'monthly',
                        accessUntil: updatedBakery?.alert_access_until || refreshedBakery.alert_access_until || null,
                        pendingCheckoutId: checkoutId,
                        checkoutStatus: checkout.status,
                    },
                });
            }

            return res.send({
                status: 'success',
                access: {
                    isAdmin,
                    isUnlocked: isAdmin || refreshedBakery.is_alert_unlocked,
                    bakeryName: refreshedBakery.name,
                    subscriptionStatus: refreshedBakery.alert_subscription_status || 'pending',
                    plan: refreshedBakery.alert_plan || 'plus',
                    billingCycle: refreshedBakery.alert_billing_cycle || 'monthly',
                    accessUntil: refreshedBakery.alert_access_until || null,
                    pendingCheckoutId: checkoutId,
                    checkoutStatus: checkout?.status || 'PENDING',
                },
            });
        }

        return res.send({
            status: 'success',
            access: {
                isAdmin,
                isUnlocked: isAdmin || refreshedBakery.is_alert_unlocked,
                bakeryName: refreshedBakery.name,
                subscriptionStatus: refreshedBakery.alert_subscription_status || (refreshedBakery.is_alert_unlocked ? 'active' : 'inactive'),
                plan: refreshedBakery.alert_plan || 'plus',
                billingCycle: refreshedBakery.alert_billing_cycle || 'monthly',
                accessUntil: refreshedBakery.alert_access_until || null,
                pendingCheckoutId: checkoutId || null,
                checkoutStatus: null,
            },
        });
    } catch (e: any) {
        console.error('Error obteniendo estado de ALERTA PAN:', e);
        res.status(500).send({ status: 'error', message: e.message || 'Internal error' });
    }
});

app.post('/api/alerta-pan/create-checkout', async (req: Request, res: Response) => {
    try {
        const { bakery_id, plan, billing_cycle } = req.body as {
            bakery_id?: number;
            plan?: string;
            billing_cycle?: string;
        };

        if (!bakery_id || !plan || !billing_cycle) {
            return res.status(400).send({ status: 'error', message: 'Missing bakery_id, plan or billing_cycle' });
        }

        const selectedPlan = getAlertPlan(plan, billing_cycle);
        if (!selectedPlan) {
            return res.status(400).send({ status: 'error', message: 'Plan invalido' });
        }

        const finalAmount = Math.round(selectedPlan.amount * 1.03);

        const apiKey = process.env.SUMUP_API_KEY;
        const merchantCode = process.env.SUMUP_MERCHANT_CODE;
        if (!apiKey || !merchantCode) {
            return res.status(500).send({ status: 'error', message: 'Falta configurar SUMUP_API_KEY o SUMUP_MERCHANT_CODE en backend/.env' });
        }

        const { bakery, isAdmin, user } = await getAuthorizedBakery(req, Number(bakery_id));
        if (!user) return res.status(401).send({ status: 'error', message: 'Sesion no valida' });
        if (!bakery) return res.status(404).send({ status: 'error', message: 'Bakery not found or access denied' });

        if (isAdmin) {
            return res.send({
                status: 'success',
                bypassed: true,
                message: 'Admin global con acceso liberado.',
            });
        }

        const checkoutReference = `alerta-pan-${bakery.id}-${plan}-${billing_cycle}-${Date.now()}`.slice(0, 90);
        const frontendBaseUrl = getFrontendBaseUrl(req);

        const sumUpResponse = await fetch('https://api.sumup.com/v0.1/checkouts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                amount: finalAmount,
                checkout_reference: checkoutReference,
                currency: 'CLP',
                description: `ALERTA PAN ${selectedPlan.label} - ${bakery.name}`,
                merchant_code: merchantCode,
                hosted_checkout: { enabled: true },
                redirect_url: `${frontendBaseUrl}/desbloquear-alerta?payment_success=true`,
            }),
        });

        const checkout: any = await sumUpResponse.json().catch(() => ({}));
        if (!sumUpResponse.ok) {
            return res.status(400).send({
                status: 'error',
                message: checkout?.message || 'No se pudo crear el checkout en SumUp',
            });
        }

        const { error: updateError } = await supabase
            .from('bakeries')
            .update({
                alert_plan: plan,
                alert_billing_cycle: billing_cycle,
                alert_duration_months: selectedPlan.durationMonths,
                alert_subscription_status: 'pending',
                alert_sumup_checkout_id: checkout.id,
                alert_checkout_reference: checkoutReference,
            })
            .eq('id', bakery.id);

        if (updateError) {
            throw new Error('Falta correr la migracion SQL de ALERTA PAN antes de abrir SumUp.');
        }

        return res.send({
            status: 'success',
            checkoutUrl: checkout.hosted_checkout_url,
            checkoutId: checkout.id,
            checkoutReference,
        });
    } catch (e: any) {
        console.error('Error creando checkout de ALERTA PAN:', e);
        res.status(500).send({ status: 'error', message: e.message || 'Internal error' });
    }
});

// ENDPOINT PARA INVITAR CLIENTES
app.post('/api/invite-customer', async (req: Request, res: Response) => {
    try {
        const { bakery_id, phone } = req.body;
        if (!bakery_id || !phone) {
            return res.status(400).send({ status: 'error', message: 'Falta bakery_id o número de teléfono' });
        }

        const { user, bakery, isAdmin } = await getAuthorizedBakery(req, Number(bakery_id));
        if (!user || !bakery) return res.status(401).send({ status: 'error', message: 'No autorizado' });

        if (!globalSock) {
            return res.status(503).send({ status: 'error', message: 'Bot WhatsApp no conectado' });
        }

        // Limpiar y formatear el número (asegurarse que tenga el formato de WA)
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length === 8) cleanPhone = '569' + cleanPhone;
        if (cleanPhone.length === 9) cleanPhone = '56' + cleanPhone;
        
        const waId = `${cleanPhone}@s.whatsapp.net`;
        const botName = 'AhoraPan Bot';
        const bakeryName = bakery.name || 'tu panadería local';

        const message = [
            `👋 *¡Hola! Te escribe ${bakeryName}*`,
            ``,
            `Queremos invitarte a usar nuestro nuevo sistema de reservas por WhatsApp.`,
            ``,
            `🥖 *¿Cómo funciona?*`,
            `Escríbeme *hola* a este mismo chat y podrás ver nuestro pan disponible, hacer pedidos y recibir avisos cuando el pan esté recién salido del horno.`,
            ``,
            `¡Espero tu pedido! 😊`
        ].join('\n');

        await globalSock.sendMessage(waId, { text: message });

        // Opcional: Vincularlo preventivamente en la DB
        try {
            await supabase.from('bakery_customers').upsert({
                bakery_id: bakery_id,
                customer_phone: waId
            }, { onConflict: 'bakery_id,customer_phone' });
        } catch (dbErr) {
            console.error('Error vinculando cliente preventivamente:', dbErr);
        }

        res.send({ status: 'success', message: 'Invitación enviada con éxito' });
    } catch (e: any) {
        console.error('Error enviando invitación:', e);
        res.status(500).send({ status: 'error', message: e.message || 'Error interno' });
    }
});

// ENDPOINT PARA INVITACIONES MASIVAS (BULK)
app.post('/api/invite-customers-bulk', async (req: Request, res: Response) => {
    try {
        const { bakery_id, phones } = req.body;
        if (!bakery_id || !phones || !Array.isArray(phones)) {
            return res.status(400).send({ status: 'error', message: 'Falta bakery_id o el array de números' });
        }

        const { user, bakery } = await getAuthorizedBakery(req, Number(bakery_id));
        if (!user || !bakery) return res.status(401).send({ status: 'error', message: 'No autorizado' });

        if (!globalSock) {
            return res.status(503).send({ status: 'error', message: 'Bot WhatsApp no conectado' });
        }

        // Responder inmediatamente para no bloquear el frontend
        res.send({ status: 'success', message: `Procesando ${phones.length} invitaciones. Se enviarán en segundo plano para evitar bloqueos por spam.` });

        const bakeryName = bakery.name || 'tu panadería local';
        
        // Procesar en segundo plano para aplicar los retrasos sin bloquear el response
        (async () => {
            console.log(`🚀 Iniciando envío masivo para bakery ${bakery_id} (${phones.length} números)`);
            for (const phone of phones) {
                try {
                    let cleanPhone = phone.replace(/\D/g, '');
                    if (cleanPhone.length === 8) cleanPhone = '569' + cleanPhone;
                    if (cleanPhone.length === 9) cleanPhone = '56' + cleanPhone;
                    
                    const waId = `${cleanPhone}@s.whatsapp.net`;

                    // Variar el saludo aleatoriamente
                    const greetings = [
                        `👋 *¡Hola! Te escribe ${bakeryName}*`,
                        `🍞 *¡Hola! Somos ${bakeryName}*`,
                        `👋 *¡Buen día! Desde ${bakeryName} te escribimos*`
                    ];
                    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

                    const message = [
                        greeting,
                        ``,
                        `Queremos invitarte a usar nuestro nuevo sistema de reservas por WhatsApp.`,
                        ``,
                        `🥖 *¿Cómo funciona?*`,
                        `Escríbeme *hola* a este mismo chat y podrás ver nuestro pan disponible, hacer pedidos y recibir avisos cuando el pan esté recién salido del horno.`,
                        ``,
                        `¡Espero tu pedido! 😊`
                    ].join('\n');

                    await globalSock.sendMessage(waId, { text: message });
                    
                    // Retraso aleatorio entre 3s y 8s (3000ms a 8000ms) para protección anti-spam
                    const delay = Math.floor(Math.random() * 5000) + 3000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                } catch (err) {
                    console.error(`Error enviando invitación masiva a ${phone}:`, err);
                }
            }
            console.log(`✅ Envío masivo completado para bakery ${bakery_id}`);
        })();

    } catch (e: any) {
        console.error('Error enviando invitaciones masivas:', e);
        if (!res.headersSent) {
            res.status(500).send({ status: 'error', message: e.message || 'Error interno' });
        }
    }
});

app.post('/api/alerta-pan/simulate-success', async (req: Request, res: Response) => {
    try {
        const { bakery_id, plan, billing_cycle } = req.body;
        if (!bakery_id) return res.status(400).send({ status: 'error', message: 'Missing bakery_id' });

        const { user, bakery, isAdmin } = await getAuthorizedBakery(req, Number(bakery_id));
        if (!user || (!bakery && !isAdmin)) {
            return res.status(401).send({ status: 'error', message: 'No autorizado para simular pagos' });
        }

        const durationMonths = billing_cycle === 'yearly' ? 12 : 1;
        const activeUntil = addMonths(new Date(), durationMonths);

        const { error } = await supabase
            .from('bakeries')
            .update({
                is_alert_unlocked: true,
                alert_plan: plan || 'plus',
                alert_billing_cycle: billing_cycle || 'monthly',
                alert_subscription_status: 'active',
                alert_access_until: activeUntil.toISOString(),
                alert_last_paid_at: new Date().toISOString(),
            })
            .eq('id', bakery_id);

        if (error) throw error;

        res.send({ status: 'success', message: 'Simulated payment successful' });
    } catch (e: any) {
        res.status(500).send({ status: 'error', message: e.message });
    }
});

// ENDPOINT: Cancelar suscripción ALERTA PAN
// Marca la suscripción como cancelada pero mantiene el acceso hasta la fecha de vencimiento pagada
app.post('/api/alerta-pan/cancel', async (req: Request, res: Response) => {
    try {
        const { bakery_id } = req.body;
        if (!bakery_id) return res.status(400).send({ status: 'error', message: 'Missing bakery_id' });

        const { user, bakery, isAdmin } = await getAuthorizedBakery(req, Number(bakery_id));
        if (!user) return res.status(401).send({ status: 'error', message: 'Sesion no valida' });
        if (!bakery) return res.status(404).send({ status: 'error', message: 'Bakery not found or access denied' });

        if (!bakery.is_alert_unlocked) {
            return res.status(400).send({ status: 'error', message: 'No hay suscripción activa para cancelar' });
        }

        // Marcar como cancelada pero mantener acceso hasta la fecha pagada
        const { error } = await supabase
            .from('bakeries')
            .update({
                alert_subscription_status: 'cancelled',
            })
            .eq('id', bakery_id);

        if (error) throw error;

        console.log(`🔴 Suscripción ALERTA PAN cancelada para bakery ${bakery_id} (acceso mantiene hasta ${bakery.alert_access_until})`);

        res.send({
            status: 'success',
            message: 'Suscripción cancelada. El acceso se mantendrá hasta la fecha de vencimiento pagada.',
            accessUntil: bakery.alert_access_until,
        });
    } catch (e: any) {
        console.error('Error cancelando suscripción:', e);
        res.status(500).send({ status: 'error', message: e.message || 'Error interno' });
    }
});

// ENDPOINT: Eliminar panadería completa (incluye auth.user) - Solo Admin
app.delete('/api/admin/bakery/:id', async (req: Request, res: Response) => {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user || user.email !== ADMIN_EMAIL) {
            return res.status(403).send({ status: 'error', message: 'No autorizado. Solo el administrador puede realizar esta acción.' });
        }

        const bakeryId = parseInt(req.params.id as string);
        if (isNaN(bakeryId)) {
            return res.status(400).send({ status: 'error', message: 'ID de panadería inválido' });
        }

        // Obtener la panadería para saber el user_id
        const { data: bakery, error: fetchError } = await supabase
            .from('bakeries')
            .select('user_id, name')
            .eq('id', bakeryId)
            .single();

        if (fetchError || !bakery) {
            return res.status(404).send({ status: 'error', message: 'Panadería no encontrada' });
        }

        // Eliminar de auth.users (la clave primaria que en cascada borrará perfiles y panaderías y todo lo asociado)
        const { error: deleteError } = await supabase.auth.admin.deleteUser(bakery.user_id);
        
        if (deleteError) {
            console.error('Error al borrar usuario de Auth:', deleteError);
            throw deleteError;
        }

        console.log(`🗑️ Panadería eliminada completamente: ${bakery.name} (user_id: ${bakery.user_id})`);
        res.send({ status: 'success', message: 'Panadería y usuario eliminados completamente' });

    } catch (e: any) {
        console.error('Error eliminando panadería:', e);
        res.status(500).send({ status: 'error', message: e.message || 'Error interno' });
    }
});

app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server is listening on port ${PORT} (0.0.0.0)`);
    startBot();
});
