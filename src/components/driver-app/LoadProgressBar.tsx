import { Check } from 'lucide-react';

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

export const LoadProgressBar = ({ status }: { status: string }) => {
  const currentStep = statusOrder[status] ?? 0;

  return (
    <div className="flex items-center w-full gap-1">
      {steps.map((step, i) => {
        const completed = currentStep > i;
        const active = currentStep === i;
        return (
          <div key={step.key} className="flex-1 flex flex-col items-center gap-1">
            <div className={`w-full h-1.5 rounded-full transition-colors ${
              completed ? 'bg-success' : active ? 'bg-accent' : 'bg-muted'
            }`} />
            <div className="flex items-center gap-0.5">
              {completed && <Check className="h-2.5 w-2.5 text-success" />}
              <span className={`text-[10px] font-medium ${
                completed ? 'text-success' : active ? 'text-accent' : 'text-muted-foreground'
              }`}>
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
