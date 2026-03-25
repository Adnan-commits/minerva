import { Link, useLocation, useNavigate } from "react-router-dom";

const OwlIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="28" height="28" rx="6" fill="#00d4aa"/>
    {/* Body */}
    <ellipse cx="14" cy="16" rx="7" ry="8" fill="#0a0f1e"/>
    {/* Head */}
    <ellipse cx="14" cy="10" rx="6" ry="5.5" fill="#0a0f1e"/>
    {/* Ears */}
    <polygon points="9,6 10.5,9 8,9" fill="#0a0f1e"/>
    <polygon points="19,6 17.5,9 20,9" fill="#0a0f1e"/>
    {/* Left eye */}
    <circle cx="11.5" cy="10" r="2.2" fill="#00d4aa"/>
    <circle cx="11.5" cy="10" r="1.1" fill="#0a0f1e"/>
    {/* Right eye */}
    <circle cx="16.5" cy="10" r="2.2" fill="#00d4aa"/>
    <circle cx="16.5" cy="10" r="1.1" fill="#0a0f1e"/>
    {/* Beak */}
    <polygon points="14,11.5 12.8,13 15.2,13" fill="#00d4aa"/>
    {/* Wings */}
    <ellipse cx="8" cy="16" rx="2.5" ry="4" fill="#0d1424"/>
    <ellipse cx="20" cy="16" rx="2.5" ry="4" fill="#0d1424"/>
    {/* Feet */}
    <line x1="12" y1="23" x2="11" y2="25" stroke="#00d4aa" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="12" y1="23" x2="12" y2="25.5" stroke="#00d4aa" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="12" y1="23" x2="13" y2="25" stroke="#00d4aa" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="16" y1="23" x2="15" y2="25" stroke="#00d4aa" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="16" y1="23" x2="16" y2="25.5" stroke="#00d4aa" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="16" y1="23" x2="17" y2="25" stroke="#00d4aa" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("minerva_token");
    localStorage.removeItem("minerva_user");
    navigate("/login");
  };

  const links = [
    { path: "/welcome", label: "Welcome" },
    { path: "/capabilities", label: "Capabilities" },
    { path: "/", label: "Research" },
    { path: "/dashboard", label: "Dashboard" },
    
  ];

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b"
      style={{ backgroundColor: '#0d1424', borderColor: '#1e2d40' }}
    >
      <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <OwlIcon />
          <span
            className="font-semibold text-sm tracking-widest uppercase"
            style={{ color: '#e2e8f0', letterSpacing: '0.15em' }}
          >
            Minerva
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded font-mono"
            style={{ backgroundColor: '#1e2d40', color: '#00d4aa' }}
          >
            v1.0
          </span>
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors"
              style={{
                backgroundColor: location.pathname === link.path ? '#1e2d40' : 'transparent',
                color: location.pathname === link.path ? '#00d4aa' : '#64748b',
              }}
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors ml-2"
            style={{ borderColor: '#1e2d40', color: '#ef4444', border: '1px solid #1e2d40' }}
          >
            Logout
          </button>
        </div>

      </div>
    </nav>
  );
}