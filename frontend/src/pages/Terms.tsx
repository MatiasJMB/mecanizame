import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ShieldCheck, Scale, AlertCircle, CreditCard, Gavel, Cookie, MessageCircleWarning, DatabaseZap, LockKeyhole, FileText, RefreshCw, Store, UserCheck, ExternalLink, CheckCircle2, BellRing, ReceiptText, Landmark, LifeBuoy, Users, ClipboardCheck, Ban, AlertTriangle, Settings } from 'lucide-react';

export default function Terms() {
  const navigate = useNavigate();

  useEffect(() => { 
    document.title = 'AhoraPan - Términos y Condiciones Legales'; 
    window.scrollTo(0, 0); 
  }, []);

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Intentamos cerrar la pestaña (funciona si fue abierta con target="_blank")
    window.close();

    // Si la ventana no se cerró (porque el navegador lo bloqueó), 
    // intentamos volver atrás en el historial.
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Si no hay historial (nueva pestaña), la única opción es volver al registro,
      // pero el usuario ya tiene la pestaña original abierta, así que es un fallback.
      navigate('/registro');
    }
  };

  const legalSummary = [
    { icon: ShieldCheck, label: 'Datos protegidos', value: 'Ley 19.628 y adecuación Ley 21.719' },
    { icon: MessageCircleWarning, label: 'Canal externo', value: 'WhatsApp/Meta opera bajo políticas propias' },
    { icon: CreditCard, label: 'Pagos premium', value: 'Activaciones prepagadas y verificables' },
    { icon: Store, label: 'Rol del comercio', value: 'La panadería responde por precios, stock y retiro' }
  ];

  const sections = [
    ['datos', 'Datos y privacidad'],
    ['whatsapp', 'WhatsApp y mensajería'],
    ['cookies', 'Cookies'],
    ['pagos', 'Pagos'],
    ['servicio', 'Rol de AhoraPan'],
    ['cuenta', 'Cuenta'],
    ['propiedad', 'Propiedad intelectual'],
    ['soporte', 'Soporte'],
    ['fraude', 'Antifraude'],
    ['termino', 'Suspensión'],
    ['cambios', 'Cambios'],
    ['ley', 'Ley aplicable']
  ];

  const referenceLinks = [
    { label: 'Ley 19.628 - Protección de la Vida Privada', href: 'https://www.leychile.cl/navegar?idNorma=141599' },
    { label: 'Ley 19.496 - Derechos del Consumidor', href: 'https://www.leychile.cl/navegar?idNorma=61438' },
    { label: 'SERNAC - Comercio electrónico', href: 'https://www.sernac.cl/portal/618/w3-propertyvalue-20982.html' },
    { label: 'WhatsApp Business Terms', href: 'https://www.whatsapp.com/legal/business-terms' },
    { label: 'SumUp - Términos del proveedor de pago', href: 'https://www.sumup.com/es-us/terms/' }
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 md:p-12 lg:p-20 relative overflow-hidden">
      {/* Lights background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[90px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[90px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="mb-12">
          <button 
            onClick={handleClose}
            className="flex items-center gap-2 text-gray-500 hover:text-orange-500 transition-colors font-bold text-sm mb-8 group w-fit cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Volver
          </button>
          <div className="flex items-center gap-6 mb-6">
            <div className="bg-orange-600/20 p-4 rounded-3xl border border-orange-500/20 shadow-lg shadow-orange-950/20 flex-shrink-0">
              <Scale className="w-10 h-10 text-orange-500" />
            </div>
            <div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none mb-3 text-white">Términos, Condiciones y Privacidad</h1>
              <p className="text-orange-500/80 font-black uppercase tracking-[0.2em] text-[10px]">Actualizado conforme a legislación chilena: Abril 2026</p>
            </div>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed max-w-3xl">
            Este documento regula el registro, acceso, contratación y uso de <strong>AhoraPan</strong>, plataforma tecnológica creada para que panaderías, pastelerías y comercios afines puedan recibir pedidos por WhatsApp, administrar productos, configurar horarios, gestionar clientes, operar notificaciones, revisar estados de preparación y utilizar herramientas premium como <strong>ALERTA PAN</strong>. Al crear una cuenta, registrar un establecimiento, activar el bot, contratar funciones pagadas o permitir que sus clientes interactúen con el servicio, usted declara que leyó, entendió y aceptó estas condiciones. Si actúa en nombre de una empresa, sociedad, emprendimiento, sucursal o tercero, declara contar con facultades suficientes para obligarlo frente a AhoraPan.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
            {legalSummary.map((item) => (
              <div key={item.label} className="bg-gray-900/50 border border-white/5 rounded-3xl p-5 shadow-xl shadow-black/10">
                <div className="w-10 h-10 rounded-2xl bg-orange-600/10 border border-orange-500/20 flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-white text-xs font-black uppercase tracking-[0.18em] mb-1">{item.label}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start pb-20">
          <aside className="lg:sticky lg:top-8 space-y-4">
            <div className="bg-gray-900/60 backdrop-blur-xl border border-white/5 rounded-[2rem] p-5 shadow-2xl">
              <p className="text-orange-500 font-black uppercase tracking-[0.2em] text-[10px] mb-4">Índice legal</p>
              <nav className="space-y-1">
                {sections.map(([id, label], index) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-gray-500 hover:text-white hover:bg-gray-950/60 transition-all"
                  >
                    <span className="w-6 h-6 rounded-lg bg-gray-950 border border-white/5 flex items-center justify-center text-[10px] text-orange-500">{index + 1}</span>
                    {label}
                  </a>
                ))}
              </nav>
            </div>

            <div className="bg-orange-600/5 border border-orange-500/10 rounded-[2rem] p-5">
              <p className="text-white font-black text-xs uppercase tracking-[0.18em] mb-3 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-orange-500" /> Referencias útiles
              </p>
              <div className="space-y-2">
                {referenceLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-black/20 p-3 text-[11px] font-bold leading-relaxed text-gray-400 hover:border-orange-500/20 hover:text-orange-400 transition-all"
                  >
                    {link.label}
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 text-gray-600 group-hover:text-orange-500" />
                  </a>
                ))}
              </div>
            </div>
          </aside>

          <div className="space-y-8">
          {/* 1. Privacidad y Protección de Datos (Ley 19.628) */}
          <section id="datos" className="scroll-mt-8 bg-gray-900/60 backdrop-blur-xl border border-orange-500/10 p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-orange-400"></div>
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-white">
              <ShieldCheck className="w-7 h-7 text-orange-500" /> 1. Protección de Datos (Ley N° 19.628)
            </h2>
            <div className="text-gray-400 text-sm space-y-5 leading-relaxed">
              <p>
                AhoraPan trata datos personales y comerciales de acuerdo con la <strong>Ley N° 19.628 sobre Protección de la Vida Privada</strong>, la normativa chilena vigente y los estándares incorporados por la <strong>Ley N° 21.719</strong>, cuya entrada en vigencia general está prevista para el 1 de diciembre de 2026. La plataforma aplica criterios de finalidad, proporcionalidad, confidencialidad, seguridad, transparencia y responsabilidad en el tratamiento de la información necesaria para prestar el servicio.
              </p>
              <p>
                Para estos términos, el <strong>Cliente</strong> corresponde a la panadería, comercio, titular de cuenta, administrador o usuario autorizado que utiliza AhoraPan. El <strong>Consumidor Final</strong> es la persona que realiza pedidos o interactúa con el bot de una panadería por WhatsApp. Los <strong>Datos</strong> comprenden información de cuentas, establecimientos, productos, pedidos, números telefónicos, preferencias de retiro, registros operacionales, comunicaciones, configuraciones del panel y antecedentes técnicos necesarios para mantener la plataforma funcionando correctamente.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/20 border border-white/5 rounded-2xl p-5">
                  <p className="text-white font-black text-xs uppercase tracking-[0.18em] mb-2">Finalidad legítima</p>
                  <p>La información se utiliza para crear cuentas, autenticar usuarios, operar el Dashboard, mostrar catálogos en WhatsApp, registrar pedidos, emitir códigos de retiro, gestionar horarios, procesar avisos, activar recordatorios, aplicar reglas antifraude, entregar soporte, procesar pagos cuando corresponda y mejorar la estabilidad del servicio.</p>
                </div>
                <div className="bg-black/20 border border-white/5 rounded-2xl p-5">
                  <p className="text-white font-black text-xs uppercase tracking-[0.18em] mb-2">Responsabilidad del comercio</p>
                  <p>La Panadería declara que cuenta con autorización, relación comercial o fundamento suficiente para cargar y utilizar datos de sus clientes, especialmente cuando envía alertas masivas, importa números telefónicos, activa recordatorios o solicita comunicaciones por WhatsApp.</p>
                </div>
              </div>
              <p>
                AhoraPan no vende, arrienda ni comercializa bases de datos de Clientes o Consumidores Finales a terceros con fines publicitarios ajenos a la plataforma. La información podrá ser tratada por proveedores indispensables para operar el servicio, como infraestructura, autenticación, base de datos, hosting, mensajería, pagos, soporte o analítica operacional. Dichos proveedores pueden incluir, entre otros, Supabase, WhatsApp, Meta, SumUp, Vercel u otros servicios equivalentes, siempre dentro del alcance necesario para ejecutar la funcionalidad contratada.
              </p>
              <p>
                El Cliente y, cuando corresponda, los Consumidores Finales podrán solicitar acceso, rectificación, cancelación, oposición, bloqueo, portabilidad o eliminación de sus datos conforme a la legislación aplicable. AhoraPan podrá pedir antecedentes razonables para verificar identidad, legitimidad y alcance de la solicitud. Cuando la solicitud se relacione directamente con una compra, reclamo, boleta, retiro, devolución o relación comercial con la Panadería, el Cliente deberá colaborar de buena fe para responder al titular de los datos.
              </p>
              <p>
                Los datos se conservarán durante el tiempo necesario para prestar el servicio, respaldar operaciones, resolver incidencias, mantener trazabilidad de pedidos, cumplir obligaciones legales, prevenir abusos y defender derechos. Una vez terminada la relación comercial, AhoraPan podrá conservar información mínima cuando sea necesaria para fines contables, auditoría, seguridad, soporte, cumplimiento normativo o defensa frente a reclamos.
              </p>
              <p>
                Debido al uso de proveedores tecnológicos globales, ciertos datos podrían alojarse o procesarse fuera de Chile. Al utilizar la plataforma, el Cliente acepta dichas transferencias en la medida necesaria para la prestación del servicio, sin perjuicio de las garantías exigibles bajo la normativa chilena vigente o futura.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="rounded-2xl border border-white/5 bg-gray-950/40 p-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-3" />
                  <p className="text-white font-black text-xs uppercase tracking-[0.16em] mb-2">Minimización</p>
                  <p>Se procura solicitar solo datos necesarios para operar cuentas, pedidos, soporte, seguridad y funciones contratadas.</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-gray-950/40 p-4">
                  <LockKeyhole className="w-5 h-5 text-orange-500 mb-3" />
                  <p className="text-white font-black text-xs uppercase tracking-[0.16em] mb-2">Acceso controlado</p>
                  <p>El acceso interno a información sensible se limita a necesidades operacionales, técnicas, administrativas o de soporte.</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-gray-950/40 p-4">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mb-3" />
                  <p className="text-white font-black text-xs uppercase tracking-[0.16em] mb-2">Incidentes</p>
                  <p>Ante eventos relevantes de seguridad, AhoraPan podrá investigar, mitigar, bloquear sesiones y comunicar medidas razonables.</p>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Responsabilidad WhatsApp/Meta */}
          <section id="whatsapp" className="scroll-mt-8 bg-gray-900/40 backdrop-blur-xl border border-white/5 p-8 md:p-10 rounded-[2.5rem]">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-white">
              <MessageCircleWarning className="w-6 h-6 text-orange-500" /> 2. Limitación de Responsabilidad (WhatsApp/Meta)
            </h2>
            <div className="text-gray-400 text-sm space-y-4 leading-relaxed">
              <p>
                AhoraPan funciona como una capa tecnológica que facilita la comunicación entre la Panadería y sus clientes mediante WhatsApp, automatizaciones, bot conversacional, panel web y servicios externos. El Cliente reconoce que WhatsApp y Meta Platforms, Inc. son plataformas independientes, sujetas a sus propias reglas, políticas comerciales, revisiones automatizadas, límites de uso, disponibilidad técnica y criterios de suspensión.
              </p>
              <p className="bg-orange-500/5 p-4 rounded-xl border border-orange-500/10 text-gray-300 italic">
                "AhoraPan no será responsable por caídas, degradaciones, bloqueos, suspensiones, restricciones, cambios de API, modificaciones de políticas, retrasos de entrega, pérdida de sesión, desconexiones, baneos preventivos o cualquier afectación atribuible a WhatsApp, Meta, proveedores de internet, dispositivos del Cliente, malas prácticas de mensajería o uso contrario a las políticas de terceros."
              </p>
              <p>
                El Cliente debe utilizar la plataforma de forma lícita, prudente y profesional. No podrá enviar spam, mensajes engañosos, publicidad no solicitada, promociones falsas, contenido ofensivo, amenazas, información sanitaria incorrecta, comunicaciones sin autorización, suplantación de identidad, captación abusiva de datos, reventa no autorizada del servicio ni cualquier conducta que pueda perjudicar a consumidores, terceros, proveedores tecnológicos o la reputación de AhoraPan.
              </p>
              <p>
                La Panadería debe mantener actualizado su catálogo, precios, stock, horarios, zona de atención, datos de contacto, mensajes y condiciones comerciales. AhoraPan podrá limitar, pausar o bloquear funcionalidades de mensajería cuando detecte uso riesgoso, volúmenes anómalos, reclamos reiterados, intentos de evasión, abuso del sistema, incumplimiento de estas condiciones o riesgo de suspensión por parte de WhatsApp/Meta.
              </p>
              <p>
                Las notificaciones por WhatsApp, escritorio, sonido, Realtime o correo son herramientas de apoyo operacional. No reemplazan la supervisión directa del negocio ni garantizan entrega perfecta de todos los mensajes. El Cliente debe revisar periódicamente sus pedidos activos, mantener procedimientos internos ante fallas técnicas y contar con alternativas razonables cuando existan cortes de energía, internet, dispositivos o servicios de terceros.
              </p>
            </div>
          </section>

          {/* 3 & 4 Grid: Cookies y Facturación */}
          <section className="bg-gray-900/40 backdrop-blur-xl border border-white/5 p-8 md:p-10 rounded-[2.5rem]">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-white">
              <BellRing className="w-6 h-6 text-orange-500" /> 2.1 Comunicaciones Permitidas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-400 leading-relaxed">
              <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-3" />
                <p className="text-white font-black text-xs uppercase tracking-[0.18em] mb-2">Buenas prácticas</p>
                <p>Enviar mensajes claros, oportunos, relacionados con pedidos reales, promociones verificables, disponibilidad de productos o comunicaciones aceptadas por el destinatario.</p>
              </div>
              <div className="rounded-2xl border border-red-500/10 bg-red-500/5 p-5">
                <Ban className="w-5 h-5 text-red-400 mb-3" />
                <p className="text-white font-black text-xs uppercase tracking-[0.18em] mb-2">Conductas prohibidas</p>
                <p>No usar listas compradas, suplantación, automatizaciones evasivas, mensajes masivos sin base legítima, información falsa o contenido que pueda afectar a terceros.</p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section id="cookies" className="scroll-mt-8 bg-gray-900/40 backdrop-blur-xl border border-white/5 p-8 rounded-[2.5rem]">
              <h2 className="text-xl font-black mb-4 flex items-center gap-3 text-white">
                <Cookie className="w-6 h-6 text-orange-500" /> 3. Política de Cookies
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                AhoraPan utiliza cookies estrictamente necesarias, almacenamiento local y tecnologías equivalentes para mantener la sesión activa, recordar preferencias del panel, conservar tokens de autenticación, validar seguridad, prevenir accesos indebidos, reducir errores de navegación y permitir que el Dashboard funcione correctamente. Estas tecnologías pueden registrar información técnica como navegador, dispositivo, fecha de acceso, estado de sesión, idioma, rutas visitadas dentro del panel y eventos operacionales necesarios para soporte. No usamos cookies de publicidad comportamental ni vendemos información de navegación a redes publicitarias. El bloqueo de cookies esenciales puede impedir el inicio de sesión, la recepción de pedidos en tiempo real o el funcionamiento normal del servicio.
              </p>
            </section>
            
            <section id="pagos" className="scroll-mt-8 bg-gray-900/40 backdrop-blur-xl border border-white/5 p-8 rounded-[2.5rem]">
              <h2 className="text-xl font-black mb-4 flex items-center gap-3 text-white">
                <CreditCard className="w-6 h-6 text-orange-500" /> 4. Pagos y Cancelaciones
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                Las funciones premium, planes de acceso, activaciones mensuales, posicionamientos destacados o servicios adicionales, incluyendo <strong>ALERTA PAN</strong>, se pagan por adelantado mediante SumUp u otro medio informado por AhoraPan. Salvo indicación expresa en contrario, los pagos no constituyen cobros automáticos recurrentes: el Cliente decide renovar, extender o contratar nuevamente el acceso. La activación puede estar sujeta a validación de pago, revisión antifraude, disponibilidad técnica y cumplimiento de estas condiciones. La cancelación o no renovación no afecta el acceso ya pagado hasta el término del período contratado, pero deshabilita beneficios premium al vencer. <span className="font-bold text-white">No se emiten reembolsos prorrateados o parciales, salvo obligación legal, error imputable a AhoraPan o acuerdo escrito entre las partes.</span>
              </p>
            </section>
          </div>

          <section className="bg-gray-900/40 backdrop-blur-xl border border-white/5 p-8 md:p-10 rounded-[2.5rem]">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-white">
              <ReceiptText className="w-6 h-6 text-orange-500" /> 4.1 Facturación, Comprobantes y Trazabilidad
            </h2>
            <div className="text-gray-400 text-sm space-y-4 leading-relaxed">
              <p>
                AhoraPan podrá emitir comprobantes internos, confirmaciones de pago, respaldos de activación o registros administrativos asociados a funciones premium. La emisión de boletas, facturas, notas de crédito, guías, documentos tributarios o comprobantes de venta al Consumidor Final corresponde al Cliente, salvo que se informe expresamente una integración tributaria distinta.
              </p>
              <p>
                El Cliente debe conservar sus respaldos contables, verificar que los datos de pago y facturación sean correctos, revisar cargos, informar discrepancias dentro de un plazo razonable y evitar el uso de medios de pago de terceros sin autorización. AhoraPan podrá retener o revisar activaciones cuando existan alertas de fraude, contracargos, pagos duplicados, pagos rechazados o información inconsistente.
              </p>
            </div>
          </section>

          {/* 5. Naturaleza del Servicio */}
          <section id="servicio" className="scroll-mt-8 bg-gray-900/40 backdrop-blur-xl border border-white/5 p-8 md:p-10 rounded-[2.5rem]">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-white">
              <DatabaseZap className="w-6 h-6 text-orange-500" /> 5. Rol de AhoraPan
            </h2>
            <div className="text-gray-400 text-sm space-y-4 leading-relaxed">
              <p>AhoraPan es una <strong>herramienta de software como servicio (SaaS)</strong> que permite digitalizar la recepción, organización y comunicación de pedidos. La plataforma no fabrica, vende, almacena, transporta, manipula, certifica ni distribuye pan, alimentos, bebidas u otros productos ofrecidos por la Panadería. Tampoco actúa como mandatario, socio, empleado, franquiciante, operador sanitario, procesador alimentario, marketplace de cobro al consumidor ni representante legal del Cliente.</p>
              <p>El Cliente conserva plena autonomía comercial y operacional sobre su negocio. Por ello, es responsable de configurar correctamente sus productos, precios, categorías, stock, unidades de venta, horarios, tiempos de retiro, mensajes, promociones, datos tributarios, cumplimiento sanitario, entrega de boletas o facturas, garantías legales, atención de reclamos y condiciones ofrecidas al Consumidor Final.</p>
              <p>La información que el bot muestra a los consumidores depende de los datos ingresados por la Panadería. Si existen errores de precio, disponibilidad, dirección, horario, alérgenos, promociones, unidades de venta o instrucciones de retiro, la responsabilidad frente al consumidor final será del Cliente. AhoraPan podrá asistir técnicamente, pero no valida de forma previa cada publicación comercial ni reemplaza la revisión diaria que debe realizar el negocio.</p>
              <div className="bg-black/20 border border-white/5 rounded-2xl p-5">
                <p className="text-white font-black text-xs uppercase tracking-[0.18em] mb-2">Cumplimiento comercial y sanitario</p>
                <p>La Panadería debe cumplir la Ley N° 19.496 sobre protección de los derechos de los consumidores, el Reglamento de Comercio Electrónico cuando resulte aplicable, las normas sanitarias, obligaciones tributarias, permisos municipales, exigencias de manipulación de alimentos, reglas de publicidad, entrega de comprobantes y cualquier regulación relacionada con su giro.</p>
              </div>
            </div>
          </section>

          <section className="bg-gray-900/40 backdrop-blur-xl border border-white/5 p-8 md:p-10 rounded-[2.5rem]">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-white">
              <ClipboardCheck className="w-6 h-6 text-orange-500" /> 5.1 Obligaciones Operativas del Comercio
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-400 leading-relaxed">
              <div className="rounded-2xl border border-white/5 bg-gray-950/40 p-4">
                <ClipboardCheck className="w-5 h-5 text-orange-500 mb-3" />
                <p className="text-white font-black text-xs uppercase tracking-[0.16em] mb-2">Catalogo fiel</p>
                <p>Productos, fotos, alérgenos, tamaños, disponibilidad y precios deben representar la oferta real del comercio.</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-gray-950/40 p-4">
                <Users className="w-5 h-5 text-orange-500 mb-3" />
                <p className="text-white font-black text-xs uppercase tracking-[0.16em] mb-2">Atención final</p>
                <p>La gestión de reclamos, cambios, devoluciones y trato directo con consumidores finales permanece bajo responsabilidad de la Panadería.</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-gray-950/40 p-4">
                <Settings className="w-5 h-5 text-orange-500 mb-3" />
                <p className="text-white font-black text-xs uppercase tracking-[0.16em] mb-2">Configuración</p>
                <p>Horarios, tiempos de retiro, mensajes automáticos, zonas, estados y disponibilidad deben mantenerse revisados y actualizados.</p>
              </div>
            </div>
          </section>

          {/* 6 & 7 Grid: Cuenta y propiedad */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section id="cuenta" className="scroll-mt-8 bg-gray-900/40 backdrop-blur-xl border border-white/5 p-8 rounded-[2.5rem]">
              <h2 className="text-xl font-black mb-4 flex items-center gap-3 text-white">
                <LockKeyhole className="w-6 h-6 text-orange-500" /> 6. Cuenta y Acceso
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                El Cliente es responsable de la veracidad de los datos de registro, del uso de sus credenciales, de los accesos otorgados a administradores o colaboradores y de toda actividad realizada desde su cuenta. Debe mantener contraseñas seguras, proteger dispositivos, cerrar sesiones en equipos compartidos y avisar oportunamente a soporte si sospecha accesos no autorizados. AhoraPan podrá bloquear sesiones, exigir restablecimiento de contraseña o restringir funciones cuando existan indicios de compromiso, fraude, uso indebido, conflicto de titularidad o riesgo para otros usuarios.
              </p>
            </section>
            
            <section id="propiedad" className="scroll-mt-8 bg-gray-900/40 backdrop-blur-xl border border-white/5 p-8 rounded-[2.5rem]">
              <h2 className="text-xl font-black mb-4 flex items-center gap-3 text-white">
                <FileText className="w-6 h-6 text-orange-500" /> 7. Propiedad Intelectual
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                El software, diseño funcional, interfaz, marca, textos base, flujos, automatizaciones, código, estructura del bot, lógica operacional, documentación y elementos distintivos de AhoraPan pertenecen a sus titulares o licenciantes. El Cliente recibe una autorización limitada, revocable, no exclusiva y no transferible para usar la plataforma mientras mantenga una cuenta habilitada. Los productos, nombres comerciales, precios, fotografías, descripciones y contenidos cargados por la Panadería siguen siendo de su responsabilidad y titularidad, sin perjuicio de la licencia necesaria para mostrarlos en el bot, panel y comunicaciones del servicio.
              </p>
            </section>
          </div>

          {/* 8. Operación y soporte */}
          <section id="soporte" className="scroll-mt-8 bg-gray-900/40 backdrop-blur-xl border border-white/5 p-8 md:p-10 rounded-[2.5rem]">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-white">
              <Store className="w-6 h-6 text-orange-500" /> 8. Operación, Disponibilidad y Soporte
            </h2>
            <div className="text-gray-400 text-sm space-y-4 leading-relaxed">
              <p>
                AhoraPan procura mantener una operación estable, segura y disponible, pero el Cliente acepta que pueden existir ventanas de mantenimiento, actualizaciones, incidentes de infraestructura, errores de proveedores, interrupciones de conectividad, limitaciones de WhatsApp o degradaciones temporales del servicio. Cuando sea razonablemente posible, se realizarán correcciones y ajustes técnicos sin afectar innecesariamente la continuidad del negocio.
              </p>
              <p>
                El soporte se orienta a resolver problemas de acceso, configuración, pedidos, activación de funciones, comportamiento del bot, pagos premium y dudas operacionales. No incluye asesoría contable, tributaria, sanitaria, laboral, comercial, publicitaria o legal específica para la Panadería. Las recomendaciones entregadas por soporte tienen carácter operativo y no sustituyen la revisión de profesionales competentes cuando la materia lo requiera.
              </p>
              <p>
                AhoraPan podrá actualizar funcionalidades, cambiar proveedores, ajustar límites técnicos, mejorar reglas de seguridad, modificar flujos del bot, corregir errores o incorporar nuevas herramientas. Dichas mejoras no implican obligación de mantener indefinidamente una función experimental, beta, gratuita, promocional o dependiente de terceros si su continuidad se vuelve insegura, inviable o incompatible con la operación general del servicio.
              </p>
            </div>
          </section>

          {/* 9. Sistema de Strikes */}
          <section className="bg-gray-900/40 backdrop-blur-xl border border-white/5 p-8 md:p-10 rounded-[2.5rem]">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-white">
              <LifeBuoy className="w-6 h-6 text-orange-500" /> 8.1 Mesa de Ayuda y Reportes
            </h2>
            <div className="text-gray-400 text-sm space-y-4 leading-relaxed">
              <p>
                Para acelerar la respuesta, el Cliente debe entregar antecedentes suficientes al solicitar soporte: correo de cuenta, nombre de la panadería, hora aproximada del incidente, capturas cuando existan, número de pedido involucrado, dispositivo utilizado y descripción concreta del problema. Los reportes incompletos pueden requerir validaciones adicionales antes de una solución.
              </p>
              <p>
                Las solicitudes se priorizan según impacto operacional, seguridad, disponibilidad del bot, pagos premium, pedidos activos y riesgo para usuarios. AhoraPan podrá cerrar tickets duplicados, consolidar conversaciones o pedir confirmación antes de modificar configuraciones sensibles.
              </p>
            </div>
          </section>

          {/* 9. Sistema de Strikes */}
          <section id="fraude" className="scroll-mt-8 bg-orange-600/5 backdrop-blur-xl border border-orange-500/10 p-8 md:p-10 rounded-[2.5rem]">
            <h2 className="text-2xl font-black mb-4 flex items-center gap-3 text-white">
              <AlertCircle className="w-6 h-6 text-orange-500" /> 9. Sistema Anti-Fraude (Strikes)
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Para proteger a las panaderías de pedidos falsos, abandono reiterado, abuso operativo o uso irresponsable del bot, AhoraPan puede implementar un sistema automatizado de <strong>Strikes</strong>. Cuando un Consumidor Final no retira pedidos confirmados, genera pedidos sin intención real de compra o acumula incumplimientos asociados a una panadería, el sistema podrá limitar temporal o permanentemente su interacción con el bot de ese establecimiento. Esta medida busca reducir mermas, tiempos perdidos y costos operacionales, pero no reemplaza el criterio comercial de la Panadería ni constituye una calificación pública del consumidor. El Cliente debe revisar cada caso con prudencia, evitar decisiones discriminatorias o arbitrarias y solicitar soporte cuando estime que un bloqueo fue aplicado por error. AhoraPan podrá ajustar umbrales, plazos, reglas y criterios del sistema antifraude para mejorar la seguridad, prevenir evasiones y proteger la estabilidad general de la plataforma.
            </p>
          </section>

          {/* 10. Suspensión y terminación */}
          <section id="termino" className="scroll-mt-8 bg-gray-900/40 backdrop-blur-xl border border-white/5 p-8 md:p-10 rounded-[2.5rem]">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-white">
              <UserCheck className="w-6 h-6 text-orange-500" /> 10. Suspensión, Término y Uso Aceptable
            </h2>
            <div className="text-gray-400 text-sm space-y-4 leading-relaxed">
              <p>
                AhoraPan podrá suspender, limitar o terminar el acceso de una cuenta cuando existan incumplimientos graves o reiterados de estas condiciones, uso fraudulento, intentos de vulnerar la seguridad, manipulación de datos, ataques a la infraestructura, infracción de derechos de terceros, envío abusivo de mensajes, carga de información falsa, falta de pago de servicios contratados, afectación a consumidores o riesgo legal, reputacional o técnico para la plataforma.
              </p>
              <p>
                El Cliente puede dejar de usar el servicio cuando lo estime conveniente, sin perjuicio de obligaciones pendientes, pagos ya devengados, responsabilidades frente a consumidores, solicitudes de datos, reclamos en curso o deberes de conservación que correspondan. La terminación de la cuenta no elimina automáticamente registros que deban mantenerse por seguridad, cumplimiento legal, soporte, auditoría, prevención de fraude o defensa de derechos.
              </p>
              <p>
                Cuando la suspensión sea subsanable, AhoraPan podrá solicitar antecedentes, correcciones o compromisos de uso responsable antes de restablecer funciones. En casos de riesgo alto, abuso evidente o exigencia de terceros proveedores, la restricción podrá aplicarse de forma inmediata para proteger al resto de usuarios y la continuidad del servicio.
              </p>
            </div>
          </section>

          {/* 11. Modificaciones */}
          <section id="cambios" className="scroll-mt-8 bg-gray-900/40 backdrop-blur-xl border border-white/5 p-8 md:p-10 rounded-[2.5rem]">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-white">
              <RefreshCw className="w-6 h-6 text-orange-500" /> 11. Cambios en los Términos
            </h2>
            <div className="text-gray-400 text-sm space-y-4 leading-relaxed">
              <p>
                AhoraPan podrá actualizar estos términos para reflejar cambios legales, ajustes operacionales, nuevas funcionalidades, modificaciones de proveedores, mejoras de seguridad, planes comerciales o evolución de la plataforma. La versión vigente será la publicada en esta página, con indicación de su fecha de actualización.
              </p>
              <p>
                Cuando los cambios sean sustanciales, AhoraPan procurará informarlos mediante el panel, correo, aviso dentro de la plataforma u otro medio razonable. El uso continuado del servicio después de publicada una actualización constituirá aceptación de la nueva versión. Si el Cliente no está de acuerdo con una modificación, deberá abstenerse de seguir usando la plataforma y podrá contactar a soporte para resolver dudas sobre su cuenta o sus datos.
              </p>
            </div>
          </section>

          {/* 12. Jurisdicción */}
          <section id="ley" className="scroll-mt-8 bg-black/40 backdrop-blur-xl border border-white/5 p-8 md:p-10 rounded-[2.5rem] border-t-8 border-t-gray-800">
            <h2 className="text-2xl font-black mb-4 flex items-center gap-3 text-white">
              <Gavel className="w-6 h-6 text-gray-400" /> 12. Jurisdicción y Ley Aplicable
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Estas condiciones se interpretarán conforme a las leyes de la <strong>República de Chile</strong>, incluyendo la normativa civil, comercial, tributaria, de protección de datos, protección al consumidor y comercio electrónico que resulte aplicable. Cualquier controversia derivada del uso de AhoraPan, la contratación de funciones premium, la administración de cuentas, el tratamiento de datos o la prestación del servicio será intentada resolver previamente mediante comunicación directa y de buena fe con soporte. Si no fuere posible una solución amistosa, las partes se someten a la jurisdicción y competencia de los Tribunales Ordinarios de Justicia de la ciudad de <strong>Valparaíso, Chile</strong>, sin perjuicio de los derechos irrenunciables que la legislación chilena reconozca a consumidores, usuarios o titulares de datos personales ante autoridades administrativas o tribunales competentes.
            </p>
          </section>

          <div className="text-center pt-8 border-t border-white/5">
            <p className="text-gray-500 text-sm mb-8">
              Para consultas legales, soporte contractual, solicitudes ARCO (Acceso, Rectificación, Cancelación y Oposición), eliminación de datos, reportes de seguridad, reclamos asociados al tratamiento de información o dudas sobre estas condiciones, contáctenos en: <br/>
              <a href="https://mail.google.com/mail/?view=cm&fs=1&to=ahorapansupport@gmail.com" target="_blank" rel="noopener noreferrer" className="text-orange-500 font-bold hover:text-orange-400 transition-colors inline-flex items-center gap-1 mt-2">
                ahorapansupport@gmail.com
              </a>
            </p>
            <button 
              onClick={handleClose}
              className="inline-flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-black py-4 px-12 rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-[0.2em] w-full md:w-auto text-sm cursor-pointer"
            >
              <ShieldCheck className="w-5 h-5" /> COMPRENDIDO Y ACEPTADO
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
