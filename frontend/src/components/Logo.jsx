import React from 'react';

/**
 * PayrollPro Logo Component
 * Inspired by the bold blue + orange corporate identity style.
 *
 * Props:
 *  - lang: 'ar' | 'en'  (controls which label text to show)
 *  - size: 'sm' | 'md' | 'lg'  (controls overall scale)
 *  - className: extra CSS classes
 */
const Logo = ({ lang = 'en', size = 'md', className = '' }) => {
  const scales = { sm: 0.65, md: 1, lg: 1.4 };
  const scale = scales[size] || 1;

  const appName  = lang === 'ar' ? 'بيرول برو' : 'PayrollPro';
  const subLabel = lang === 'ar' ? 'نظام رواتب احترافي' : 'Payroll Management';

  return (
    <div
      className={`inline-flex items-center gap-0 select-none ${className}`}
      style={{ transform: `scale(${scale})`, transformOrigin: 'left center' }}
      aria-label={appName}
    >
      {/* ── Left blue circle with "P" ── */}
      <svg
        width="44"
        height="44"
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="22" cy="22" r="22" fill="#1565C0" />
        {/* Bold rounded P letterform */}
        <text
          x="22"
          y="30"
          textAnchor="middle"
          fill="white"
          fontSize="24"
          fontWeight="800"
          fontFamily="'Inter','Segoe UI',sans-serif"
          letterSpacing="-1"
        >
          P
        </text>
      </svg>

      {/* ── Orange accent divider dot ── */}
      <svg
        width="14"
        height="44"
        viewBox="0 0 14 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ margin: '0 2px' }}
      >
        <circle cx="7" cy="22" r="7" fill="#F5A623" />
      </svg>

      {/* ── Text block ── */}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <span
          style={{
            fontFamily: "'Inter','Segoe UI',sans-serif",
            fontWeight: 800,
            fontSize: '1.15rem',
            color: '#1565C0',
            letterSpacing: lang === 'ar' ? '0.02em' : '-0.03em',
            direction: lang === 'ar' ? 'rtl' : 'ltr',
          }}
        >
          {appName}
        </span>
        <span
          style={{
            fontFamily: "'Inter','Segoe UI',sans-serif",
            fontWeight: 400,
            fontSize: '0.6rem',
            color: '#F5A623',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            direction: lang === 'ar' ? 'rtl' : 'ltr',
          }}
        >
          {subLabel}
        </span>
      </div>
    </div>
  );
};

export default Logo;
