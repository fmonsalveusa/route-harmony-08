const steps = [
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'on_site', label: 'On Site' },
  { key: 'picked_up', label: 'Picked Up' },
  { key: 'delivered', label: 'Delivered' },
];

const statusOrder: Record<string, number> = {
  dispatched: 0,
  in_transit: 1,
  on_site_pickup: 2,
  on_site_delivery: 2,
  picked_up: 3,
  delivered: 4,
  paid: 5,
};

/** Progreso de la carga estilo Material 3: segmentos azules + etiqueta del paso actual */
export const LoadProgressBar = ({ status, compact = false }: { status: string; compact?: boolean }) => {
  const currentStep = statusOrder[status] ?? 0;

  return (
    <div className="w-full">
      <div className="flex items-center w-full gap-1">
        {steps.map((step, i) => (
          <div
            key={step.key}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              currentStep > i ? 'bg-[#0b57d0]' : currentStep === i ? 'bg-[#0b57d0]/60' : 'bg-[#dde3ea]'
            }`}
          />
        ))}
      </div>
      {!compact && (
        <div className="flex w-full gap-1 mt-1.5">
          {steps.map((step, i) => (
            <span
              key={step.key}
              className={`flex-1 text-center text-[10px] leading-tight ${
                currentStep === i ? 'font-semibold text-[#0b57d0]' : currentStep > i ? 'text-[#444746]' : 'text-[#9aa0a6]'
              }`}
            >
              {step.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
