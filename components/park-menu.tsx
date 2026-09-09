import { useState, type ComponentType } from "react";
import { Menu, X } from "lucide-react";
export type ParkAction = {
  id: string;
  label: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  run: () => void;
  active?: boolean;
  badge?: boolean;
};
export default function ParkMenu({
  actions,
  open,
  setOpen,
}: {
  actions: ParkAction[];
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const [tip, setTip] = useState("");
  return (
    <nav className={`park-fan ${open ? "expanded" : ""}`} aria-label="Parkmenü">
      {open && (
        <>
          <div className="fan-backdrop" />
          {actions.map((a, i) => {
            const outerCount = Math.ceil(actions.length * 0.6),
              outer = i < outerCount,
              index = outer ? i : i - outerCount,
              count = outer ? outerCount : actions.length - outerCount;
            const angle = Math.PI - (index * Math.PI) / Math.max(1, count - 1),
              radius = outer ? 164 : 103;
            return (
              <button
                key={a.id}
                className={`fan-action ${a.active ? "active" : ""} ${a.id === "research" ? "research-action" : ""}`}
                style={{
                  left: 190 + Math.cos(angle) * radius,
                  top: 196 - Math.sin(angle) * radius,
                }}
                aria-label={a.label}
                aria-pressed={a.active || false}
                title={a.label}
                onMouseEnter={() => setTip(a.label)}
                onMouseLeave={() => setTip("")}
                onFocus={() => setTip(a.label)}
                onBlur={() => setTip("")}
                onClick={() => {
                  a.run();
                  setOpen(false);
                  setTip("");
                }}
              >
                <a.Icon size={22} strokeWidth={1.8} />
                {a.badge && <i className="fan-badge" />}
              </button>
            );
          })}
        </>
      )}
      <button
        className="fan-toggle"
        aria-label={open ? "Parkmenü einklappen" : "Parkmenü öffnen"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        title="Parkmenü"
      >
        {open ? <X size={23} /> : <Menu size={23} />}
        <span>Parkmenü</span>
      </button>
      {open && (
        <div className="fan-caption" role="status">
          {tip || "Bauen · Entdecken · Verwalten"}
        </div>
      )}
      {!open && (
        <button
          className="research-shortcut"
          title="Forschung & Freischaltungen"
          aria-label="Forschung & Freischaltungen"
          onClick={() => actions.find((a) => a.id === "research")?.run()}
        >
          {(() => {
            const Icon = actions.find((a) => a.id === "research")!.Icon;
            return <Icon size={20} />;
          })()}
          <span>Forschung</span>
        </button>
      )}
    </nav>
  );
}
