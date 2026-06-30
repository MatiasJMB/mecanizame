import { supabase } from '../database/supabase';
import { getSession, saveSession, clearBotSession } from '../services/session.service';
import { isBakeryOpen, incrementStrikes } from '../services/bakery.service';
import { generateNextShortCode } from '../services/order.service';
import { formatQuantity } from '../utils/formatter';
import { RATE_LIMIT_MS, SALUDOS_UNIVERSALES, WEIGHT_OPTIONS, UNIT_OPTIONS } from '../utils/constants';
import { UserState, Cart } from '../types';


const safeParse = (data: any) => {
    if (typeof data === 'object' && data !== null) return data;
    try {
        return JSON.parse(data || '[]');
    } catch (e) {
        console.error('[SAFE_PARSE] Error:', e, 'Data:', data);
        return [];
    }
};

const numEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

export async function handleMessageFlow(sock: any, m: any, lastMessageTimes: Map<string, number>) {
    try {


        const msg = m.messages[0];

        if (!msg.message || msg.key.fromMe) return;

        const numeroCliente = msg.key.remoteJid!;
        const pushName = msg.pushName || '';

        // 0. Anti-spam: Rate limiting por tiempo
        const now = Date.now();
        const lastTime = lastMessageTimes.get(numeroCliente) || 0;
        if (now - lastTime < RATE_LIMIT_MS) {
            console.log("Spam bloqueado de:", numeroCliente);
            return;
        }
        lastMessageTimes.set(numeroCliente, now);

        // 1. Extraer el texto y limpiarlo
        const textoMensaje = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        const textoLimpio = textoMensaje.toLowerCase().trim();

        if (!textoLimpio) return;
        let session = await getSession(numeroCliente);
        let state = session.state;
        let cart = session.cart;
        console.log(`[BOT] 📥 MSG de ${numeroCliente}: "${textoLimpio}"`);
        console.log(`[BOT] 🧠 Estado previo: ${state?.step || 'NINGUNO'}`);


        const updateState = async (newState: any) => { state = newState as UserState; await saveSession(numeroCliente, state, cart); };
        const updateCart = async (newCart: any) => { cart = newCart as Cart; await saveSession(numeroCliente, state, cart); };
        const clearSess = async () => { state = undefined; cart = { items: [], totalAmount: 0 }; await clearBotSession(numeroCliente); };


        // Comandos Universales (Siempre escuchan)
        const saludos = SALUDOS_UNIVERSALES;

        if (saludos.includes(textoLimpio) || textoLimpio === '0') {
            cart = { items: [], totalAmount: 0 }; await saveSession(numeroCliente, state, cart);

            try {
                // ── Fast Track: Buscar última panadería del cliente ──
                const { data: lastVisit } = await supabase
                    .from('bakery_customers')
                    .select('bakery_id, last_order_at')
                    .eq('customer_phone', numeroCliente)
                    .order('last_order_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (lastVisit?.bakery_id) {
                    const { data: lastBakery } = await supabase
                        .from('bakeries')
                        .select('id, name, is_active')
                        .eq('id', lastVisit.bakery_id)
                        .single();

                    if (lastBakery && lastBakery.is_active) {
                        await updateState({
                            step: 'FAST_TRACK',
                            lastBakeryId: lastBakery.id,
                            lastBakeryName: lastBakery.name
                        });

                        const fastTrackMsg = [
                            `🍞 *¡Hola de nuevo!*`,
                            ``,
                            `━━━━━━━━━━━━━━━━━━━━━`,
                            `🏠 La última vez pediste en:`,
                            `*${lastBakery.name}*`,
                            `━━━━━━━━━━━━━━━━━━━━━`,
                            ``,
                            `¿Qué quieres hacer?`,
                            ``,
                            `1️⃣  Seguir comprando en *${lastBakery.name}*`,
                            `2️⃣  Elegir otra panadería`,
                        ];
                        await sock.sendMessage(numeroCliente, { text: fastTrackMsg.join('\n') });
                        return;
                    }
                }

                // ── Flujo estándar: No hay historial o la panadería no está activa ──
                await updateState({ step: 'LOCATION_REGION' });

                const { data: regions, error: regError } = await supabase
                    .from('bakeries')
                    .select('region')
                    .eq('is_active', true)
                    .not('region', 'is', null)
                    .order('region', { ascending: true });

                if (regError) console.error('❌ [ERROR] Error al buscar regiones:', regError);

                const uniqueRegions = [...new Set((regions || []).map(r => r.region))];

                if (!uniqueRegions || uniqueRegions.length === 0) {
                    const noBakeryMsg = [
                        `🍞 *¡Bienvenido a Ahora Pan!*`,
                        ``,
                        `😔 *Lo sentimos, no hay locales disponibles aún.*`,
                        ``,
                        `En este momento no tenemos panaderías configuradas o activas en la plataforma.`,
                        ``,
                        `¡Regresa pronto! 🥯`,
                    ].join('\n');
                    await sock.sendMessage(numeroCliente, { text: noBakeryMsg });
                    await clearSess();
                    return;
                }

                const bienvenida = [
                    `🍞 *¡Bienvenido a Ahora Pan!*`,
                    `Encuentra las mejores panaderías cerca de ti. 🥖`,
                    ``,
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    `📍 *Paso 1 de 3 — Tu Región*`,
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    ``,
                ];

                uniqueRegions.forEach((reg, idx) => {
                    bienvenida.push(`${numEmojis[idx] || `${idx + 1}.`}  ${reg}`);
                });
                bienvenida.push(``, `👆 Escribe el *número* para elegir.`);

                await updateState({
                    step: 'LOCATION_REGION',
                    locationFilter: { region: JSON.stringify(uniqueRegions) }
                });

                await sock.sendMessage(numeroCliente, { text: bienvenida.join('\n') });
            } catch (e) {
                console.error('🔥 Error crítico en el bot (Regions):', e);
                await sock.sendMessage(numeroCliente, { text: "😔 Tuvimos un problema al cargar el menú. Intenta escribir *hola* de nuevo." });
            }
            return;
        }

        // Recuperar estado del usuario


        if (state?.step === 'FAST_TRACK') {
            if (textoLimpio === '1') {
                // ── Acceso Rápido: Ir directo a la última panadería ──
                const bakeryId = state.lastBakeryId!;

                try {
                    const { data: bakery } = await supabase
                        .from('bakeries')
                        .select('id, name, business_hours, max_strikes, order_expiry_minutes, is_active')
                        .eq('id', bakeryId)
                        .single();

                    if (!bakery || !bakery.is_active) {
                        await sock.sendMessage(numeroCliente, { text: '😔 Esta panadería ya no está disponible.\n\nEscribe *hola* para elegir otra.' });
                        await clearSess();
                        return;
                    }

                    // Verificar si está abierta
                    const { isOpen, schedule } = isBakeryOpen(bakery.business_hours);
                    if (!isOpen) {
                        const closedMsg = [
                            `🏠 *${bakery.name}*`,
                            ``,
                            `😔 Lo sentimos, en este momento el local se encuentra *cerrado*.`,
                            ``,
                            `🕒 *Horario de atención:*`,
                            schedule,
                            ``,
                            `Escribe *hola* cuando estemos atendiendo. ¡Te esperamos! 🥖`,
                        ].join('\n');
                        await sock.sendMessage(numeroCliente, { text: closedMsg });
                        await clearSess();
                        return;
                    }

                    // Verificar strikes
                    const { data: bcData } = await supabase
                        .from('bakery_customers')
                        .select('strikes')
                        .eq('bakery_id', bakeryId)
                        .eq('customer_phone', numeroCliente)
                        .single();

                    const clientStrikes = bcData?.strikes || 0;
                    const maxStrikes = bakery.max_strikes || 3;

                    if (clientStrikes >= maxStrikes) {
                        await sock.sendMessage(numeroCliente, { text: `🚫 Lo sentimos, no puedes pedir en *${bakery.name}* por exceso de strikes.\n\nEscribe *hola* para elegir otra panadería.` });
                        await clearSess();
                        return;
                    }

                    // Cargar productos
                    const { data: dbProducts } = await supabase
                        .from('products')
                        .select('id, name, price, sell_type, category')
                        .eq('bakery_id', bakeryId)
                        .eq('is_active', true)
                        .order('category')
                        .order('name');

                    if (!dbProducts || dbProducts.length === 0) {
                        await sock.sendMessage(numeroCliente, { text: `🏠 *${bakery.name}*\n\n😔 Esta panadería aún no tiene productos.\n\nEscribe *hola* para elegir otra.` });
                        await clearSess();
                        return;
                    }

                    const uniqueCategories = [...new Set(dbProducts.map(p => p.category || 'Otros'))];

                    if (uniqueCategories.length > 1) {
                        await updateState({
                            step: 'CATEGORY',
                            bakeryId: bakery.id,
                            menuProducts: dbProducts,
                            locationFilter: { categoryList: JSON.stringify(uniqueCategories) }
                        });

                        const catMsg = [
                            `━━━━━━━━━━━━━━━━━━━━━`,
                            `🏠 *${bakery.name}*`,
                            `━━━━━━━━━━━━━━━━━━━━━`,
                            ``,
                            `📂 *¿Qué categoría te interesa?*`,
                            ``,
                        ];
                        uniqueCategories.forEach((cat, idx) => {
                            catMsg.push(`${numEmojis[idx] || `${idx + 1}.`}  ${cat}`);
                        });
                        catMsg.push(``, `👆 Escribe el número para elegir.`);
                        catMsg.push(`↩️  Escribe *0* para volver.`);
                        await sock.sendMessage(numeroCliente, { text: catMsg.join('\n') });
                    } else {
                        const onlyCategory = uniqueCategories[0];
                        await updateState({
                            step: 'MENU',
                            bakeryId: bakery.id,
                            menuProducts: dbProducts,
                            filteredProducts: dbProducts,
                            selectedCategory: onlyCategory
                        });

                        const menuMsg = [
                            `━━━━━━━━━━━━━━━━━━━━━`,
                            `🏠 *${bakery.name}*`,
                            `━━━━━━━━━━━━━━━━━━━━━`,
                            ``,
                        ];

                        if (bakery.order_expiry_minutes) {
                            menuMsg.push(`⏳ *Nota:* Tendrás *${bakery.order_expiry_minutes} minutos* para retirar tu pedido una vez listo.`);
                            menuMsg.push(``);
                        }

                        menuMsg.push(`📋 *¿Qué producto deseas?*`, ``);

                        dbProducts.forEach((p, idx) => {
                            const priceLabel = p.sell_type === 'per_kg'
                                ? `$${new Intl.NumberFormat('es-CL').format(p.price)}/kg`
                                : `$${new Intl.NumberFormat('es-CL').format(p.price)} c/u`;
                            menuMsg.push(`${numEmojis[idx] || `${idx + 1}.`}  *${p.name}* — ${priceLabel}`);
                        });

                        menuMsg.push(``, `👆 Escribe el número para elegir.`);
                        menuMsg.push(`↩️  Escribe *0* para volver.`);
                        await sock.sendMessage(numeroCliente, { text: menuMsg.join('\n') });
                    }
                } catch (e) {
                    console.error('🔥 Error en Fast Track:', e);
                    await sock.sendMessage(numeroCliente, { text: '😔 Hubo un problema. Escribe *hola* para intentar de nuevo.' });
                }
                return;

            } else if (textoLimpio === '2') {
                // ── Elegir otra panadería: Ir al flujo estándar ──
                try {
                    const { data: regions } = await supabase
                        .from('bakeries')
                        .select('region')
                        .eq('is_active', true)
                        .not('region', 'is', null)
                        .order('region', { ascending: true });

                    const uniqueRegions = [...new Set((regions || []).map(r => r.region))];

                    if (!uniqueRegions || uniqueRegions.length === 0) {
                        await sock.sendMessage(numeroCliente, { text: '😔 No hay panaderías disponibles en este momento.' });
                        await clearSess();
                        return;
                    }

                    const bienvenida = [
                        `🍞 *¡Busquemos tu panadería!*`,
                        ``,
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        `📍 *Paso 1 de 3 — Tu Región*`,
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        ``,
                    ];

                    uniqueRegions.forEach((reg, idx) => {
                        bienvenida.push(`${numEmojis[idx] || `${idx + 1}.`}  ${reg}`);
                    });
                    bienvenida.push(``, `👆 Escribe el *número* para elegir.`);

                    await updateState({
                        step: 'LOCATION_REGION',
                        locationFilter: { region: JSON.stringify(uniqueRegions) }
                    });

                    await sock.sendMessage(numeroCliente, { text: bienvenida.join('\n') });
                } catch (e) {
                    console.error('🔥 Error en cambio de panadería:', e);
                    await sock.sendMessage(numeroCliente, { text: '😔 Error al cargar. Escribe *hola* de nuevo.' });
                }
                return;

            } else {
                await sock.sendMessage(numeroCliente, { text: `🤔 Escribe *1* para seguir en *${state.lastBakeryName}* o *2* para elegir otra panadería.` });
                return;
            }

        } else if (state?.step === 'LOCATION_REGION') {
            const selectedIdx = parseInt(textoLimpio) - 1;
            const regions = safeParse(state.locationFilter?.region);

            if (selectedIdx >= 0 && selectedIdx < regions.length) {
                const selectedRegion = regions[selectedIdx];

                // 2. Obtener Comunas de esa región
                const { data: comunas } = await supabase
                    .from('bakeries')
                    .select('comuna')
                    .eq('is_active', true)
                    .eq('region', selectedRegion)
                    .not('comuna', 'is', null)
                    .order('comuna', { ascending: true });

                const uniqueComunas = [...new Set((comunas || []).map(c => c.comuna))];

                await updateState({
                    step: 'LOCATION_COMUNA',
                    locationFilter: { region: selectedRegion, comuna: JSON.stringify(uniqueComunas) }
                });

                const comunaMsg = [
                    `✅ Región: *${selectedRegion}*`,
                    ``,
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    `🏘️ *Paso 2 de 3 — Tu Comuna*`,
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    ``,
                ];
                uniqueComunas.forEach((com, idx) => {
                    comunaMsg.push(`${numEmojis[idx] || `${idx + 1}.`}  ${com}`);
                });
                comunaMsg.push(``, `👆 Escribe el *número* para elegir.`);

                await sock.sendMessage(numeroCliente, { text: comunaMsg.join('\n') });
            } else {
                await sock.sendMessage(numeroCliente, { text: "🤔 Por favor, escribe un número de la lista para elegir tu región." });
            }
            return;

        } else if (state?.step === 'LOCATION_COMUNA') {
            const selectedIdx = parseInt(textoLimpio) - 1;
            const comunas = safeParse(state.locationFilter?.comuna);
            const region = state.locationFilter?.region;

            if (selectedIdx >= 0 && selectedIdx < comunas.length) {
                const selectedComuna = comunas[selectedIdx];

                // 3. Obtener Ciudades/Sectores de esa comuna
                const { data: cities } = await supabase
                    .from('bakeries')
                    .select('ciudad')
                    .eq('is_active', true)
                    .eq('region', region)
                    .eq('comuna', selectedComuna)
                    .not('ciudad', 'is', null)
                    .order('ciudad', { ascending: true });

                const uniqueCities = [...new Set((cities || []).map(c => c.ciudad))];

                await updateState({
                    step: 'LOCATION_CITY',
                    locationFilter: { region, comuna: selectedComuna, ciudad: JSON.stringify(uniqueCities) }
                });

                const cityMsg = [
                    `✅ Región: *${region}*  •  Comuna: *${selectedComuna}*`,
                    ``,
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    `🏙️ *Paso 3 de 3 — Tu Ciudad o Sector*`,
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    ``,
                ];
                uniqueCities.forEach((city, idx) => {
                    cityMsg.push(`${numEmojis[idx] || `${idx + 1}.`}  ${city}`);
                });
                cityMsg.push(``, `👆 Escribe el *número* para elegir.`);

                await sock.sendMessage(numeroCliente, { text: cityMsg.join('\n') });
            } else {
                await sock.sendMessage(numeroCliente, { text: "🤔 Por favor, elige una comuna válida." });
            }
            return;

        } else if (state?.step === 'LOCATION_CITY') {
            const selectedIdx = parseInt(textoLimpio) - 1;
            const cities = safeParse(state.locationFilter?.ciudad);
            const region = state.locationFilter?.region;
            const comuna = state.locationFilter?.comuna;

            if (selectedIdx >= 0 && selectedIdx < cities.length) {
                const selectedCity = cities[selectedIdx];

                // FINALMENTE: Listar panaderías
                try {
                    const { data: settingsData } = await supabase.from('settings').select('value').eq('key', 'sponsored_limit').single();
                    const maxSponsored = parseInt(settingsData?.value as any) || 3;

                    const { data: bakeries, error: bkError } = await supabase
                        .from('bakeries')
                        .select('id, name, location, business_hours, order_expiry_minutes, is_sponsored, is_active')
                        .eq('is_active', true)
                        .eq('region', region)
                        .eq('comuna', comuna)
                        .eq('ciudad', selectedCity)
                        .order('is_sponsored', { ascending: false })
                        .order('name', { ascending: true });

                    if (!bakeries || bakeries.length === 0) {
                        await sock.sendMessage(numeroCliente, { text: "😔 No encontramos panaderías en este sector específico. Escribe *hola* para intentar en otro lugar." });
                        await clearSess();
                        return;
                    }

                    const sponsored = bakeries.filter((b: any) => b.is_sponsored).slice(0, maxSponsored);
                    const regular = bakeries.filter(b => !sponsored.find(s => s.id === b.id));

                    const bienvenida = [
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        `🏪 *Panaderías en ${selectedCity}*`,
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        ``,
                    ];

                    if (sponsored.length > 0) {
                        bienvenida.push(`⭐ *Destacadas:*`);
                        sponsored.forEach((b: any, idx: number) => {
                            const { isOpen } = isBakeryOpen(b.business_hours);
                            const closedLabel = isOpen ? '' : ' _(Cerrado)_';
                            bienvenida.push(`${numEmojis[idx] || `${idx + 1}.`}  🏠 *${b.name}*${closedLabel}`);
                            bienvenida.push(`     📍 ${b.location}`);
                        });
                        bienvenida.push(``);
                        if (regular.length > 0) bienvenida.push(`🏪 *Otras panaderías:*`);
                    }

                    regular.forEach((b: any, idx: number) => {
                        const globalIdx = sponsored.length + idx;
                        const { isOpen } = isBakeryOpen(b.business_hours);
                        const closedLabel = isOpen ? '' : ' _(Cerrado)_';
                        bienvenida.push(`${numEmojis[globalIdx] || `${globalIdx + 1}.`}  🏠 *${b.name}*${closedLabel}`);
                        bienvenida.push(`     📍 ${b.location}`);
                    });

                    bienvenida.push(``);
                    bienvenida.push(`👆 Escribe el *número* para elegir tu panadería.`);

                    await updateState({
                        step: 'BAKERY',
                        locationFilter: { region, comuna, ciudad: selectedCity }
                    });

                    await sock.sendMessage(numeroCliente, { text: bienvenida.join('\n') });
                } catch (e) {
                    await sock.sendMessage(numeroCliente, { text: "🔥 Error al cargar panaderías. Escribe *hola*." });
                }
            } else {
                await sock.sendMessage(numeroCliente, { text: "🤔 Por favor, elige un sector válido." });
            }
            return;

        } else if (state?.step === 'BAKERY') {
            const selectedIdx = parseInt(textoLimpio) - 1;

            const { data: rawBakeries } = await supabase
                .from('bakeries')
                .select('id, name, location, business_hours, max_strikes, order_expiry_minutes, is_sponsored, is_active')
                .eq('is_active', true)
                .eq('region', state.locationFilter?.region)
                .eq('comuna', state.locationFilter?.comuna)
                .eq('ciudad', state.locationFilter?.ciudad)
                .order('is_sponsored', { ascending: false })
                .order('name', { ascending: true });

            const bakeries = (rawBakeries || []).filter((b: any) => b.is_active === true || b.is_active === 'true');
            console.log(`📡 [DEBUG-STEP] Intentando seleccionar idx ${selectedIdx} de ${bakeries.length} panaderías activas.`);

            if (bakeries && selectedIdx >= 0 && selectedIdx < bakeries.length) {
                const selectedBakery = bakeries[selectedIdx];

                // 1. Verificar si el local está abierto
                const { isOpen, schedule } = isBakeryOpen(selectedBakery.business_hours);
                if (!isOpen) {
                    const closedMsg = [
                        `🏠 *${selectedBakery.name}*`,
                        ``,
                        `😔 Lo sentimos, en este momento el local se encuentra *cerrado*.`,
                        ``,
                        `🕒 *Nuestro horario de atención:*`,
                        schedule,
                        ``,
                        `Escribe *hola* cuando estemos atendiendo para hacer tu pedido. ¡Te esperamos! 🥖`,
                    ].join('\n');
                    await sock.sendMessage(numeroCliente, { text: closedMsg });
                    await clearSess();
                    return;
                }

                // 2. Verificar strikes del cliente en esta panadería
                const { data: bcData } = await supabase
                    .from('bakery_customers')
                    .select('strikes')
                    .eq('bakery_id', selectedBakery.id)
                    .eq('customer_phone', numeroCliente)
                    .single();

                const clientStrikes = bcData?.strikes || 0;
                const maxStrikes = selectedBakery.max_strikes || 3;

                if (clientStrikes >= maxStrikes) {
                    const blockMsg = [
                        `🏠 *${selectedBakery.name}*`,
                        ``,
                        `🚫 *Lo sentimos, no puedes realizar más pedidos.*`,
                        ``,
                        `Has alcanzado el límite de *strikes* por no retirar pedidos anteriores a tiempo.`,
                        ``,
                        `Si crees que esto es un error, por favor contacta directamente con la panadería.`,
                    ].join('\n');
                    await sock.sendMessage(numeroCliente, { text: blockMsg });
                    await clearSess();
                    return;
                }

                // Cargar productos de esta panadería desde la BD
                const { data: dbProducts } = await supabase
                    .from('products')
                    .select('id, name, price, sell_type, category')
                    .eq('bakery_id', selectedBakery.id)
                    .eq('is_active', true)
                    .order('category')
                    .order('name');

                if (!dbProducts || dbProducts.length === 0) {
                    await sock.sendMessage(numeroCliente, { text: `🏠 *${selectedBakery.name}*\n\n😔 Esta panadería aún no ha configurado su catálogo de productos.\n\nEscribe *hola* para elegir otra panadería.` });
                    await clearSess();
                    return;
                }

                // Obtener categorías únicas
                const uniqueCategories = [...new Set(dbProducts.map(p => p.category || 'Otros'))];

                if (uniqueCategories.length > 1) {
                    // Más de una categoría: Ir al paso CATEGORY
                    await updateState({
                        step: 'CATEGORY',
                        bakeryId: selectedBakery.id,
                        menuProducts: dbProducts,
                        locationFilter: { ...state?.locationFilter, categoryList: JSON.stringify(uniqueCategories) }
                    });

                    const catMsg = [
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        `🏠 *${selectedBakery.name}*`,
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        ``,
                        `📂 *¿Qué categoría te interesa?*`,
                        ``,
                    ];
                    uniqueCategories.forEach((cat, idx) => {
                        catMsg.push(`${numEmojis[idx] || `${idx + 1}.`}  ${cat}`);
                    });
                    catMsg.push(``);
                    catMsg.push(`👆 Escribe el número para elegir.`);
                    catMsg.push(`↩️  Escribe *0* para volver a las panaderías.`);
                    await sock.sendMessage(numeroCliente, { text: catMsg.join('\n') });
                } else {
                    // Una sola categoría: Ir directo al MENU
                    const onlyCategory = uniqueCategories[0];
                    await updateState({
                        step: 'MENU',
                        bakeryId: selectedBakery.id,
                        menuProducts: dbProducts,
                        filteredProducts: dbProducts,
                        selectedCategory: onlyCategory
                    });

                    const menuMsg = [
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        `🏠 *${selectedBakery.name}*`,
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        ``,
                    ];

                    if (selectedBakery.order_expiry_minutes) {
                        menuMsg.push(`⏳ *Nota:* Tendrás *${selectedBakery.order_expiry_minutes} minutos* para retirar tu pedido una vez listo.`);
                        menuMsg.push(``);
                    }

                    menuMsg.push(`📋 *¿Qué producto deseas?*`, ``);

                    dbProducts.forEach((p, idx) => {
                        const priceLabel = p.sell_type === 'per_kg'
                            ? `$${new Intl.NumberFormat('es-CL').format(p.price)}/kg`
                            : `$${new Intl.NumberFormat('es-CL').format(p.price)} c/u`;
                        menuMsg.push(`${numEmojis[idx] || `${idx + 1}.`}  *${p.name}* — ${priceLabel}`);
                    });

                    menuMsg.push(``);
                    menuMsg.push(`👆 Escribe el número para elegir.`);
                    menuMsg.push(`↩️  Escribe *0* para volver.`);
                    await sock.sendMessage(numeroCliente, { text: menuMsg.join('\n') });
                }
            } else {
                await sock.sendMessage(numeroCliente, { text: `🤔 Ese número no corresponde a ninguna panadería.\n\nPor favor, escribe solo el *número* que aparece al lado de la panadería que quieres.` });
            }
            return;

        } else if (state?.step === 'CATEGORY') {
            const categories = JSON.parse(state.locationFilter?.categoryList || '[]');
            const selectedIdx = parseInt(textoLimpio) - 1;

            if (textoLimpio === '0') {
                // Volver a la lista de panaderías sin borrar el carrito
                await updateState({ step: 'BAKERY', locationFilter: state.locationFilter });
                const ciudad = state.locationFilter?.ciudad || 'tu sector';
                await sock.sendMessage(numeroCliente, {
                    text: `↩️ Volviendo a las panaderías de *${ciudad}*...\n\nEscribe el *número* de la panadería que quieres.`
                });
                return;
            }

            if ((textoLimpio === 'c' || textoLimpio === 'confirmar') && cart && cart.items.length > 0) {
                await updateState({ ...state, step: 'CONFIRM' });
                const cartList = cart.items.map(i => `  • ${i.quantityLabel} ${i.name}`).join('\n');
                const confirmMsg = [
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    `🛒 *Resumen de tu Pedido*`,
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    cartList,
                    ``,
                    `💰 *Total: $${new Intl.NumberFormat('es-CL').format(cart.totalAmount)}*`,
                    ``,
                    `👇 *¿Qué deseas hacer?*`,
                    ``,
                    `1️⃣  ➕ Agregar más productos`,
                    `2️⃣  ✅ Confirmar pedido`,
                    `3️⃣  🗑️ Cancelar y vaciar todo`,
                    `4️⃣  ✏️ Quitar o modificar productos`,
                ];
                await sock.sendMessage(numeroCliente, { text: confirmMsg.join('\n') });
                return;
            }

            if (selectedIdx >= 0 && selectedIdx < categories.length) {
                const selectedCat = categories[selectedIdx];
                const filtered = (state.menuProducts || []).filter(p => (p.category || 'Otros') === selectedCat);

                await updateState({
                    step: 'MENU',
                    bakeryId: state.bakeryId,
                    menuProducts: state.menuProducts,
                    filteredProducts: filtered,
                    selectedCategory: selectedCat,
                    locationFilter: state.locationFilter
                });

                const menuMsg = [
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    `📂 *${selectedCat}*`,
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    ``,
                ];

                filtered.forEach((p, idx) => {
                    const priceLabel = p.sell_type === 'per_kg'
                        ? `$${new Intl.NumberFormat('es-CL').format(p.price)}/kg`
                        : `$${new Intl.NumberFormat('es-CL').format(p.price)} c/u`;
                    menuMsg.push(`${numEmojis[idx] || `${idx + 1}.`}  *${p.name}* — ${priceLabel}`);
                });

                menuMsg.push(``);
                menuMsg.push(`👆 Escribe el número para elegir.`);
                menuMsg.push(`↩️  Escribe *0* para volver a categorías.`);
                await sock.sendMessage(numeroCliente, { text: menuMsg.join('\n') });
            } else {
                await sock.sendMessage(numeroCliente, { text: "🤔 Por favor, elige un número válido de la lista de categorías." });
            }
            return;

        } else if (state?.step === 'MENU') {
            const products = state.filteredProducts || [];
            const selectedIdx = parseInt(textoLimpio) - 1;

            if (textoLimpio === '0') {
                // Volver a categorías si hay más de una, si no, volver a panadería
                const categories = JSON.parse(state.locationFilter?.categoryList || '[]');
                if (categories.length > 1) {
                    await updateState({ ...state, step: 'CATEGORY' });
                    const catMsg = [
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        `📂 *Categorías*`,
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        ``,
                    ];
                    categories.forEach((cat: string, idx: number) => catMsg.push(`${numEmojis[idx] || `${idx + 1}.`}  ${cat}`));
                    catMsg.push(``, `👆 Escribe el número para elegir.`);
                    catMsg.push(`↩️  Escribe *0* para volver a las panaderías.`);
                    await sock.sendMessage(numeroCliente, { text: catMsg.join('\n') });
                } else {
                    // Si solo hay una categoría, volver al listado de panaderías
                    await updateState({ step: 'BAKERY', locationFilter: state.locationFilter });
                    await sock.sendMessage(numeroCliente, {
                        text: `↩️ De acuerdo. Escribe el *número* de la panadería para volver a intentarlo.`
                    });
                }
                return;
            }

            if ((textoLimpio === 'c' || textoLimpio === 'confirmar') && cart && cart.items.length > 0) {
                await updateState({ ...state, step: 'CONFIRM' });
                const cartList = cart.items.map(i => `  • ${i.quantityLabel} ${i.name}`).join('\n');
                const confirmMsg = [
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    `🛒 *Resumen de tu Pedido*`,
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    cartList,
                    ``,
                    `💰 *Total: $${new Intl.NumberFormat('es-CL').format(cart.totalAmount)}*`,
                    ``,
                    `👇 *¿Qué deseas hacer?*`,
                    ``,
                    `1️⃣  ➕ Agregar más productos`,
                    `2️⃣  ✅ Confirmar pedido`,
                    `3️⃣  🗑️ Cancelar y vaciar todo`,
                    `4️⃣  ✏️ Quitar o modificar productos`,
                ];
                await sock.sendMessage(numeroCliente, { text: confirmMsg.join('\n') });
                return;
            }

            if (selectedIdx >= 0 && selectedIdx < products.length) {
                const selected = products[selectedIdx];
                await updateState({
                    step: 'WEIGHT',
                    tempProduct: selected,
                    bakeryId: state.bakeryId,
                    menuProducts: state.menuProducts,
                    filteredProducts: state.filteredProducts,
                    selectedCategory: state.selectedCategory,
                    locationFilter: state.locationFilter
                });

                if (selected.sell_type === 'per_unit') {
                    // Producto por unidad
                    const qtyMsg = [
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        `🧺 *${selected.name}*`,
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        ``,
                        `🔢 *¿Cuántas unidades quieres?*`,
                        ``,
                    ];
                    UNIT_OPTIONS.forEach((u, idx) => {
                        const precio = new Intl.NumberFormat('es-CL').format(u.qty * selected.price);
                        qtyMsg.push(`${numEmojis[idx] || `${idx + 1}.`}  ${u.label}  →  *$${precio}*`);
                    });
                    qtyMsg.push(``, `👆 Escribe el número para elegir.`);
                    qtyMsg.push(`↩️  Escribe *0* para volver al menú.`);
                    await sock.sendMessage(numeroCliente, { text: qtyMsg.join('\n') });
                } else {
                    // Producto por kilo
                    const weightMsg = [
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        `🧺 *${selected.name}*`,
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        ``,
                        `⚖️ *¿Cuánto quieres llevar?*`,
                        ``,
                    ];
                    WEIGHT_OPTIONS.forEach((w, idx) => {
                        const precio = new Intl.NumberFormat('es-CL').format(Math.round(w.kg * selected.price));
                        weightMsg.push(`${numEmojis[idx] || `${idx + 1}.`}  ${w.label}  →  *$${precio}*`);
                    });
                    weightMsg.push(``, `👆 Escribe el número para elegir.`);
                    weightMsg.push(`↩️  Escribe *0* para volver al menú.`);
                    await sock.sendMessage(numeroCliente, { text: weightMsg.join('\n') });
                }
            } else {
                await sock.sendMessage(numeroCliente, { text: `🤔 Ese número no está en la lista.\n\nEscribe un número del *1* al *${products.length}* para elegir tu producto.` });
            }
            return;

        } else if (state?.step === 'WEIGHT') {
            const product = state.tempProduct!;
            const selectedIdx = parseInt(textoLimpio) - 1;

            if (textoLimpio === '0') {
                // Volver al menú filtrado
                await updateState({
                    step: 'MENU',
                    bakeryId: state.bakeryId,
                    menuProducts: state.menuProducts,
                    filteredProducts: state.filteredProducts,
                    selectedCategory: state.selectedCategory,
                    locationFilter: state.locationFilter
                });

                const menuMsg = [
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    `📂 *${state.selectedCategory}*`,
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    ``,
                    `➕ *¿Qué otro producto quieres agregar?*`,
                    ``,
                ];
                state.filteredProducts?.forEach((p, idx) => {
                    const priceLabel = p.sell_type === 'per_kg' ? `$${new Intl.NumberFormat('es-CL').format(p.price)}/kg` : `$${new Intl.NumberFormat('es-CL').format(p.price)} c/u`;
                    menuMsg.push(`${numEmojis[idx] || `${idx + 1}.`}  *${p.name}* — ${priceLabel}`);
                });
                menuMsg.push(``, `👆 Escribe el número para elegir.`);
                menuMsg.push(`↩️  Escribe *0* para volver.`);
                await sock.sendMessage(numeroCliente, { text: menuMsg.join('\n') });
                return;
            }

            let quantity = 0;
            let quantityLabel = '';
            let subtotal = 0;
            let validChoice = false;

            if (product.sell_type === 'per_unit') {
                if (selectedIdx >= 0 && selectedIdx < UNIT_OPTIONS.length) {
                    const opt = UNIT_OPTIONS[selectedIdx];
                    quantity = opt.qty;
                    quantityLabel = `${opt.qty}x`;
                    subtotal = opt.qty * product.price;
                    validChoice = true;
                }
            } else {
                if (selectedIdx >= 0 && selectedIdx < WEIGHT_OPTIONS.length) {
                    const opt = WEIGHT_OPTIONS[selectedIdx];
                    quantity = opt.kg;
                    quantityLabel = formatQuantity(opt.kg, 'per_kg');
                    subtotal = Math.round(opt.kg * product.price);
                    validChoice = true;
                }
            }

            if (validChoice) {
                const userCart = cart || { items: [], totalAmount: 0 };
                userCart.items.push({
                    name: product.name,
                    quantity,
                    quantityLabel,
                    subtotal,
                    unitPrice: product.price,
                    sell_type: product.sell_type
                });
                userCart.totalAmount += subtotal;
                await updateCart(userCart);

                await updateState({
                    step: 'CONFIRM',
                    bakeryId: state.bakeryId,
                    menuProducts: state.menuProducts,
                    filteredProducts: state.filteredProducts,
                    selectedCategory: state.selectedCategory,
                    locationFilter: state.locationFilter
                });

                const cartList = userCart.items.map(i => `  • ${i.quantityLabel} ${i.name}`).join('\n');

                const confirmMsg = [
                    `✅ *¡Producto agregado!*`,
                    ``,
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    `🛒 *Tu pedido actual:*`,
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    cartList,
                    ``,
                    `💰 *Total: $${new Intl.NumberFormat('es-CL').format(userCart.totalAmount)}*`,
                    ``,
                    `👇 *¿Qué deseas hacer?*`,
                    ``,
                    `1️⃣  ➕ Agregar más productos`,
                    `2️⃣  ✅ Confirmar pedido`,
                    `3️⃣  🗑️ Cancelar y vaciar todo`,
                    `4️⃣  ✏️ Quitar o modificar productos`,
                ];

                await sock.sendMessage(numeroCliente, { text: confirmMsg.join('\n') });
            } else {
                const maxOpt = product.sell_type === 'per_unit' ? UNIT_OPTIONS.length : WEIGHT_OPTIONS.length;
                await sock.sendMessage(numeroCliente, { text: `🤔 Ese número no está en la lista.\n\nEscribe un número del *1* al *${maxOpt}* para elegir la cantidad.` });
            }
            return;

        } else if (state?.step === 'CONFIRM') {

            if (textoLimpio === '1') {
                const categories = JSON.parse(state.locationFilter?.categoryList || '[]');

                if (categories.length > 1) {
                    await updateState({
                        step: 'CATEGORY',
                        bakeryId: state.bakeryId,
                        menuProducts: state.menuProducts,
                        locationFilter: state.locationFilter
                    });

                    const catMsg = [
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        `📂 *Categorías*`,
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        ``,
                    ];
                    categories.forEach((cat: string, idx: number) => {
                        catMsg.push(`${numEmojis[idx] || `${idx + 1}.`}  ${cat}`);
                    });

                    catMsg.push(``);
                    catMsg.push(`👆 Escribe el número para elegir.`);
                    catMsg.push(`↩️  Escribe *0* para volver.`);
                    if (cart && cart.items.length > 0) {
                        catMsg.push(`✅ Escribe *C* para confirmar y ver carrito.`);
                    }
                    await sock.sendMessage(numeroCliente, { text: catMsg.join('\n') });
                } else {
                    await updateState({
                        step: 'MENU',
                        bakeryId: state.bakeryId,
                        menuProducts: state.menuProducts,
                        filteredProducts: state.filteredProducts,
                        selectedCategory: state.selectedCategory,
                        locationFilter: state.locationFilter
                    });

                    const menuMsg = [
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        `📂 *${state.selectedCategory}*`,
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        ``,
                        `➕ *¿Qué otro producto quieres agregar?*`,
                        ``,
                    ];
                    state.filteredProducts?.forEach((p, idx) => {
                        const priceLabel = p.sell_type === 'per_kg' ? `$${new Intl.NumberFormat('es-CL').format(p.price)}/kg` : `$${new Intl.NumberFormat('es-CL').format(p.price)} c/u`;
                        menuMsg.push(`${numEmojis[idx] || `${idx + 1}.`}  *${p.name}* — ${priceLabel}`);
                    });
                    menuMsg.push(``);
                    menuMsg.push(`👆 Escribe el número para elegir.`);
                    menuMsg.push(`↩️  Escribe *0* para volver.`);
                    if (cart && cart.items.length > 0) {
                        menuMsg.push(`✅ Escribe *C* para confirmar y ver carrito.`);
                    }
                    await sock.sendMessage(numeroCliente, { text: menuMsg.join('\n') });
                }
                return;

            } else if (textoLimpio === '3') {
                cart = { items: [], totalAmount: 0 }; await saveSession(numeroCliente, state, cart);
                const categories = JSON.parse(state.locationFilter?.categoryList || '[]');

                if (categories.length > 1) {
                    await updateState({
                        step: 'CATEGORY',
                        bakeryId: state.bakeryId,
                        menuProducts: state.menuProducts,
                        locationFilter: state.locationFilter
                    });

                    const catMsg = [
                        `🗑️ *Carrito vaciado.*`,
                        ``,
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        `📂 *Categorías*`,
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        ``,
                    ];
                    categories.forEach((cat: string, idx: number) => {
                        catMsg.push(`${numEmojis[idx] || `${idx + 1}.`}  ${cat}`);
                    });

                    catMsg.push(``);
                    catMsg.push(`👆 Escribe el número para elegir.`);
                    catMsg.push(`↩️  Escribe *0* para cambiar de panadería.`);
                    await sock.sendMessage(numeroCliente, { text: catMsg.join('\n') });
                } else {
                    await updateState({
                        step: 'MENU',
                        bakeryId: state.bakeryId,
                        menuProducts: state.menuProducts,
                        filteredProducts: state.menuProducts,
                        selectedCategory: state.selectedCategory,
                        locationFilter: state.locationFilter
                    });

                    const menuMsg = [
                        `🗑️ *Carrito vaciado.*`,
                        ``,
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        `📋 *¿Qué producto deseas llevar?*`,
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        ``,
                    ];
                    state.menuProducts?.forEach((p, idx) => {
                        const priceLabel = p.sell_type === 'per_kg' ? `$${new Intl.NumberFormat('es-CL').format(p.price)}/kg` : `$${new Intl.NumberFormat('es-CL').format(p.price)} c/u`;
                        menuMsg.push(`${numEmojis[idx] || `${idx + 1}.`}  *${p.name}* — ${priceLabel}`);
                    });
                    menuMsg.push(``, `👆 Escribe el número para elegir.`);
                    await sock.sendMessage(numeroCliente, { text: menuMsg.join('\n') });
                }
                return;

            } else if (textoLimpio === '4' || textoLimpio === 'quitar' || textoLimpio === 'eliminar' || textoLimpio === 'modificar') {

                if (!cart || cart.items.length === 0) {
                    await sock.sendMessage(numeroCliente, { text: '😅 Tu carrito está vacío.' });
                    return;
                }

                await updateState({
                    ...state,
                    step: 'REMOVE_SELECT'
                });

                const listMsg = [
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    `✏️ *Quitar o modificar productos*`,
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    ``,
                    `Selecciona el número del producto que deseas modificar:`,
                    ``,
                ];
                cart.items.forEach((item, idx) => {
                    listMsg.push(`${numEmojis[idx] || `${idx + 1}.`}  ${item.quantityLabel} ${item.name}`);
                });
                listMsg.push(``, `↩️  Escribe *0* para volver.`);
                await sock.sendMessage(numeroCliente, { text: listMsg.join('\n') });
                return;

            } else if (textoLimpio === '2' || textoLimpio === 'finalizar' || textoLimpio === 'pagar' || textoLimpio === 'confirmar') {

                if (!cart || cart.items.length === 0) {
                    await sock.sendMessage(numeroCliente, { text: '😅 Tu carrito está vacío.\n\nEscribe *hola* para empezar un nuevo pedido.' });
                    await clearSess();
                    return;
                }

                try {
                    // Anti-Spam
                    const { data: activeOrders } = await supabase
                        .from('orders')
                        .select('id')
                        .eq('customer_phone', numeroCliente)
                        .in('status', ['PENDING', 'READY']);

                    if (activeOrders && activeOrders.length >= 2) {
                        await sock.sendMessage(numeroCliente, { text: '⚠️ Ya tienes 2 pedidos pendientes.\n\nPor favor, retira los que tienes antes de hacer uno nuevo. ¡Así evitamos confusiones! 😊' });
                        return;
                    }

                    // Verificar strikes de último minuto (por si acaso)
                    const { data: bakery } = await supabase.from('bakeries').select('max_strikes, order_expiry_minutes').eq('id', state.bakeryId).single();
                    const { data: bc } = await supabase.from('bakery_customers').select('strikes').eq('bakery_id', state.bakeryId).eq('customer_phone', numeroCliente).single();
                    if (bc && bc.strikes >= (bakery?.max_strikes || 3)) {
                        await sock.sendMessage(numeroCliente, { text: '🚫 Lo sentimos, no puedes finalizar el pedido por exceso de strikes en esta panadería.' });
                        await clearSess();
                        return;
                    }

                    // Asegurar cliente con nombre de WhatsApp
                    // 2. Diagnóstico y Resolución de LID (Identificadores de Privacidad)
                    let realPhone = null;

                    // DEPURACIÓN: Ver objeto mensaje si es un LID
                    if (numeroCliente.includes('@lid')) {
                        console.log('🔍 [LID DEBUG] Analizando mensaje de LID:', numeroCliente);
                        console.log('📦 [LID DEBUG] Key:', JSON.stringify(msg.key, null, 2));
                        // Intentar sacar de metadata secundaria (remoteJidAlt es donde está el número real)
                        const altPhone = (msg.key as any).remoteJidAlt?.split('@')[0] || (msg as any).participantAlt?.split('@')[0] || (msg.key as any).participant?.split('@')[0];

                        if (altPhone && altPhone.startsWith('56')) {
                            console.log('✨ [LID DEBUG] ¡Número real encontrado en metadata!', altPhone);
                            realPhone = altPhone;
                        }
                    }

                    const customerData: any = {
                        phone_number: numeroCliente,
                        name: pushName
                    };

                    // Solo intentar guardar real_phone si lo detectamos
                    if (realPhone) {
                        customerData.real_phone = realPhone;
                    }

                    try {
                        await supabase.from('customers').upsert(customerData, { onConflict: 'phone_number' });
                    } catch (e) {
                        console.log('💡 Nota: No se pudo guardar real_phone en customers. Ignorando...');
                    }

                    // Registrar relación cliente-panadería para broadcast
                    await supabase.from('bakery_customers').upsert(
                        { bakery_id: state.bakeryId, customer_phone: numeroCliente, customer_name: pushName, last_order_at: new Date().toISOString() },
                        { onConflict: 'bakery_id,customer_phone' }
                    );

                    const shortCode = await generateNextShortCode(state.bakeryId!);

                    const itemsDesc = cart.items.map(i => `- ${i.quantityLabel} ${i.name} | $${new Intl.NumberFormat('es-CL').format(i.subtotal)}`).join('\n');

                    const payloadInsert: any = {
                        short_code: shortCode,
                        customer_phone: numeroCliente,
                        customer_name: pushName,
                        status: 'PENDING',
                        total_amount: cart.totalAmount,
                        bakery_id: state.bakeryId,
                        items_description: itemsDesc
                    };

                    // Guardar el teléfono real si lo capturamos (requiere columna customer_real_phone)
                    if (realPhone) {
                        payloadInsert.customer_real_phone = realPhone;
                    }

                    const resp = await supabase.from('orders').insert(payloadInsert);

                    if (resp.error) throw resp.error;

                    const finalTotal = cart.totalAmount;
                    const finalItems = itemsDesc;
                    cart = { items: [], totalAmount: 0 }; await saveSession(numeroCliente, state, cart);
                    await clearSess();

                    const confirmText = [
                        `🎉 *¡Pedido confirmado!*`,
                        ``,
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        `🎫 Tu código de retiro es:`,
                        `*${shortCode}*`,
                        `━━━━━━━━━━━━━━━━━━━━━`,
                        ``,
                        `📋 *Lo que pediste:*`,
                        finalItems,
                        ``,
                        `💰 *Total a pagar en caja: $${new Intl.NumberFormat('es-CL').format(finalTotal)}*`,
                        ``,
                        `⏳ Te avisaremos por aquí apenas tu pedido esté listo.`,
                        `*Importante:* Tendrás *${bakery?.order_expiry_minutes || 30} minutos* para retirarlo una vez que te avisemos.`,
                        ``,
                        `Mientras tanto, puedes ir acercándote al local. 🚶`,
                    ].join('\n');

                    await sock.sendMessage(numeroCliente, { text: confirmText });

                } catch (error) {
                    console.error("Error procesando pedido:", error);
                    await sock.sendMessage(numeroCliente, { text: '😔 Tuvimos un problema al procesar tu pedido.\n\nPor favor, intenta de nuevo en unos segundos. Si el problema continúa, escribe *hola* para empezar de nuevo.' });
                }
                return;

            } else {
                const helpMsg = [
                    `🤔 No entendí tu respuesta.`,
                    ``,
                    `Escribe el *número* de lo que quieres hacer:`,
                    ``,
                    `1️⃣  ➕ Agregar más productos`,
                    `2️⃣  ✅ Confirmar mi pedido`,
                    `3️⃣  🗑️ Cancelar todo`,
                    `4️⃣  ✏️ Quitar productos`,
                ];
                await sock.sendMessage(numeroCliente, { text: helpMsg.join('\n') });
                return;
            }
        } else if (state?.step === 'REMOVE_SELECT') {

            const selectedIdx = parseInt(textoLimpio) - 1;

            if (textoLimpio === '0') {
                await updateState({ ...state, step: 'CONFIRM' });
                const cartList = cart?.items.map(i => `  • ${i.quantityLabel} ${i.name}`).join('\n') || '';
                const confirmMsg = [
                    `↩️ Volviendo al resumen de tu pedido.`,
                    ``,
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    `🛒 *Tu pedido:*`,
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    cartList,
                    ``,
                    `💰 *Total: $${new Intl.NumberFormat('es-CL').format(cart?.totalAmount || 0)}*`,
                    ``,
                    `1️⃣  ➕ Agregar  |  2️⃣  ✅ Confirmar  |  3️⃣  🗑️ Cancelar  |  4️⃣  ✏️ Modificar`,
                ];
                await sock.sendMessage(numeroCliente, { text: confirmMsg.join('\n') });
                return;
            }

            if (cart && selectedIdx >= 0 && selectedIdx < cart.items.length) {
                const item = cart.items[selectedIdx];
                await updateState({
                    ...state,
                    step: 'EDIT_ACTION',
                    selectedItemIdx: selectedIdx
                });

                const actionMsg = [
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    `✏️ *${item.name}* (${item.quantityLabel})`,
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    ``,
                    `¿Qué deseas hacer?`,
                    ``,
                    `1️⃣  ➕ Agregar más`,
                    `2️⃣  ➖ Quitar`,
                    ``,
                    `↩️  Escribe *0* para volver.`,
                ];
                await sock.sendMessage(numeroCliente, { text: actionMsg.join('\n') });
            } else {
                await sock.sendMessage(numeroCliente, { text: '🤔 Por favor, elige un número válido de la lista o escribe *0* para volver.' });
            }
            return;

        } else if (state?.step === 'EDIT_ACTION') {

            const selectedIdx = (state as any).selectedItemIdx;
            const item = cart?.items[selectedIdx];

            if (textoLimpio === '0') {
                await updateState({ ...state, step: 'REMOVE_SELECT' });
                await sock.sendMessage(numeroCliente, { text: '👍 Volviendo a la lista de productos.' });
                return;
            }

            if (textoLimpio === '1' || textoLimpio === '2') {
                const action = textoLimpio === '1' ? 'ADD' : 'REMOVE';
                await updateState({ ...state, step: 'EDIT_AMOUNT', editAction: action });

                const prompt = action === 'ADD' ? 'agregar' : 'quitar';
                const unitLabel = item?.sell_type === 'per_unit' ? 'unidades' : 'kg/gramos';

                await sock.sendMessage(numeroCliente, {
                    text: `🔢 ¿Cuántas *${unitLabel}* deseas ${prompt}? (Escribe el número)`
                });
            } else {
                await sock.sendMessage(numeroCliente, { text: '🤔 Por favor, elige *1* para agregar o *2* para quitar.' });
            }
            return;

        } else if (state?.step === 'EDIT_AMOUNT') {

            const amount = parseFloat(textoLimpio.replace(',', '.'));
            const selectedIdx = (state as any).selectedItemIdx;
            const action = state.editAction;

            if (isNaN(amount) || amount <= 0) {
                await sock.sendMessage(numeroCliente, { text: '⚠️ Por favor, ingresa un número válido mayor a cero.' });
                return;
            }

            if (cart && selectedIdx !== undefined && action) {
                const item = cart.items[selectedIdx];
                if (!item) return;

                // Validar que si es por unidad, el número sea entero
                if (item.sell_type === 'per_unit' && (textoLimpio.includes('.') || textoLimpio.includes(',') || !Number.isInteger(amount))) {
                    await sock.sendMessage(numeroCliente, { text: '⚠️ Este producto se vende por unidad. Por favor, ingresa un número entero (sin puntos ni comas).' });
                    return;
                }

                const currentQty = item.quantity;

                if (action === 'REMOVE') {
                    if (amount >= currentQty) {
                        // Quitar todo el item
                        cart.totalAmount -= item.subtotal;
                        cart.items.splice(selectedIdx, 1);
                        await sock.sendMessage(numeroCliente, { text: `✅ Se ha quitado *${item.name}* del carrito.` });
                    } else {
                        // Quitar parcial
                        const newQty = currentQty - amount;
                        const subtotalToSub = Math.round(amount * item.unitPrice);

                        item.quantity = newQty;
                        item.subtotal -= subtotalToSub;
                        cart.totalAmount -= subtotalToSub;

                        item.quantityLabel = formatQuantity(newQty, item.sell_type);
                        await sock.sendMessage(numeroCliente, { text: `✅ Se ha actualizado la cantidad de *${item.name}*.` });
                    }
                } else {
                    // Agregar cantidad
                    const newQty = currentQty + amount;
                    const subtotalToAdd = Math.round(amount * item.unitPrice);

                    item.quantity = newQty;
                    item.subtotal += subtotalToAdd;
                    cart.totalAmount += subtotalToAdd;

                    item.quantityLabel = formatQuantity(newQty, item.sell_type);
                    await sock.sendMessage(numeroCliente, { text: `✅ Se ha aumentado la cantidad de *${item.name}*.` });
                }

                // Redirigir al resumen del carrito (CONFIRM) con el detalle actualizado
                await updateState({
                    ...state,
                    step: 'CONFIRM'
                });

                const cartList = cart.items.map(i => `  • ${i.quantityLabel} ${i.name}`).join('\n');
                const confirmMsg = [
                    `✅ *Pedido Actualizado*`,
                    ``,
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    `🛒 *Tu Pedido Actual:*`,
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    cartList,
                    ``,
                    `💰 *Total: $${new Intl.NumberFormat('es-CL').format(cart.totalAmount)}*`,
                    ``,
                    `👇 *¿Qué deseas hacer?*`,
                    ``,
                    `1️⃣  ➕ Agregar más productos`,
                    `2️⃣  ✅ Confirmar pedido`,
                    `3️⃣  🗑️ Cancelar y vaciar todo`,
                    `4️⃣  ✏️ Quitar o modificar productos`,
                ];
                await sock.sendMessage(numeroCliente, { text: confirmMsg.join('\n') });
            }
            return;
        }

        console.log(`[BOT] ⚠️ Activando FALLBACK para ${numeroCliente} (Estado actual: ${state?.step})`);
        // FALLBACK
        const fallbackMsg = [
            `👋 ¡Hola! Soy el asistente de *Ahora Pan*. 🍞`,
            ``,
            `Para empezar a hacer tu pedido, escribe *hola*.`,
            ``,
            `Te guiaré paso a paso. 😊🥖`,
        ].join('\n');
        await sock.sendMessage(numeroCliente, { text: fallbackMsg });

    } catch (globalError) {
        console.error('[BOT] 🔥 ERROR FATAL INESPERADO:', globalError);
    }
}
