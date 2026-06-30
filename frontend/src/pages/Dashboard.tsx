import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useOrders, type Order } from '../hooks/useOrders';
import { useAuth } from '../context/AuthContext';
import { useStoreStatus, type StoreTone } from '../hooks/useStoreStatus';
import { fetchJson } from '../lib/api';
import { Link, useNavigate } from 'react-router-dom';
import { User, UserPlus, RefreshCw, AlertTriangle, Flame, CheckCircle2, Inbox, Bell, BellOff, Megaphone, AlertCircle, Check, ChevronRight, Clock, X, Lock, CreditCard, Loader2, Sparkles, UploadCloud, Users, Settings, Plus, Minus } from 'lucide-react';
import NewOrderOverlay from '../components/NewOrderOverlay';
import { usePageHeader } from '../components/AppLayout';
import * as xlsx from 'xlsx';
import * as mammoth from 'mammoth';

const toneChip: Record<StoreTone, string> = {
  open: 'text-emerald-500 border-emerald-500/30',
  closing: 'text-amber-500 border-amber-500/30',
  closed: 'text-red-500 border-red-500/30',
  loading: 'text-theme-muted border-theme',
};
const toneDot: Record<StoreTone, string> = {
  open: 'bg-emerald-500',
  closing: 'bg-amber-500',
  closed: 'bg-red-500',
  loading: 'bg-gray-400',
};

