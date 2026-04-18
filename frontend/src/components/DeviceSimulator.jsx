import { useState, useEffect } from 'react';

const DEVICES = [
    { name: 'iPhone 14', w: 390, h: 844, radius: 47, notch: 'dynamic' },
    { name: 'iPhone SE', w: 375, h: 667, radius: 40, notch: 'small' },
    { name: 'Galaxy S23', w: 393, h: 851, radius: 36, notch: 'punch' },
    { name: 'Pixel 7', w: 412, h: 892, radius: 28, notch: 'punch' },
];

function buildSimulatorStyles(device, scale) {
    return `
        body.__sim {
            background: #0d0d1a !important;
            background-image: radial-gradient(ellipse at 30% 20%, #1a1040 0%, transparent 60%),
                              radial-gradient(ellipse at 70% 80%, #0d1f3c 0%, transparent 60%) !important;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        body.__sim #root {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) scale(${scale}) !important;
            transform-origin: center center !important;
            width: ${device.w}px !important;
            height: ${device.h}px !important;
            overflow: hidden !important;
            border-radius: ${device.radius}px !important;
            box-shadow:
                0 0 0 2px #2a2a3a,
                0 0 0 10px #1a1a2e,
                0 0 0 12px #0a0a18,
                0 40px 80px rgba(0,0,0,0.8),
                inset 0 0 0 1px rgba(255,255,255,0.05) !important;
            z-index: 1 !important;
        }
    `;
}

function computeScale(device) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const padH = 140; // room for toggle button + margin
    const padV = 100;
    const scaleW = (vw - padH) / device.w;
    const scaleH = (vh - padV) / device.h;
    return Math.min(scaleW, scaleH, 1);
}

