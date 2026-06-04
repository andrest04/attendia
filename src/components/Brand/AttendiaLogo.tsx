import React from 'react';
import horizontalPng from '../../images/attendia-logo-horizontal.png';
import stackedPng from '../../images/attendia-logo-stacked.png';
import iconPng from '../../images/attendia-icon.png';

interface AttendiaLogoProps {
  /** Overall height of the logo in pixels. Width scales proportionally. */
  size?: number;
  /**
   * 'full'    — horizontal lockup: isotype + "attendia" wordmark (default)
   * 'stacked' — stacked lockup: isotype above wordmark + tagline "ATENCIÓN QUE CONECTA"
   * 'icon'    — isotype only: blue gradient ring + amber dot
   * 'white'   — for dark navy surfaces: isotype PNG + "attendia" wordmark as white Poppins text
   *             (no white-on-white PNG asset exists, so we compose icon + text in white)
   */
  variant?: 'full' | 'icon' | 'stacked' | 'white';
}

/**
 * Real attendia logo rendered from PNG assets.
 * Assets live in src/images/ and are mapped to a stub in Jest via moduleNameMapper.
 */
export default function AttendiaLogo({ size = 36, variant = 'full' }: AttendiaLogoProps) {
  if (variant === 'icon') {
    return (
      <img src={iconPng} alt="attendia" height={size} width={size} draggable={false} style={{ display: 'block' }} />
    );
  }

  if (variant === 'stacked') {
    // Stacked PNG is roughly square; let height drive both dimensions proportionally.
    return <img src={stackedPng} alt="attendia" height={size} draggable={false} style={{ display: 'block' }} />;
  }

  if (variant === 'white') {
    // No white PNG exists; compose icon (reads well on dark bg) + white Poppins wordmark.
    const iconHeight = size;
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: Math.round(size * 0.2),
        }}
      >
        <img
          src={iconPng}
          alt=""
          height={iconHeight}
          width={iconHeight}
          draggable={false}
          style={{ display: 'block' }}
          aria-hidden
        />
        <span
          style={{
            fontFamily: 'Poppins, Inter, sans-serif',
            fontWeight: 700,
            fontSize: Math.round(size * 0.56),
            color: '#ffffff',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
          }}
        >
          attendia
        </span>
      </span>
    );
  }

  // 'full': horizontal PNG — isotype + wordmark side by side.
  // The PNG is 1024 × ~230; height drives the proportional width.
  const aspectRatio = 1024 / 230;
  return (
    <img
      src={horizontalPng}
      alt="attendia"
      height={size}
      width={Math.round(size * aspectRatio)}
      draggable={false}
      style={{ display: 'block' }}
    />
  );
}
