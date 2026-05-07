import { createContext, useContext, useState, type ReactNode } from "react";
import { zh } from "./zh.js";
import { en } from "./en.js";

export type Lang = "zh" | "en";
export type Dict = Record<string, string>;

const dicts: Record<Lang, Dict> = { zh, en };

const LangContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}>({
  lang: "zh",
  setLang: () => {},
  t: (k) => k,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("zh");
  const t = (key: string): string => {
    return dicts[lang][key] ?? key;
  };
  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
