
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function testResolution() {
    const { state } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log('✅ Conectado para prueba.');
            const lids = ['24653212979360@s.whatsapp.net', '246883461136608@s.whatsapp.net'];
            
            for (const lid of lids) {
                console.log(`🔍 Probando resolución para: ${lid}`);
                try {
                    // Intentar diversas formas de resolución
                    const result = await sock.onWhatsApp(lid);
                    console.log(`onWhatsApp result:`, JSON.stringify(result));
                    
                    // Intentar obtener contacto
                    // const contact = await sock.getContact(lid);
                    // console.log(`getContact result:`, JSON.stringify(contact));
                } catch (e) {
                    console.log(`❌ Error resolviendo ${lid}:`, e.message);
                }
            }
            process.exit(0);
        }
    });
}

testResolution();
