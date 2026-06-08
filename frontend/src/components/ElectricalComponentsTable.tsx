import React from "react";
import { 
  Lightbulb, 
  Radio, 
  Zap, 
  Wind, 
  Droplets, 
  Flame, 
  Bell, 
  Box, 
  ToggleRight, 
  Plug,
  Cpu
} from "lucide-react";

const componentsData = {
  'LED_Disc_Light': 26, 
  'SM_Detector': 7, 
  'GFI': 14, 
  'Ex_Vent': 3, 
  'CHWater_Supply': 1, 
  'HBB': 2, 
  'Doorbell': 1, 
  'JB': 3, 
  'SSwitch': 17, 
  '110V_Outlet': 21
};

const componentMeta: Record<string, { label: string; icon: React.ComponentType<any>; color: string; barColor: string }> = {
  'LED_Disc_Light': { label: 'LED Disc Light', icon: Lightbulb, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', barColor: 'bg-amber-500' },
  'SM_Detector': { label: 'SM Detector', icon: Radio, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', barColor: 'bg-rose-500' },
  'GFI': { label: 'GFI Outlet', icon: Zap, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', barColor: 'bg-yellow-500' },
  'Ex_Vent': { label: 'Exhaust Vent', icon: Wind, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20', barColor: 'bg-sky-500' },
  'CHWater_Supply': { label: 'CHWater Supply', icon: Droplets, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', barColor: 'bg-blue-500' },
  'HBB': { label: 'HBB Heater', icon: Flame, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', barColor: 'bg-orange-500' },
  'Doorbell': { label: 'Doorbell', icon: Bell, color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20', barColor: 'bg-yellow-500' },
  'JB': { label: 'Junction Box', icon: Box, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20', barColor: 'bg-slate-500' },
  'SSwitch': { label: 'Single Switch', icon: ToggleRight, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', barColor: 'bg-indigo-500' },
  '110V_Outlet': { label: '110V Outlet', icon: Plug, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', barColor: 'bg-emerald-500' },
};

export const ElectricalComponentsTable: React.FC = () => {
  const totalCount = Object.values(componentsData).reduce((a, b) => a + b, 0);

  return (
    <div className="w-full space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Cpu className="h-5 w-5 text-indigo-400 animate-pulse" />
        <h3 className="text-lg font-bold text-slate-100 uppercase tracking-wide">Electrical Components</h3>
      </div>

      {/* Grid of Compact Cards */}
      <div className="gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {Object.entries(componentsData)
          .sort((a, b) => b[1] - a[1]) // Sort descending
          .map(([name, count]) => {
            const meta = componentMeta[name] || {
              label: name,
              icon: Cpu,
              color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
              barColor: 'bg-slate-500'
            };
            const Icon = meta.icon;
            const percentage = (count / totalCount) * 100;

            return (
              <div 
                key={name} 
                className="glass p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all duration-200 hover:scale-[1.02] hover:bg-slate-800/30" 
                style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(30,41,59,0.2)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center border shrink-0 ${meta.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-200 truncate">{meta.label}</span>
                </div>
                <div className="shrink-0 font-mono pr-1">
                  <span className="text-base font-extrabold text-slate-100">{count}</span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
