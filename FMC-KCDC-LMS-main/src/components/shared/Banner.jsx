import React from "react";
import { User } from "lucide-react";

export default function Banner({ title, subtitle, icon }) {
  const Icon = icon;
  return (
    <div
      className="relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/images/img-greenheader.jpg')" }}
    >
      <div className="absolute inset-0 bg-black/10" />
      <div className="relative flex items-center gap-4 px-6 py-8 sm:px-8">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/20 backdrop-blur-lg">
          {Icon ? (
            <Icon size={24} className="text-white" />
          ) : (
            <User size={24} className="text-white" />
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold text-white sm:text-2xl">{title}</h1>
          {subtitle && <p className="text-sm text-green-50">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
