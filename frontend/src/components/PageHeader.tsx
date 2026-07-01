import type { ReactNode } from 'react';
import InfoTip from './InfoTip';
import type { HelpContent } from '../lib/help';

/** Encabezado estándar: título + (i) ayuda + subtítulo de contexto + acciones. */
export default function PageHeader({
  title, subtitle, help, children,
}: {
  title: string;
  subtitle?: string;
  help?: HelpContent;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black">{title}</h1>
          {help && <InfoTip help={help} />}
        </div>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-gray-400">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
