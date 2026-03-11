import { useState, useEffect } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const UpdatePrompt = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener("sw-update-available", handler);
    return () => window.removeEventListener("sw-update-available", handler);
  }, []);

  if (!show) return null;

  const handleUpdate = () => {
    window.dispatchEvent(new CustomEvent("sw-do-update"));
    setShow(false);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-primary text-primary-foreground px-4 py-2.5 flex items-center justify-center gap-3 shadow-lg animate-in slide-in-from-top duration-300">
      <RefreshCw className="h-4 w-4 animate-spin" />
      <span className="text-sm font-medium">Nueva versión disponible</span>
      <Button
        size="sm"
        variant="secondary"
        className="h-7 px-3 text-xs font-semibold"
        onClick={handleUpdate}
      >
        Actualizar ahora
      </Button>
      <button onClick={() => setShow(false)} className="ml-1 opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
