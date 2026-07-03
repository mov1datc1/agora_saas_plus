'use client';

import React from 'react';
import Link from 'next/link';

export default function UnderConstruction() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center relative overflow-hidden">
      {/* Background Glow Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-[100px] mix-blend-screen pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center justify-center max-w-2xl text-center px-6">
        {/* Animated Icon */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-red-500/30 blur-2xl rounded-full" />
          <div className="relative bg-black/50 border border-white/10 p-6 rounded-2xl backdrop-blur-xl">
            <svg 
              className="w-12 h-12 text-red-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        {/* Text Content */}
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-6">
          Estamos realizando mejoras
        </h1>
        <p className="text-lg text-gray-400 mb-10 leading-relaxed max-w-xl mx-auto">
          Ágora Plus se encuentra temporalmente en modo de mantenimiento mientras implementamos nuevas funcionalidades. Vuelve pronto para explorar todas las novedades.
        </p>

        {/* Admin Login Link */}
        <div className="mt-8 border-t border-white/5 pt-8 w-full">
          <Link 
            href="/login" 
            className="text-sm font-medium text-gray-500 hover:text-white transition-colors duration-200"
          >
            Acceso Administrativo &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
