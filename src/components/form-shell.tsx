import type { ReactNode } from "react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

interface FormShellProps {
  tag: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function FormShell({ tag, title, subtitle, children }: FormShellProps) {
  return (
    <div className="min-h-screen bg-industrial text-slate-100">
      <SiteNav />
      <div className="relative border-b border-white/5 overflow-hidden">
        <div className="absolute inset-0 blueprint-grid opacity-40 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-6 py-14">
          <span className="text-brand font-mono text-xs uppercase tracking-widest">{tag}</span>
          <h1 className="text-3xl md:text-5xl font-display font-bold mt-3 italic text-balance">
            {title}
          </h1>
          <p className="text-slate-400 mt-4 max-w-2xl">{subtitle}</p>
        </div>
      </div>
      <main className="max-w-4xl mx-auto px-6 py-12">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
          {label}
          {required && <span className="text-brand ml-1">*</span>}
        </span>
        {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full bg-industrial border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition";

export const selectCls = inputCls + " appearance-none";
export const textareaCls = inputCls + " min-h-[100px] resize-y";
