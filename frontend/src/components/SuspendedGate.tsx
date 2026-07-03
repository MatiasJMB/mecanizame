import { useAuth } from '../context/AuthContext';
import { billingInfo } from '../lib/billing';
import { AlertCircle } from 'lucide-react';

/** Bloqueo del taller ACTIVO cuando está suspendido por falta de pago o deshabilitado.
 *  Se muestra dentro del contenido: el sidebar y el selector siguen visibles para que
 *  el usuario pueda cambiar a otro taller sano. Nunca se le expulsa de la sesión. */
export default function SuspendedGate() {
  const { organization } = useAuth();
  if (!organization) return null;

  const pending = organization.is_approved === false;
  const disabled = organization.is_active === false;
  const bi = billingInfo(organization.paid_until);

  const title = pending ? 'Taller pendiente de aprobación'
    : disabled ? 'Taller deshabilitado'
    : 'Servicio suspendido por falta de pago';

  return (
    <div className={`mx-auto max-w-lg rounded-2xl border border-dashed p-8 text-center sm:mt-8 ${pending ? 'border-amber-500/30 bg-amber-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
      <div className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${pending ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
        <AlertCircle className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-xl font-black">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
        {pending
          ? <>El taller <b>{organization.name}</b> está esperando la aprobación del administrador. Podrás usarlo en cuanto lo apruebe.</>
          : disabled
          ? <>El taller <b>{organization.name}</b> fue deshabilitado por el administrador. Contáctalo para reactivarlo.</>
          : <>El taller <b>{organization.name}</b> venció el <b>{bi.dueLabel}</b> y superó el período de gracia. Regulariza el pago con el administrador para reactivar el acceso.</>}
      </p>
      <p className="mx-auto mt-4 max-w-md text-xs text-gray-500">
        Si tienes otros talleres, cambia a uno de ellos con el selector de taller.
      </p>
    </div>
  );
}
