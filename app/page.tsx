"use client";

import { useState, useEffect } from "react";
import * as XLSX from 'xlsx';
import {
  UploadCloud, Loader2, ShieldCheck,
  Database, User, Trash2, ExternalLink, X, Download
} from "lucide-react";

// --- VARIABILE CLOUD INTELLIGENTE ---
// Se il sito è online su Vercel, userà il link di Render. Altrimenti usa localhost.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function BrokerUtility() {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/storia`);
      setHistory(await res.json());
    } catch (e) { console.error("Server non raggiungibile"); }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      await fetch(`${API_URL}/api/estrai-polizza`, { method: "POST", body: fd });
    }
    await loadHistory();
    setIsUploading(false);
    setFiles([]);
  };

  const getClientePrincipale = (soggetti: any[]) => {
    if (!soggetti || soggetti.length === 0) return "N/D";
    const contraente = soggetti.find(s => s.ruolo.toLowerCase().includes("contraente"));
    if (contraente) return contraente.nome_cognome;
    const assicurato = soggetti.find(s => s.ruolo.toLowerCase().includes("assicurato"));
    if (assicurato) return assicurato.nome_cognome;
    return soggetti[0].nome_cognome;
  };

  const exportExcel = () => {
    const dataPerExcel = history.map(h => ({
      "CLIENTE": getClientePrincipale(h.soggetti_coinvolti).toUpperCase(),
      "COMPAGNIA": h.compagnia,
      "NUMERO POLIZZA": h.numero_polizza,
      "RAMO": h.tipo_polizza,
      "PREMIO LORDO": h.premio_totale,
      "FILE ORIGINALE": h.nome_file,
      "SOGGETTI": h.soggetti_coinvolti.map((s: any) => `${s.nome_cognome} (${s.ruolo})`).join(" | ")
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataPerExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Polizze");

    worksheet['!cols'] = [{ wch: 30 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 50 }];

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const fileData = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = window.URL.createObjectURL(fileData);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Report_BrokerAI_${new Date().toISOString().split('T')[0]}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const clearAll = async () => {
    if (confirm("Vuoi cancellare tutto l'archivio?")) {
      await fetch(`${API_URL}/api/pulisci-tutto`, { method: "DELETE" });
      loadHistory();
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 md:p-12 font-sans text-slate-900">
      <div className="max-w-[1500px] mx-auto">

        <header className="flex justify-between items-center mb-10 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg">
              <ShieldCheck className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">Broker<span className="text-indigo-600">AI</span></h1>
          </div>

          <div className="flex gap-4">
            {history.length > 0 && (
              <>
                <button onClick={clearAll} className="p-3 text-red-400 hover:text-red-600 transition-colors"><Trash2 size={24} /></button>
                <button
                  onClick={exportExcel}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition-all active:scale-95"
                >
                  <Download size={20} /> SCARICA EXCEL
                </button>
              </>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
              <h3 className="font-bold mb-6 text-slate-800">Analisi Rapida</h3>
              <label className="flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-slate-200 rounded-3xl cursor-pointer hover:bg-slate-50 transition-all group">
                <UploadCloud className="text-slate-300 mb-2 group-hover:text-indigo-500 transition-colors" size={40} />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center px-4">Carica i PDF qui</p>
                <input type="file" multiple accept=".pdf" className="hidden" onChange={(e) => e.target.files && setFiles(Array.from(e.target.files))} />
              </label>
              {files.length > 0 && (
                <button onClick={handleUpload} className="w-full mt-6 bg-indigo-600 text-white py-4 rounded-2xl font-bold uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all">
                  {isUploading ? <Loader2 className="animate-spin mx-auto" /> : "Estrai Dati"}
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-black text-slate-800 tracking-tight italic">Database Conversioni</h3>
                <span className="text-[10px] font-black text-slate-400 uppercase bg-white px-3 py-1 rounded-full border border-slate-100">{history.length} Record</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-widest border-b">
                    <tr>
                      <th className="px-8 py-5">Cliente</th>
                      <th className="px-8 py-5">Compagnia</th>
                      <th className="px-8 py-5">Premio</th>
                      <th className="px-8 py-5 text-center">Info</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((h, i) => (
                      <tr key={i} className="hover:bg-indigo-50/30 transition-all group">
                        <td className="px-8 py-6 font-black text-slate-800 uppercase text-sm">
                          {getClientePrincipale(h.soggetti_coinvolti)}
                        </td>
                        <td className="px-8 py-6 text-sm text-slate-500 font-bold uppercase">{h.compagnia}</td>
                        <td className="px-8 py-6 text-sm font-mono font-bold text-indigo-600 group-hover:scale-105 transition-transform">{h.premio_totale}</td>
                        <td className="px-8 py-6 text-center">
                          <button onClick={() => setSelected(h)} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 rounded-xl shadow-sm transition-all">
                            <ExternalLink size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODALE DETTAGLI */}
      {selected && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="p-8 bg-indigo-600 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tight italic">Anagrafica Completa</h3>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-white/20 rounded-full transition-all"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-4 bg-slate-50 max-h-[60vh] overflow-y-auto">
              {selected.soggetti_coinvolti?.map((s: any, idx: number) => (
                <div key={idx} className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><User size={20} /></div>
                  <div>
                    <p className="font-black text-slate-800 uppercase text-sm leading-tight">{s.nome_cognome}</p>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">{s.ruolo}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
