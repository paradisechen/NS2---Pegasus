import { useEffect, useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import type { AdaptivePalette } from '../types/skyline';
import type { Switch2LayoutMetrics } from '../utils/rp5Layout';
import { SwitchPdfIcon, type SwitchPdfButtonKey } from './SwitchPdfIcons';
import { BottomControllerGlyph } from './BottomControllerGlyph';

interface ControllersViewProps {
  palette: AdaptivePalette;
  metrics: Switch2LayoutMetrics;
  onClose: () => void;
}

const BUTTON_MAPPINGS: {
  button: SwitchPdfButtonKey;
  label: string;
  action: string;
}[] = [
  { button: 'DPAD', label: 'D-Pad', action: 'Navigate Library & Menus' },
  { button: 'STICK_L', label: 'Left Stick', action: 'Browse Carousel & Scroll Feeds' },
  { button: 'STICK_R', label: 'Right Stick', action: 'Next / Prev Feed Page' },
  { button: 'A', label: 'A Button', action: 'Start Title / Confirm / Open Story' },
  { button: 'B', label: 'B Button', action: 'Back / Close Overlay' },
  { button: 'X', label: 'X Button', action: 'Toggle Favorite / eShop Wish List' },
  { button: 'Y', label: 'Y Button', action: 'Game Details' },
  { button: 'L1', label: 'L1 / Lb', action: 'Previous Dock Section (Fade)' },
  { button: 'R1', label: 'R1 / Rb', action: 'Next Dock Section (Fade)' },
  { button: 'L2', label: 'ZL / L2', action: 'eShop Previous Page' },
  { button: 'R2', label: 'ZR / R2', action: 'eShop Next Page' },
  { button: 'PLUS', label: '+ Start', action: 'Software + Settings Overlay' },
];

/**
 * Full-Screen Dark Controllers UI matching Nintendo eShop aesthetic,
 * featuring a Switch 2 / Retroid Pocket 5 controller diagram & exact PDF button icons.
 */
export function ControllersView({ metrics, onClose }: ControllersViewProps) {
  const [selectedBtn, setSelectedBtn] = useState<SwitchPdfButtonKey>('A');
  const [gripOrder, setGripOrder] = useState<'nintendo' | 'xbox'>('nintendo');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const h = metrics.viewportHeight;
  const padX = Math.max(24, Math.round(metrics.screenMargin * 0.92));
  const activeMapping =
    BUTTON_MAPPINGS.find((m) => m.button === selectedBtn) ?? BUTTON_MAPPINGS[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Controllers"
      data-testid="controllers-view"
      className="animate-ns2-fade absolute inset-0 z-40 flex flex-col overflow-hidden select-none"
      style={{ backgroundColor: '#191A1D', color: '#F3F4F6' }}
    >
      {/* Top Dark Header matching eShop */}
      <div style={{ paddingLeft: `${padX}px`, paddingRight: `${padX}px` }}>
        <div
          className="flex items-center justify-between"
          style={{ height: `${Math.max(46, Math.round(h * 0.105))}px` }}
        >
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-6 h-6 text-[#0AB9E6]" />
            <h1
              className="font-ud-bold tracking-tight"
              style={{ fontSize: `${Math.max(17, Math.round(h * 0.034))}px` }}
            >
              Controllers · Retroid Pocket 5 &amp; Switch 2
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGripOrder('nintendo')}
              className="px-3.5 py-1.5 rounded-full text-xs font-ud-bold cursor-pointer transition-colors"
              style={{
                backgroundColor: gripOrder === 'nintendo' ? '#0AB9E6' : '#26282E',
                color: '#FFFFFF',
              }}
            >
              Switch 2 Layout (B/A)
            </button>
            <button
              type="button"
              onClick={() => setGripOrder('xbox')}
              className="px-3.5 py-1.5 rounded-full text-xs font-ud-bold cursor-pointer transition-colors"
              style={{
                backgroundColor: gripOrder === 'xbox' ? '#E60012' : '#26282E',
                color: '#FFFFFF',
              }}
            >
              Retro / RP5 Layout
            </button>
          </div>
        </div>
        <div className="w-full h-px bg-white/10" />
      </div>

      {/* Main Split: Left Handheld Diagram / Right PDF Button Mappings */}
      <div
        className="flex-1 grid grid-cols-12 gap-6 min-h-0 items-center"
        style={{
          paddingLeft: `${padX}px`,
          paddingRight: `${padX}px`,
          paddingTop: '14px',
          paddingBottom: '14px',
        }}
      >
        {/* Left: Switch 2 / Retroid Pocket 5 Handheld Diagram */}
        <div className="col-span-5 flex flex-col items-center justify-center gap-4">
          <div
            className="w-full rounded-2xl p-5 flex flex-col items-center gap-3"
            style={{
              backgroundColor: '#23252B',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {/* Shoulder Triggers Row */}
            <div className="w-full flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <SwitchPdfIcon button="L2" size={24} fillColor="#9CA3AF" cutoutColor="#191A1D" />
                <SwitchPdfIcon button="L1" size={24} fillColor="#0AB9E6" cutoutColor="#191A1D" />
              </div>
              <span className="text-[11px] font-ud-semibold text-gray-400">
                P1 · Connected
              </span>
              <div className="flex items-center gap-2">
                <SwitchPdfIcon button="R1" size={24} fillColor="#FF4F5E" cutoutColor="#191A1D" />
                <SwitchPdfIcon button="R2" size={24} fillColor="#9CA3AF" cutoutColor="#191A1D" />
              </div>
            </div>

            {/* Handheld Body */}
            <div className="w-full flex items-center gap-2">
              {/* Left Joy-Con / Grip */}
              <div
                className="w-16 h-44 rounded-l-2xl flex flex-col items-center justify-between py-4 px-1"
                style={{ backgroundColor: '#0A8FB8' }}
              >
                <SwitchPdfIcon button="MINUS" size={16} fillColor="#191A1D" cutoutColor="#FFFFFF" />
                <SwitchPdfIcon button="STICK_L" size={24} fillColor="#191A1D" cutoutColor="#FFFFFF" />
                <SwitchPdfIcon button="DPAD" size={24} fillColor="#191A1D" cutoutColor="#FFFFFF" />
                <SwitchPdfIcon button="CAPTURE" size={16} fillColor="#191A1D" cutoutColor="#FFFFFF" />
              </div>

              {/* Center 16:9 Screen */}
              <div className="flex-1 h-40 rounded-lg bg-[#111317] border border-white/10 flex flex-col items-center justify-center p-3 text-center gap-2">
                <SwitchPdfIcon
                  button={activeMapping.button}
                  size={34}
                  fillColor="#FFFFFF"
                  cutoutColor="#191A1D"
                />
                <div className="font-ud-bold text-sm text-white">{activeMapping.label}</div>
                <div className="font-ud-regular text-[11px] text-sky-300 leading-tight">
                  {activeMapping.action}
                </div>
              </div>

              {/* Right Joy-Con / Grip */}
              <div
                className="w-16 h-44 rounded-r-2xl flex flex-col items-center justify-between py-4 px-1"
                style={{ backgroundColor: '#D92B3A' }}
              >
                <SwitchPdfIcon button="PLUS" size={16} fillColor="#191A1D" cutoutColor="#FFFFFF" />
                <div className="grid grid-cols-2 gap-1">
                  <SwitchPdfIcon
                    button={gripOrder === 'nintendo' ? 'X' : 'Y'}
                    size={16}
                    fillColor="#191A1D"
                    cutoutColor="#FFFFFF"
                  />
                  <SwitchPdfIcon
                    button={gripOrder === 'nintendo' ? 'A' : 'B'}
                    size={16}
                    fillColor="#191A1D"
                    cutoutColor="#FFFFFF"
                  />
                  <SwitchPdfIcon
                    button={gripOrder === 'nintendo' ? 'Y' : 'X'}
                    size={16}
                    fillColor="#191A1D"
                    cutoutColor="#FFFFFF"
                  />
                  <SwitchPdfIcon
                    button={gripOrder === 'nintendo' ? 'B' : 'A'}
                    size={16}
                    fillColor="#191A1D"
                    cutoutColor="#FFFFFF"
                  />
                </div>
                <SwitchPdfIcon button="STICK_R" size={24} fillColor="#191A1D" cutoutColor="#FFFFFF" />
                <SwitchPdfIcon button="HOME" size={18} fillColor="#191A1D" cutoutColor="#FFFFFF" />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Interactive PDF Icon Map Grid */}
        <div className="col-span-7 grid grid-cols-2 gap-2.5 h-full max-h-[68vh] overflow-y-auto no-scrollbar pr-1">
          {BUTTON_MAPPINGS.map((item) => {
            const isActive = selectedBtn === item.button;
            return (
              <button
                key={item.button}
                type="button"
                onMouseEnter={() => setSelectedBtn(item.button)}
                onClick={() => setSelectedBtn(item.button)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left cursor-pointer transition-colors"
                style={{
                  backgroundColor: isActive ? '#2C303A' : '#23252B',
                  boxShadow: isActive ? '0 0 0 2px #0AB9E6' : 'none',
                }}
              >
                <SwitchPdfIcon
                  button={item.button}
                  size={24}
                  fillColor="#FFFFFF"
                  cutoutColor="#191A1D"
                />
                <div className="min-w-0">
                  <div className="font-ud-bold text-xs text-white truncate">{item.label}</div>
                  <div className="font-ud-regular text-[11px] text-gray-300 truncate">
                    {item.action}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Dark Footer */}
      <footer
        className="flex items-center justify-between px-6 shrink-0"
        style={{
          height: `${Math.max(38, Math.round(h * 0.082))}px`,
          backgroundColor: '#191A1D',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <BottomControllerGlyph size={metrics.helpIconSize} color="#E5E7EB" />
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80"
        >
          <SwitchPdfIcon button="B" size={20} fillColor="#FFFFFF" cutoutColor="#191A1D" />
          <span className="font-ud-semibold text-xs text-gray-100">Back</span>
        </button>
      </footer>
    </div>
  );
}
