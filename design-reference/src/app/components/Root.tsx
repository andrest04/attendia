import { NavLink, Outlet } from 'react-router';

const screens = [
  { path: '/', label: 'S1 – Acceso' },
  { path: '/s2', label: 'S2 – Sala de espera' },
  { path: '/s3', label: 'S3 – Sesión Estudiante' },
  { path: '/s4', label: 'S4 – Sesión Docente' },
  { path: '/s5', label: 'S5 – Alerta Proctoring' },
  { path: '/s6', label: 'S6 – Reporte Atención' },
  { path: '/s7', label: 'S7 – Onboarding' },
  { path: '/s8', label: 'S8 – Seguridad y Privacidad' },
];

export function Root() {
  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col">
      {/* Top navigation bar */}
      <nav
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '2px solid #E0E0E0',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div className="flex items-center gap-0 overflow-x-auto">
          {/* Brand */}
          <div
            className="flex-shrink-0 px-4 py-2 border-r border-[#E0E0E0]"
            style={{ minWidth: 60 }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                backgroundColor: '#424242',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '10px', color: '#FFFFFF', fontWeight: 700 }}>P</span>
            </div>
          </div>

          {/* Screen tabs */}
          <div className="flex overflow-x-auto">
            {screens.map((screen) => (
              <NavLink
                key={screen.path}
                to={screen.path}
                end={screen.path === '/'}
                style={({ isActive }) => ({
                  padding: '10px 14px',
                  fontSize: '11px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#000000' : '#9E9E9E',
                  borderBottom: isActive ? '2px solid #424242' : '2px solid transparent',
                  whiteSpace: 'nowrap',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  backgroundColor: isActive ? '#F5F5F5' : 'transparent',
                  marginBottom: '-2px',
                })}
              >
                {screen.label}
              </NavLink>
            ))}
          </div>

          {/* Wireframe badge */}
          <div className="ml-auto px-4 flex-shrink-0">
            <span
              style={{
                fontSize: '9px',
                color: '#9E9E9E',
                border: '1px solid #E0E0E0',
                padding: '2px 6px',
                borderRadius: 3,
                letterSpacing: '0.05em',
              }}
            >
              MID-FIDELITY WIREFRAME · GRAYSCALE
            </span>
          </div>
        </div>
      </nav>

      {/* Screen content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
