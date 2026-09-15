import { useEffect, useState } from "react";

type Theme = "light" | "dark";

// readInitialTheme: uu tien lua chon nguoi dung da luu, khong thi theo he thong
function readInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem("rugradar-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // localStorage co the bi chan (che do rieng tu...), bo qua va doan theo he thong
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// ThemeToggle: nut bat/tat dark mode, dat co dinh goc tren-phai man hinh
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("rugradar-theme", theme);
    } catch {
      // khong luu duoc thi thoi, chi anh huong lan sau mo lai trang
    }
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="fixed right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border-soft bg-surface text-ink-muted transition hover:text-ink sm:right-6 sm:top-6"
    >
      {theme === "dark" ? (
        // icon mat troi: hien khi dang o dark mode, bam de chuyen sang light
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path
            strokeLinecap="round"
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
      ) : (
        // icon mat trang: hien khi dang o light mode, bam de chuyen sang dark
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M20.4 14.7A8.5 8.5 0 0 1 9.3 3.6a.6.6 0 0 0-.7-.8A9 9 0 1 0 21.2 15.4a.6.6 0 0 0-.8-.7Z" />
        </svg>
      )}
    </button>
  );
}
