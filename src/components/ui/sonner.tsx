import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#1f1f1f] group-[.toaster]:text-white group-[.toaster]:border-0 group-[.toaster]:rounded-2xl group-[.toaster]:shadow-[0_1px_3px_rgba(60,64,67,.3),0_4px_8px_3px_rgba(60,64,67,.15)] group-[.toaster]:px-4 group-[.toaster]:py-3",
          description: "group-[.toast]:text-white/80",
          actionButton: "group-[.toast]:bg-transparent group-[.toast]:text-[#a8c7fa] group-[.toast]:font-medium",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
