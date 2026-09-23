import { Sun, Moon, Monitor, Palette } from "lucide-react";
import { useTheme, type ThemeMode, ACCENT_COLORS } from "@/hooks/useTheme";

const AppearanceSettings = () => {
  const { theme, setTheme, accentColor, setAccentColor } = useTheme();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Aparência</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Personalize o tema e a cor da plataforma.
        </p>
      </div>

      <div className="space-y-4">
        {/* Tema */}
        <div className="flex items-center justify-between p-5 rounded-xl border border-border bg-card">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Tema do sistema</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Escolha entre tema escuro, claro ou automático.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            {([
              { value: "dark" as ThemeMode, icon: Moon, label: "Escuro" },
              { value: "light" as ThemeMode, icon: Sun, label: "Claro" },
              { value: "auto" as ThemeMode, icon: Monitor, label: "Auto" },
            ]).map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  theme === value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cor */}
        <div className="flex items-center justify-between p-5 rounded-xl border border-border bg-card">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Cor da plataforma
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Escolha a cor de destaque principal da interface.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap max-w-[280px] justify-end">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.name}
                onClick={() => setAccentColor(color.name)}
                title={color.label}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  accentColor === color.name
                    ? "border-foreground scale-110 shadow-md"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: `hsl(${color.hsl})` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppearanceSettings;
