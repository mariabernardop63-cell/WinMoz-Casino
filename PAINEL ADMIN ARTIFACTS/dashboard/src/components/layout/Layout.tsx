import { useState } from "react";
import Sidebar from "./Sidebar";
import NotificationsDropdown from "./NotificationsDropdown";
import CalendarPopover from "./CalendarPopover";
import ProfileMenu from "./ProfileMenu";
import { Search, X, Moon, Sun, Menu } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface TopBarProps {
  onMenuClick: () => void;
}

function TopBar({ onMenuClick }: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="gz-topbar h-[56px] flex items-center justify-between px-5 gap-3 flex-shrink-0 sticky top-0 z-40">
      {/* Left — hamburger (mobile) + Search */}
      <div className="flex items-center gap-2">
        {/* Hamburger — only visible on mobile */}
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 rounded-2xl flex items-center justify-center transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95 flex-shrink-0"
          style={{ background: "var(--gz-bg-card-btn)", boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 2px 10px rgba(0,0,0,.06)" }}
          title="Menu"
        >
          <Menu className="w-4 h-4 text-gray-400" strokeWidth={1.8} />
        </button>

        {searchOpen ? (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl"
              style={{
                background: "var(--gz-bg-card-btn)",
                border: "1.5px solid rgba(108,92,231,.2)",
                boxShadow: "0 2px 12px rgba(108,92,231,.1)",
              }}
            >
              <Search className="w-3.5 h-3.5 text-indigo-400" strokeWidth={2} />
              <input
                autoFocus
                placeholder="Buscar partidas, jogadores..."
                className="bg-transparent outline-none text-[13px] text-gray-700 placeholder-gray-400 w-40 sm:w-52"
              />
            </div>
            <button
              onClick={() => setSearchOpen(false)}
              className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-red-50 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-gray-400" strokeWidth={2} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-[12.5px] font-medium transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95"
            style={{
              background: "var(--gz-bg-card-btn)",
              color: "#9ca3af",
              boxShadow: "0 1px 3px rgba(0,0,0,.05), 0 2px 10px rgba(0,0,0,.06)",
            }}
          >
            <Search className="w-3.5 h-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">Buscar...</span>
            <kbd
              className="ml-1 text-[10px] px-1.5 py-0.5 rounded-lg font-mono hidden sm:inline"
              style={{
                background: "var(--gz-bg-subtle)",
                color: "#a78bfa",
                border: "1px solid rgba(108,92,231,.1)",
              }}
            >
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      {/* Right — icons + profile */}
      <div className="flex items-center gap-2">
        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95"
          style={{ background: "var(--gz-bg-card-btn)", boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 2px 10px rgba(0,0,0,.06)" }}
          title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
        >
          {theme === "dark"
            ? <Sun className="w-4 h-4 text-amber-400" strokeWidth={1.8} />
            : <Moon className="w-4 h-4 text-gray-400" strokeWidth={1.8} />
          }
        </button>

        <CalendarPopover />
        <NotificationsDropdown />

        {/* Separator */}
        <div className="w-px h-6 mx-0.5 hidden sm:block" style={{ background: "rgba(108,92,231,.1)" }} />

        <ProfileMenu />
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "hsl(var(--background))" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed on desktop, slide-over on mobile */}
      <div
        className={`lg:block transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50 }}
      >
        <div className="h-full" style={{ paddingTop: 12, paddingLeft: 12, paddingBottom: 12 }}>
          <Sidebar onItemClick={() => setSidebarOpen(false)} />
        </div>
      </div>

      {/* Main content — margin-left only on large screens */}
      <div
        className="lg:ml-[92px]"
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        <TopBar onMenuClick={() => setSidebarOpen(o => !o)} />
        <div style={{ flex: 1, overflowX: "auto" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