export default function DeviceSimulator() {
    if (!import.meta.env.DEV) return null;

    const [on, setOn] = useState(false);
    const [deviceIdx, setDeviceIdx] = useState(0);
    const [scale, setScale] = useState(1);
    const [showPicker, setShowPicker] = useState(false);

    const device = DEVICES[deviceIdx];

    useEffect(() => {
        if (!on) {
            document.body.classList.remove('__sim');
            const el = document.getElementById('__sim-styles');
            if (el) el.remove();
            return;
        }

        const s = computeScale(device);
        setScale(s);

        let styleEl = document.getElementById('__sim-styles');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = '__sim-styles';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = buildSimulatorStyles(device, s);
        document.body.classList.add('__sim');

        const onResize = () => {
            const ns = computeScale(device);
            setScale(ns);
            styleEl.textContent = buildSimulatorStyles(device, ns);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [on, deviceIdx]);

    useEffect(() => {
        return () => {
            document.body.classList.remove('__sim');
            const el = document.getElementById('__sim-styles');
            if (el) el.remove();
        };
    }, []);

    const toggleBtn = (
        <button
            onClick={() => setOn(v => !v)}
            title={on ? 'Exit simulator' : 'Mobile simulator'}
            style={{
                position: 'fixed',
                bottom: 16,
                left: 16,
                zIndex: 2147483647,
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: on ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.15)',
                background: on ? '#6366f1' : 'rgba(10,10,24,0.85)',
                backdropFilter: 'blur(8px)',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                boxShadow: on ? '0 0 0 4px rgba(99,102,241,0.3)' : '0 2px 8px rgba(0,0,0,0.5)',
                transition: 'all 0.2s ease',
                padding: 0,
            }}
        >
            📱
        </button>
    );

    if (!on) return toggleBtn;

    return (
        <>
            {toggleBtn}

            {/* Phone chrome overlay – pointer-events: none so app stays interactive */}
            <div style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) scale(${scale})`,
                transformOrigin: 'center center',
                width: device.w,
                height: device.h,
                borderRadius: device.radius,
                pointerEvents: 'none',
                zIndex: 2147483646,
            }}>
                {/* Notch / camera cutout */}
                {device.notch === 'dynamic' && (
                    <div style={{
                        position: 'absolute',
                        top: 12,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 120,
                        height: 36,
                        background: '#000',
                        borderRadius: 20,
                        zIndex: 10,
                    }} />
                )}
                {device.notch === 'punch' && (
                    <div style={{
                        position: 'absolute',
                        top: 14,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 12,
                        height: 12,
                        background: '#000',
                        borderRadius: '50%',
                        zIndex: 10,
                    }} />
                )}
                {device.notch === 'small' && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 80,
                        height: 20,
                        background: '#000',
                        borderRadius: '0 0 12px 12px',
                        zIndex: 10,
                    }} />
                )}

                {/* Status bar text */}
                <div style={{
                    position: 'absolute',
                    top: device.notch === 'dynamic' ? 16 : 8,
                    left: 24,
                    right: 24,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.85)',
                    zIndex: 9,
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    pointerEvents: 'none',
                }}>
                    <span>9:41</span>
                    <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span>●●●</span>
                        <span>WiFi</span>
                        <span>🔋</span>
                    </span>
                </div>

                {/* Home indicator */}
                <div style={{
                    position: 'absolute',
                    bottom: 8,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 120,
                    height: 5,
                    background: 'rgba(255,255,255,0.4)',
                    borderRadius: 3,
                    zIndex: 10,
                }} />

                {/* Side buttons (decorative) */}
                <div style={{
                    position: 'absolute',
                    right: -10,
                    top: 140,
                    width: 4,
                    height: 60,
                    background: '#1a1a2e',
                    borderRadius: '0 3px 3px 0',
                }} />
                <div style={{
                    position: 'absolute',
                    left: -10,
                    top: 120,
                    width: 4,
                    height: 36,
                    background: '#1a1a2e',
                    borderRadius: '3px 0 0 3px',
                }} />
                <div style={{
                    position: 'absolute',
                    left: -10,
                    top: 168,
                    width: 4,
                    height: 36,
                    background: '#1a1a2e',
                    borderRadius: '3px 0 0 3px',
                }} />
            </div>

            {/* Device info bar + picker */}
            <div style={{
                position: 'fixed',
                bottom: 16,
                left: 64,
                zIndex: 2147483647,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
            }}>
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowPicker(v => !v)}
                        style={{
                            background: 'rgba(10,10,24,0.9)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(99,102,241,0.4)',
                            borderRadius: 20,
                            color: 'rgba(255,255,255,0.9)',
                            padding: '6px 14px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        {device.name} · {device.w}×{device.h}
                        <span style={{ opacity: 0.6, fontSize: '0.65rem' }}>
                            {Math.round(scale * 100)}%
                        </span>
                        <span style={{ opacity: 0.5 }}>▾</span>
                    </button>

                    {showPicker && (
                        <div style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: 0,
                            marginBottom: 8,
                            background: 'rgba(10,10,24,0.95)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(99,102,241,0.3)',
                            borderRadius: 12,
                            overflow: 'hidden',
                            minWidth: 200,
                        }}>
                            {DEVICES.map((d, i) => (
                                <button
                                    key={d.name}
                                    onClick={() => { setDeviceIdx(i); setShowPicker(false); }}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '10px 14px',
                                        background: i === deviceIdx ? 'rgba(99,102,241,0.2)' : 'transparent',
                                        border: 'none',
                                        borderBottom: i < DEVICES.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                                        color: i === deviceIdx ? '#818cf8' : 'rgba(255,255,255,0.75)',
                                        cursor: 'pointer',
                                        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                                        fontSize: '0.78rem',
                                        fontWeight: i === deviceIdx ? 700 : 500,
                                        textAlign: 'left',
                                    }}
                                >
                                    <span>{d.name}</span>
                                    <span style={{ opacity: 0.5, fontSize: '0.68rem' }}>{d.w}×{d.h}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
