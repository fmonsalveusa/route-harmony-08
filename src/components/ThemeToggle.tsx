import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const themeOrder = ['system', 'light', 'dark'] as const;
const themeIcons = { system: Monitor, light: Sun, dark: Moon };
const themeLabels = { system: 'System', light: 'Light', dark: 'Dark' };

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const current = (theme || 'system') as keyof typeof themeIcons;
  const Icon = themeIcons[current] || Monitor;

  const cycle = () => {
    const idx = themeOrder.indexOf(current);
    setTheme(themeOrder[(idx + 1) % themeOrder.length]);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={cycle}
          className="p-2 rounded-full text-[#444746] hover:bg-[#e1e6ee] dark:text-white dark:hover:bg-white/10 transition-colors"
        >
          <Icon className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{themeLabels[current]} theme</TooltipContent>
    </Tooltip>
  );
};