export default function Dashboard() {
  const { bakeryId, loading: authLoading, user, session, isAdmin, orderExpiryMinutes, isActive, isAlertUnlocked, alertAccessUntil } = useAuth();
  const navigate = useNavigate();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const { orders, updateOrderStatus, isFlashing, showNewOrderOverlay, dismissNewOrderAlert, loading: ordersLoading } = useOrders(bakeryId || 0, soundEnabled);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [now, setNow] = useState(new Date());
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null);
  const [confirmCancelExpiry, setConfirmCancelExpiry] = useState<Order | null>(null);
  const [confirmReadyOrder, setConfirmReadyOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<Order | null>(null);
  const [invitePhone, setInvitePhone] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bulkPhones, setBulkPhones] = useState<string[]>([]);
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);
  const [isBulkInviting, setIsBulkInviting] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const status = useStoreStatus();
  const canUseAlert = isAlertUnlocked; // Visualmente sigue la suscripción real

  // Lógica de Aviso de Expiración (7 días antes)
  const getExpirationWarning = () => {
    if (isAdmin || !isAlertUnlocked || !alertAccessUntil) return null;
    const expiryDate = new Date(alertAccessUntil);
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays >= 0 && diffDays <= 7) {
      return {
        days: diffDays,
        date: expiryDate.toLocaleDateString('es-CL')
      };
    }
    return null;
  };

  const expirationWarning = getExpirationWarning();

  useEffect(() => {
    document.title = 'AhoraPan - Dashboard';
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, [bakeryId]);

  const handleBroadcast = async () => {
    if (!canUseAlert) {
      if (isAdmin) {
        if (!confirm("Modo administrador: ¿enviar la alerta ahora?\n\nAceptar = enviar la alerta de prueba\nCancelar = ir a la página de suscripción")) {
          navigate('/desbloquear-alerta');
          return;
        }
      } else {
        navigate('/desbloquear-alerta');
        return;
      }
    }
    if (!confirm("¿Enviar un WhatsApp a TODOS tus clientes avisando que acabas de sacar pan?")) return;
    setIsBroadcasting(true);
    try {
      const data = await fetchJson<{ status: string; sentTo: number; message?: string }>('/api/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ bakery_id: bakeryId })
      });
      if (data.status === 'success') {
        if (data.sentTo === 0) {
          toast('No se encontraron clientes para notificar.');
        } else {
          toast.success(`Alerta enviada a ${data.sentTo} ${data.sentTo === 1 ? 'cliente' : 'clientes'}.`);
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error inesperado';
      toast.error(`No se pudo completar la alerta. ${message}`);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitePhone || invitePhone.length < 8) {
      toast.error('Ingresa un número de WhatsApp válido.');
      return;
    }
    setIsInviting(true);
    try {
      const data = await fetchJson<{ status: string; message: string }>('/api/invite-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ bakery_id: bakeryId, phone: invitePhone })
      });
      if (data.status === 'success') {
        toast.success('Invitación enviada con éxito.');
        setInvitePhone('');
      }
    } catch (e: any) {
      toast.error(e.message || 'No se pudo enviar la invitación.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let extractedText = '';
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'xlsx' || ext === 'xls') {
        const data = await file.arrayBuffer();
        const workbook = xlsx.read(data);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = xlsx.utils.sheet_to_json<string[]>(worksheet, { header: 1 });
        extractedText = json.map(row => row.join(' ')).join('\n');
      } else if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      } else if (ext === 'csv' || ext === 'txt') {
        extractedText = await file.text();
      } else {
        toast.error('Formato de archivo no soportado.');
        return;
      }

      const potentialNumbers = extractedText.replace(/\D+/g, ' ').split(' ');
      const validPhones: string[] = [];
      
      for (const num of potentialNumbers) {
        if (num.length >= 8 && num.length <= 11) {
          validPhones.push(num);
        }
      }
      
      const uniquePhones = Array.from(new Set(validPhones));

      if (uniquePhones.length === 0) {
        toast.error('No se encontraron números válidos en el archivo.');
        return;
      }

      if (uniquePhones.length > 50) {
        toast.error(`Se detectaron ${uniquePhones.length} números. Por seguridad anti-spam el máximo es 50 por carga; divídelo en partes más pequeñas.`);
        return;
      }

      setBulkPhones(uniquePhones);
      setShowBulkConfirmModal(true);
      setShowInviteModal(false);

    } catch (err) {
      console.error('Error procesando archivo:', err);
      toast.error('No se pudo procesar el archivo. Revisa que el formato sea correcto.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleBulkConfirm = async () => {
    setIsBulkInviting(true);
    try {
      await fetchJson<{ status: string; message: string }>('/api/invite-customers-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ bakery_id: bakeryId, phones: bulkPhones })
      });
      toast.success('Envío masivo iniciado. Los mensajes saldrán en segundo plano.');
      setShowBulkConfirmModal(false);
      setBulkPhones([]);
    } catch (e: any) {
      toast.error(e.message || 'No se pudo iniciar el envío masivo.');
    } finally {
      setIsBulkInviting(false);
    }
  };

  // El título + estado + acciones del panel viven en la ÚNICA barra superior global.
  usePageHeader(
    {
      title: (
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="shrink-0 truncate text-lg font-black tracking-tight text-theme-base md:text-xl">Pedidos de hoy</h1>
          <span
            className={`hidden shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] sm:inline-flex ${toneChip[status.tone]}`}
            style={{ backgroundColor: 'var(--theme-inset)' }}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${toneDot[status.tone]} ${status.isOpen ? 'animate-pulse' : ''}`} />
            {status.label}
          </span>
        </div>
      ),
      actions: (
        <>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex h-9 items-center gap-2 rounded-xl border border-theme px-2.5 text-xs font-bold transition-all hover:border-orange-500/40"
            style={{ backgroundColor: 'var(--theme-inset)' }}
            title={soundEnabled ? 'Sonido de avisos activado' : 'Sonido de avisos silenciado'}
          >
            {soundEnabled ? <Bell className="h-4 w-4 text-orange-500" /> : <BellOff className="h-4 w-4 text-theme-muted" />}
            <span className="hidden text-theme-base lg:inline">{soundEnabled ? 'Avisos' : 'Silencio'}</span>
          </button>

          <button
            onClick={() => setShowInviteModal(true)}
            className="flex h-9 items-center gap-2 rounded-xl border border-theme px-2.5 text-xs font-bold text-theme-base transition-all hover:border-orange-500/40"
            style={{ backgroundColor: 'var(--theme-inset)' }}
          >
            <UserPlus className="h-4 w-4 text-orange-500" />
            <span className="hidden lg:inline">Invitar</span>
          </button>

          <button
            onClick={handleBroadcast}
            disabled={isBroadcasting}
            data-tour="broadcast-btn"
            className={`flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-black uppercase tracking-wide transition-all active:scale-95 ${
              isBroadcasting
                ? 'cursor-wait bg-gray-500/20 text-theme-muted'
                : !canUseAlert
                  ? 'border border-theme text-theme-base hover:border-orange-500/40'
                  : 'bg-emerald-600 text-white shadow-[0_6px_18px_rgba(16,185,129,0.3)] hover:bg-emerald-500'
            }`}
            style={!canUseAlert && !isBroadcasting ? { backgroundColor: 'var(--theme-inset)' } : undefined}
          >
            {isBroadcasting ? <Loader2 className="h-4 w-4 animate-spin" /> : !canUseAlert ? <Lock className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
            <span className="hidden sm:inline">{!canUseAlert ? 'Desbloquear' : 'Enviar alerta'}</span>
          </button>
        </>
      ),
    },
    [soundEnabled, isBroadcasting, canUseAlert, status.tone, status.label, status.isOpen],
  );

  if (authLoading || (!bakeryId && user)) return <DashboardSkeleton />;

  // Agrupar órdenes por estado
  const pending = orders.filter(o => o.status === 'PENDING');
  const ready = orders.filter(o => o.status === 'READY');

  return (
    <div className={`relative flex min-h-screen flex-col transition-all duration-300 lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden ${isFlashing ? 'ring-[10px] ring-emerald-500/70 ring-inset' : ''}`}>

      {/* Fondos decorativos */}
      <div className="pointer-events-none absolute right-0 top-0 -z-10 h-[500px] w-[500px] rounded-full bg-orange-500/5 blur-[90px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 -z-10 h-[400px] w-[400px] rounded-full bg-emerald-500/5 blur-[80px]" />

      <div className="iphone-liquid-scroll-safe flex-1 space-y-4 p-3 md:p-4 lg:flex lg:flex-col lg:gap-4 lg:space-y-0 lg:overflow-hidden lg:p-6">

          {/* Banners */}
          <div className="max-w-[1600px] mx-auto w-full space-y-4">
            {!isActive && (
              <div className="bg-red-600/10 border-2 border-red-600/20 p-5 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-xl relative overflow-hidden group animate-in slide-in-from-top duration-500">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50" />
                <div className="flex items-center gap-6">
                  <div className="bg-red-600 p-3 rounded-2xl shadow-2xl shadow-red-900/50 animate-pulse">
                    <AlertTriangle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-red-500 font-black text-lg uppercase tracking-tighter leading-none mb-1">Tu tienda no está visible</h3>
                    <p className="text-gray-400 text-sm font-medium">Contacta a soporte para activarla.</p>
                  </div>
                </div>
                <a href="https://mail.google.com/mail/?view=cm&fs=1&to=ahorapansupport@gmail.com" target="_blank" rel="noopener noreferrer" className="bg-red-600 hover:bg-red-500 text-white text-xs font-black px-8 py-4 rounded-2xl transition-all flex items-center gap-3 shadow-[0_10px_30px_rgba(220,38,38,0.3)] hover:scale-105 active:scale-95">
                  <Inbox className="w-5 h-5" /> HABLAR CON SOPORTE
                </a>
              </div>
            )}

            {expirationWarning && (
              <div className="bg-amber-500/10 border-2 border-amber-500/20 p-4 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-xl relative overflow-hidden animate-in slide-in-from-top duration-500">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50" />
                <div className="flex items-center gap-4">
                  <div className="bg-amber-500 p-2.5 rounded-xl shadow-xl shadow-amber-900/40">
                    <Clock className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <h3 className="text-amber-500 font-black text-sm uppercase tracking-tighter leading-none mb-1">Suscripción por vencer</h3>
                    <p className="text-gray-400 text-xs font-medium">Quedan {expirationWarning.days} días (Vence el {expirationWarning.date}).</p>
                  </div>
                </div>
                <Link to="/desbloquear-alerta" className="bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black px-6 py-3 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-amber-950/40">
                  <CreditCard className="w-4 h-4" /> RENOVAR AHORA
                </Link>
              </div>
            )}
          </div>

          {/* Orders Columns - Yellow and Green areas in Paint */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 max-w-[1700px] mx-auto w-full min-h-[60vh] lg:min-h-0 lg:flex-1 items-stretch">
            
            {/* Column: Preparando (Yellow) */}
            <div className="bg-[#0b0f1a] dark:bg-[#0b0f1a] rounded-[2.5rem] border border-white/5 flex flex-col shadow-2xl relative overflow-hidden h-full">
              <div className="absolute top-0 left-0 w-full h-2 bg-amber-500/50 z-10" />
              <div className="p-5 md:p-6 flex items-center justify-between shrink-0 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                    <Flame className="w-6 h-6 text-amber-500" />
                  </div>
                  <h2 className="text-2xl font-black uppercase text-amber-500 tracking-tighter" data-tour="orders-header">Preparando</h2>
                </div>
                <div className="bg-gray-950/50 border border-amber-500/30 text-amber-500 w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner">
                  {pending.length}
                </div>
              </div>
              
              <div className="custom-scrollbar iphone-liquid-scroll-safe flex-1 overflow-y-auto overflow-x-hidden px-6 md:px-8 pb-8 space-y-6 bg-[#0b0f1a]">
                {ordersLoading ? (
                  <div className="flex flex-col items-center justify-center h-40 opacity-40">
                    <RefreshCw className="w-10 h-10 animate-spin text-amber-500 mb-4" />
                    <p className="text-xs font-bold uppercase tracking-widest">Cargando órdenes...</p>
                  </div>
                ) : pending.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center opacity-20 py-20">
                    <Inbox className="w-16 h-16 mb-4" />
                    <p className="text-sm font-bold uppercase tracking-[0.2em]">Sin pedidos pendientes</p>
                  </div>
                ) : (
                  pending.map(order => (
                    <OrderCard key={order.id} order={order} now={now} actionColor="bg-amber-600 hover:bg-amber-500" onClick={() => setConfirmReadyOrder(order)} setEditingOrder={setEditingOrder} orderExpiryMinutes={orderExpiryMinutes} />
                  ))
                )}
              </div>
            </div>

            {/* Column: Listos (Green) */}
            <div className="bg-[#0b0f1a] dark:bg-[#0b0f1a] rounded-[2.5rem] border border-white/5 flex flex-col shadow-2xl relative overflow-hidden h-full">
              <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500/50 z-10" />
              <div className="p-5 md:p-6 flex items-center justify-between shrink-0 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h2 className="text-2xl font-black uppercase text-emerald-500 tracking-tighter">Listos</h2>
                </div>
                <div className="bg-gray-950/50 border border-emerald-500/30 text-emerald-500 w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner">
                  {ready.length}
                </div>
              </div>
              
              <div className="custom-scrollbar iphone-liquid-scroll-safe flex-1 overflow-y-auto overflow-x-hidden px-6 md:px-8 pb-8 space-y-6 bg-[#0b0f1a]">
                {ordersLoading ? (
                   <div className="flex flex-col items-center justify-center h-40 opacity-40">
                    <RefreshCw className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
                    <p className="text-xs font-bold uppercase tracking-widest">Cargando órdenes...</p>
                  </div>
                ) : ready.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center opacity-20 py-20">
                    <CheckCircle2 className="w-16 h-16 mb-4" />
                    <p className="text-sm font-bold uppercase tracking-[0.2em]">Nada por entregar</p>
                  </div>
                ) : (
                  ready.map(order => {
                    const isExpired = (new Date(order.ready_at || order.created_at).getTime() + (orderExpiryMinutes * 60000)) <= now.getTime();
                    return <OrderCard key={order.id} order={order} now={now} isExpired={isExpired} actionColor={isExpired ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"} onClick={() => isExpired ? setConfirmCancelExpiry(order) : setConfirmOrder(order)} setEditingOrder={setEditingOrder} orderExpiryMinutes={orderExpiryMinutes} />
                  })
                )}
              </div>
            </div>

          </div>
        </div>

      {confirmOrder && (
        <Modal icon={<CheckCircle2 className="w-10 h-10 text-emerald-500" />} title="¿Confirmar entrega?" color="border-emerald-500"
          onClose={() => setConfirmOrder(null)} onConfirm={() => { updateOrderStatus(confirmOrder.id, 'DELIVERED'); setConfirmOrder(null); }}>
          Estás por marcar el pedido <span className="text-white font-bold">{confirmOrder.short_code}</span> como entregado.
        </Modal>
      )}

      {confirmCancelExpiry && (
        <Modal icon={<AlertCircle className="w-10 h-10 text-red-500" />} title="¿Cancelar pedido expirado?" color="border-red-500"
          onClose={() => setConfirmCancelExpiry(null)} onConfirm={() => { updateOrderStatus(confirmCancelExpiry.id, 'REJECTED', { cancellation_reason: 'Pedido cancelado por expiración' }); setConfirmCancelExpiry(null); }}>
          El pedido <span className="text-white font-bold">{confirmCancelExpiry.short_code}</span> ha superado el tiempo de retiro.
        </Modal>
      )}

      {confirmReadyOrder && (
        <Modal icon={<Flame className="w-10 h-10 text-amber-500" />} title="¿Marcar como listo?" color="border-amber-500"
          onClose={() => setConfirmReadyOrder(null)} onConfirm={() => { updateOrderStatus(confirmReadyOrder.id, 'READY'); setConfirmReadyOrder(null); }}>
          ¿Marcar el pedido <span className="text-white font-bold">{confirmReadyOrder.short_code}</span> como listo?
        </Modal>
      )}

      {editingOrder && (
        <EditOrderModal order={editingOrder} onClose={() => setEditingOrder(null)}
          onSave={(items: string, total: number, removed: string) => { updateOrderStatus(editingOrder.id, 'PENDING', { items_description: items, total_amount: total, needs_modification_notify: true, removed_items: removed }); setEditingOrder(null); }}
          onCancelRequest={() => { setShowCancelModal(editingOrder); setEditingOrder(null); }} />
      )}

      {showCancelModal && (
        <CancelReasonModal order={showCancelModal} 
          onClose={() => { setEditingOrder(showCancelModal); setShowCancelModal(null); }}
          onConfirm={(reason: string) => { updateOrderStatus(showCancelModal.id, 'REJECTED', { cancellation_reason: reason }); setShowCancelModal(null); }} />
      )}

      {showBulkConfirmModal && (
        <Modal icon={<Users className="w-10 h-10 text-emerald-500" />} title="Confirmar Envío Masivo" color="border-emerald-500"
          onClose={() => { setShowBulkConfirmModal(false); setBulkPhones([]); }} onConfirm={handleBulkConfirm}>
          <div className="space-y-4">
            <p>Se han detectado <span className="text-emerald-500 font-black text-2xl">{bulkPhones.length}</span> números telefónicos válidos en tu archivo.</p>
            <p className="text-xs text-gray-400 bg-gray-900 p-3 rounded-xl border border-white/5">
              Para proteger tu WhatsApp contra bloqueos por spam, los mensajes se enviarán automáticamente en segundo plano con un pequeño retraso entre cada uno. 
              Puedes cerrar esta ventana y seguir usando el panel mientras se envían.
            </p>
            {isBulkInviting && <p className="text-emerald-500 font-bold animate-pulse text-sm">Iniciando envío...</p>}
          </div>
        </Modal>
      )}

      {showInviteModal && (
        <InviteCustomerModal 
          onClose={() => setShowInviteModal(false)}
          invitePhone={invitePhone}
          setInvitePhone={setInvitePhone}
          handleInvite={handleInvite}
          isInviting={isInviting}
          fileInputRef={fileInputRef}
          handleFileUpload={handleFileUpload}
        />
      )}

      <NewOrderOverlay show={showNewOrderOverlay} onClose={dismissNewOrderAlert} />
    </div>
  );
}

function InviteCustomerModal({ onClose, invitePhone, setInvitePhone, handleInvite, isInviting, fileInputRef, handleFileUpload }: any) {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300 sm:items-center sm:p-4">
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] border border-theme bg-theme-panel shadow-2xl animate-in slide-in-from-bottom-4 duration-300 sm:rounded-[2rem] sm:slide-in-from-bottom-0 sm:zoom-in-95">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-theme px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-500">
              <Users className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-black leading-tight text-theme-base">Invitar clientes</h3>
              <p className="text-[11px] font-bold uppercase tracking-widest text-theme-muted">Suma clientes a tu tienda</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-theme text-theme-muted transition-colors hover:text-theme-base" style={{ backgroundColor: 'var(--theme-inset)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 px-5 pt-4 sm:px-6">
          <div className="flex items-center gap-1.5 rounded-2xl border border-theme p-1" style={{ backgroundColor: 'var(--theme-inset)' }}>
            <button
              onClick={() => setActiveTab('single')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'single' ? 'bg-orange-600 text-white shadow-lg shadow-orange-950/30' : 'text-theme-muted hover:text-theme-base'}`}
            >
              <UserPlus className="h-4 w-4" /> Individual
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'bulk' ? 'bg-orange-600 text-white shadow-lg shadow-orange-950/30' : 'text-theme-muted hover:text-theme-base'}`}
            >
              <UploadCloud className="h-4 w-4" /> Carga masiva
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {activeTab === 'single' ? (
            <div className="space-y-5 animate-in fade-in slide-in-from-left-2 duration-300">
              <div className="rounded-3xl border border-theme bg-theme-card p-5">
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-orange-500">Número de WhatsApp</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-theme-muted" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Ej: 912345678"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    className="w-full rounded-2xl py-3.5 pl-12 pr-4 font-bold text-theme-base outline-none transition-all focus:border-orange-500/60"
                  />
                </div>
                <p className="mt-2.5 text-[11px] leading-relaxed text-theme-muted">Se enviará una invitación con el enlace de tu tienda por WhatsApp.</p>
              </div>
              <button
                onClick={handleInvite}
                disabled={isInviting || !invitePhone}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-orange-600 py-4 text-sm font-black uppercase tracking-widest text-white shadow-[0_10px_30px_rgba(234,88,12,0.25)] transition-all hover:bg-orange-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {isInviting ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                {isInviting ? 'Enviando…' : 'Enviar invitación'}
              </button>
            </div>
          ) : (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group flex w-full flex-col items-center rounded-3xl border-2 border-dashed border-theme bg-theme-card p-6 text-center transition-all hover:border-orange-500/50"
              >
                <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-500 transition-transform group-hover:scale-105">
                  <UploadCloud className="h-7 w-7" />
                </span>
                <span className="text-base font-black text-theme-base">Subir archivo de clientes</span>
                <span className="mt-1.5 max-w-[260px] text-xs text-theme-muted">Excel (.xlsx), Word (.docx), CSV o TXT. Máximo 50 números.</span>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.csv,.xlsx,.xls,.docx" className="hidden" />
              </button>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-theme bg-theme-card px-4 py-3 text-center">
                  <p className="text-lg font-black text-orange-500">50</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-theme-muted">Números máx.</p>
                </div>
                <div className="rounded-2xl border border-theme bg-theme-card px-4 py-3 text-center">
                  <p className="text-lg font-black text-orange-500">Anti-spam</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-theme-muted">Envío seguro</p>
                </div>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-orange-600 py-4 text-sm font-black uppercase tracking-widest text-white shadow-[0_10px_30px_rgba(234,88,12,0.25)] transition-all hover:bg-orange-500 active:scale-[0.98]"
              >
                <UploadCloud className="h-5 w-5" /> Seleccionar archivo
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <button
          onClick={onClose}
          className="shrink-0 border-t border-theme py-3.5 text-[11px] font-bold uppercase tracking-widest text-theme-muted transition-colors hover:text-theme-base"
          style={{ paddingBottom: 'max(0.875rem, env(safe-area-inset-bottom))' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Modal({ icon, title, children, onClose, onConfirm, color }: any) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className={`bg-gray-900 border border-white/5 p-6 md:p-10 rounded-3xl max-w-md w-full shadow-2xl text-center border-t-8 ${color}`}>
        <div className="w-20 h-20 bg-gray-950/50 rounded-full flex items-center justify-center mx-auto mb-6">{icon}</div>
        <h3 className="text-2xl font-black mb-4">{title}</h3>
        <p className="text-gray-400 mb-8">{children}</p>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={onClose} className="py-4 rounded-2xl bg-gray-950 font-bold border border-white/5">VOLVER</button>
          <button onClick={onConfirm} className="py-4 rounded-2xl bg-white text-black font-black">CONFIRMAR</button>
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order, actionColor, onClick, now, setEditingOrder, orderExpiryMinutes, isExpired }: any) {
  const [isExpanded, setIsExpanded] = useState(false);
  const diffMins = Math.floor((now.getTime() - new Date(order.created_at).getTime()) / 60000);
  
  const isReady = order.status === 'READY';
  const cardBorder = isExpired ? 'border-red-500/30' : isReady ? 'border-emerald-500/30' : 'border-amber-500/30';
  const cardGlow = isExpired ? 'shadow-red-900/10' : isReady ? 'shadow-emerald-900/10' : 'shadow-amber-900/10';
  const badgeBg = isExpired ? 'bg-red-500/10 text-red-400' : isReady ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400';
  
  return (
    <div className={`relative overflow-hidden bg-gray-900/40 backdrop-blur-xl rounded-[2rem] shadow-[0_10px_40px_rgba(0,0,0,0.3)] flex flex-col border transition-all duration-200 ease-out ${isExpanded ? cardBorder : 'border-white/5 hover:border-white/10 hover:bg-gray-900/60'} ${cardGlow}`}>
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-transparent via-current to-transparent opacity-50" style={{ color: isExpired ? '#ef4444' : isReady ? '#10b981' : '#f59e0b' }}></div>
      
      <div onClick={() => setIsExpanded(!isExpanded)} className="p-5 cursor-pointer flex flex-col sm:flex-row sm:items-center gap-4">
        
        <div className="flex items-center gap-4 flex-1">
          <div className={`flex flex-col justify-center items-center rounded-2xl w-16 h-16 shrink-0 border border-white/5 shadow-inner ${badgeBg}`}>
            <span className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-0.5">ORDEN</span>
            <span className="text-xl font-black">{order.short_code}</span>
          </div>
          
          <div className="min-w-0 flex-1">
            <h3 className="text-lg md:text-xl font-black text-white truncate">{order.customer_name || 'Sin Nombre'}</h3>
            <div className="flex items-center gap-2 mt-1">
               <Clock className="w-3.5 h-3.5 text-gray-500" />
               <span className="text-xs font-bold text-gray-400">
                 {isReady ? <CountdownTimer updatedAt={order.ready_at || order.created_at} expiryMinutes={orderExpiryMinutes} /> : `Ingresó hace ${diffMins} min`}
               </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 sm:shrink-0 border-t border-white/5 sm:border-0 pt-4 sm:pt-0">
          <div className="flex flex-col items-end mr-2 hidden sm:flex">
             <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Total</span>
             <span className="font-black text-white text-2xl">${new Intl.NumberFormat('es-CL').format(order.total_amount)}</span>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onClick(); }} 
            className={`w-12 h-12 md:w-14 md:h-14 rounded-[1.25rem] flex items-center justify-center text-white transition-all active:scale-95 shadow-lg ${actionColor}`}
            title={isExpired ? 'Cancelar expirado' : isReady ? 'Entregar pedido' : 'Marcar listo'}
          >
            {isExpired ? <X className="w-6 h-6" /> : <Check className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="p-5 border-t border-white/5 bg-black/20 flex flex-col gap-4">
            <div className="space-y-2.5">
               {order.items_description.split('\n').filter(Boolean).map((l: string, i: number) => {
                  const parts = l.split('|').map(p => p.trim());
                  let namePart = parts[0].startsWith('- ') ? parts[0].substring(2) : parts[0];
                  const pricePart = parts[1] || null;
                  
                  const qtyMatch = namePart.match(/^(\d+)\s*x\s*(.*)$/i) || namePart.match(/^(.*)\s*x\s*(\d+)$/i);
                  let quantity = "";
                  if (qtyMatch) {
                    if (namePart.match(/^(\d+)\s*x/i)) {
                      quantity = qtyMatch[1];
                      namePart = qtyMatch[2];
                    } else {
                      namePart = qtyMatch[1];
                      quantity = qtyMatch[2];
                    }
                  }

                  return (
                    <div key={i} className="flex items-center justify-between gap-4 bg-[#0b0f1a]/80 p-4 rounded-2xl border border-white/5 hover:border-orange-500/20 transition-all group">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.4)] shrink-0" />
                        <span className="font-bold text-gray-100 truncate leading-tight text-base md:text-lg">{namePart}</span>
                      </div>
                      
                      <div className="shrink-0">
                        <span className="font-black text-orange-500 text-lg md:text-xl tabular-nums bg-orange-500/10 px-4 py-1.5 rounded-2xl border border-orange-500/20 shadow-lg shadow-orange-950/20">
                          {quantity ? `${quantity} x ` : ''}{pricePart || ''}
                        </span>
                      </div>
                    </div>
                  );
               })}
            </div>
            <div className="flex justify-between items-center pt-3 sm:hidden border-t border-white/5">
               <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Total:</span>
               <span className="font-black text-white text-2xl">${new Intl.NumberFormat('es-CL').format(order.total_amount)}</span>
            </div>
            {!isReady && order.status === 'PENDING' && (
              <div className="flex justify-end pt-2">
                 <button 
                   onClick={(e) => { e.stopPropagation(); setEditingOrder(order); }} 
                   className="flex items-center gap-2 text-xs font-black bg-gray-900/40 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl border border-white/10 uppercase tracking-widest transition-colors"
                 >
                   <Settings className="w-4 h-4" /> Ajustar Pedido
                 </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CountdownTimer({ updatedAt, expiryMinutes }: any) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const timer = setInterval(() => {
      const diff = (new Date(updatedAt).getTime() + (expiryMinutes * 60000)) - new Date().getTime();
      if (diff <= 0) { setTimeLeft('EXPIRADO'); clearInterval(timer); }
      else { setTimeLeft(`${Math.floor(diff / 60000)}:${Math.floor((diff % 60000) / 1000).toString().padStart(2, '0')}`); }
    }, 1000);
    return () => clearInterval(timer);
  }, [updatedAt, expiryMinutes]);
  return <span className={timeLeft === 'EXPIRADO' ? 'text-red-500' : 'text-emerald-500'}>{timeLeft}</span>;
}

function EditOrderModal({ order, onClose, onSave, onCancelRequest }: any) {
  const parseLine = (line: string) => {
    const match = line.match(/^- ([\d./]+)(x|kg|g|L|ml|un|u)\s+(.*?)\s*\|\s*\$([\d.,]+)$/i);
    if (!match) return null;
    const [_, qtyStr, unit, name, subtotalStr] = match;
    const qty = parseFloat(qtyStr);
    const subtotal = parseInt(subtotalStr.replace(/\./g, ''), 10);
    const unitPrice = qty > 0 ? subtotal / qty : 0;
    return {
      id: Math.random().toString(),
      originalLine: line,
      qty,
      unit,
      name: name.trim(),
      unitPrice,
      subtotal
    };
  };

  const [items, setItems] = useState(() => {
    const lines = (order.items_description || '').split('\n').filter((l: string) => l.trim().length > 0);
    return lines.map((l: string) => {
      const parsed = parseLine(l);
      if (parsed) return { ...parsed, isParsed: true, removed: false };
      return { id: Math.random().toString(), originalLine: l, isParsed: false, removed: false };
    });
  });

  const total = items.reduce((acc: number, item: any) => {
    if (item.removed) return acc;
    if (item.isParsed) return acc + item.subtotal;
    const match = item.originalLine.match(/\$([\d.,]+)$/);
    if (match) return acc + parseInt(match[1].replace(/\./g, ''), 10);
    return acc;
  }, 0);

  const formatCurrency = (val: number) => new Intl.NumberFormat('es-CL').format(Math.round(val));

  const handleUpdateQty = (id: string, delta: number) => {
    setItems((prev: any) => prev.map((item: any) => {
      if (item.id === id && item.isParsed) {
        const isWeight = ['kg', 'L'].includes(item.unit.toLowerCase());
        const step = isWeight ? 0.1 : 1;
        const newQty = Math.max(step, item.qty + (delta * step));
        const roundedQty = Math.round(newQty * 100) / 100;
        return { ...item, qty: roundedQty, subtotal: roundedQty * item.unitPrice };
      }
      return item;
    }));
  };

  const toggleRemove = (id: string) => {
    setItems((prev: any) => prev.map((item: any) => item.id === id ? { ...item, removed: !item.removed } : item));
  };

  const handleSave = () => {
    const activeItems = items.filter((i: any) => !i.removed);
    const removedItemsStr = items.filter((i: any) => i.removed).map((i: any) => i.name || i.originalLine).join(', ');
    
    if (activeItems.length === 0) {
      toast.error('No puedes dejar el pedido vacío. Mejor rechaza o cancela el pedido completo.');
      return;
    }

    const finalDesc = activeItems.map((i: any) => {
      if (i.isParsed) {
        return `- ${i.qty}${i.unit} ${i.name} | $${formatCurrency(i.subtotal)}`;
      }
      return i.originalLine;
    }).join('\n');

    onSave(finalDesc, total, removedItemsStr);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-gray-950 p-6 md:p-8 rounded-[2.5rem] max-w-xl w-full border border-white/5 shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-orange-500/10 p-2.5 rounded-2xl border border-orange-500/20">
                <Settings className="w-6 h-6 text-orange-500" />
             </div>
             <div>
               <h3 className="text-xl font-black text-white leading-none">Ajustar Pedido</h3>
               <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Ticket #{order.short_code}</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white transition-colors bg-gray-900 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 mb-6 overflow-y-auto custom-scrollbar pr-2 flex-1 min-h-0">
          {items.map((i: any) => {
            const displayText = i.isParsed ? i.name : i.originalLine.split('|')[0].replace(/^- /, '').trim();
            const displayPrice = i.isParsed ? null : i.originalLine.split('|')[1]?.trim();

            return (
              <div key={i.id} className={`p-4 rounded-2xl border transition-all duration-300 ${i.removed ? 'bg-red-950/20 border-red-900/30 opacity-50' : 'bg-gray-900/60 border-white/5 shadow-lg'}`}>
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${i.removed ? 'bg-red-500' : 'bg-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'}`} />
                      <span className={`font-black truncate leading-tight ${i.removed ? 'text-red-400 line-through' : 'text-white'}`}>
                        {displayText}
                      </span>
                    </div>
                    {i.isParsed && !i.removed && (
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest ml-5">
                        Base: ${formatCurrency(i.unitPrice)} / {i.unit}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-3 shrink-0">
                    <button onClick={() => toggleRemove(i.id)} className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${i.removed ? 'bg-gray-950 border-white/5 text-gray-400 hover:text-white' : 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white'}`}>
                      {i.removed ? 'Restaurar' : 'Quitar'}
                    </button>
                    {!i.isParsed && !i.removed && displayPrice && (
                      <span className="font-black text-orange-500 tabular-nums bg-orange-500/5 px-2 py-0.5 rounded-lg border border-orange-500/10 text-xs">
                        {displayPrice}
                      </span>
                    )}
                  </div>
                </div>

                {i.isParsed && !i.removed && (
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-white/5">
                      <button onClick={() => handleUpdateQty(i.id, -1)} className="w-8 h-8 flex items-center justify-center bg-gray-950 hover:bg-gray-700 text-white rounded-lg transition-colors active:scale-95"><Minus className="w-4 h-4" /></button>
                      <div className="w-16 text-center font-black text-orange-400">{i.qty}{i.unit}</div>
                      <button onClick={() => handleUpdateQty(i.id, 1)} className="w-8 h-8 flex items-center justify-center bg-gray-950 hover:bg-gray-700 text-white rounded-lg transition-colors active:scale-95"><Plus className="w-4 h-4" /></button>
                    </div>
                    <div className="font-black text-emerald-400 text-lg">
                      ${formatCurrency(i.subtotal)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="shrink-0 bg-gray-900/80 p-5 rounded-[2rem] border border-white/5 mt-auto">
          <div className="flex items-center justify-between mb-4 px-2">
            <span className="text-gray-400 font-bold uppercase tracking-widest text-xs">Nuevo Total Estimado</span>
            <span className="text-4xl font-black text-white">${formatCurrency(total)}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-3">
             <button onClick={onCancelRequest} className="py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl font-black uppercase tracking-widest text-xs transition-all border border-red-500/20">Cancelar Pedido</button>
             <button onClick={handleSave} className="py-4 bg-orange-600 hover:bg-orange-500 text-white shadow-[0_10px_40px_rgba(234,88,12,0.2)] rounded-2xl font-black uppercase tracking-widest text-sm transition-all active:scale-95 flex items-center justify-center gap-2">
               <Check className="w-5 h-5" /> Guardar y Notificar
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CancelReasonModal({ order, onClose, onConfirm }: any) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const reasons = ["Sin Stock", "Local Cerrado", "Error en pedido", "Otro"];

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
      <div className="bg-gray-950 p-6 md:p-10 rounded-[2.5rem] max-w-md w-full border border-red-900/30 shadow-[0_0_50px_rgba(239,68,68,0.1)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent"></div>
        
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 shadow-inner">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          
          <h3 className="text-2xl font-black text-white mb-2">
            {!selectedReason ? "Cancelar Pedido" : "Confirmar Acción"}
          </h3>
          <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mb-8">
            Ticket #{order.short_code}
          </p>

          {!selectedReason ? (
            <div className="w-full space-y-3 mb-8">
              <p className="text-gray-400 text-sm mb-4">Seleccione el motivo de la cancelación:</p>
              {reasons.map(r => (
                <button 
                  key={r} 
                  onClick={() => setSelectedReason(r)} 
                  className="w-full p-4 bg-gray-900/50 hover:bg-red-600/20 text-white hover:text-red-400 rounded-2xl font-bold border border-white/5 hover:border-red-500/30 transition-all text-sm group flex justify-between items-center"
                >
                  {r}
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="w-full mb-8 space-y-4">
              <div className="bg-red-500/5 p-6 rounded-3xl border border-red-500/10">
                <p className="text-gray-300 text-sm leading-relaxed">
                  ¿Está seguro que desea cancelar este pedido por <span className="text-red-400 font-black">"{selectedReason}"</span>?
                </p>
                <p className="text-xs text-gray-500 mt-4 italic text-balance">
                  Esta acción notificará al cliente vía WhatsApp y no se puede deshacer.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 w-full">
            {selectedReason && (
              <button 
                onClick={() => onConfirm(selectedReason)} 
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-red-900/40 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" /> Confirmar Cancelación
              </button>
            )}
            
            <button 
              onClick={() => {
                if (selectedReason) {
                  setSelectedReason(null);
                } else {
                  onClose();
                }
              }} 
              className="w-full py-4 bg-gray-900 hover:bg-gray-900/80 text-gray-400 hover:text-white rounded-2xl font-bold uppercase tracking-widest text-xs transition-all border border-white/5"
            >
              {selectedReason ? "VOLVER A MOTIVOS" : "VOLVER A EDICIÓN"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-900/30 rounded-xl ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="iphone-liquid-scroll-safe flex-1 space-y-4 p-3 md:p-4 lg:p-6">
        <div className="mx-auto grid w-full max-w-[1700px] grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          {[1, 2].map(col => (
            <div key={col} className="relative flex flex-col overflow-hidden rounded-[2.5rem] border border-theme bg-theme-card shadow-xl min-h-[420px]">
              <div className={`absolute left-0 top-0 h-2 w-full ${col === 1 ? 'bg-amber-500/40' : 'bg-emerald-500/40'}`} />
              <div className="relative z-10 flex shrink-0 items-center justify-between p-6 md:p-8">
                <div className="flex items-center gap-5">
                  <div className={`flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl border ${col === 1 ? 'border-amber-500/20 bg-amber-500/10' : 'border-emerald-500/20 bg-emerald-500/10'}`}>
                    <div className={`h-1 w-8 rounded-full ${col === 1 ? 'bg-amber-500/30' : 'bg-emerald-500/30'}`} />
                  </div>
                  <Skeleton className="h-7 w-40 rounded-xl" />
                </div>
                <Skeleton className="h-14 w-14 rounded-2xl" />
              </div>
              <div className="flex-1 space-y-6 px-6 pb-10 md:px-10">
                {[1, 2, 3].map(card => (
                  <div key={card} className="space-y-6 rounded-[2rem] border border-theme bg-theme-panel p-6 shadow-sm">
                    <div className="flex items-center gap-5">
                      <Skeleton className="h-16 w-16 shrink-0 rounded-2xl" />
                      <div className="flex-1 space-y-3">
                        <Skeleton className="h-6 w-3/4 rounded-xl" />
                        <Skeleton className="h-4 w-1/2 rounded-lg opacity-50" />
                      </div>
                      <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
