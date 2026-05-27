import { useState, useEffect } from 'react';
import './App.css';
import type { ProcessedLead } from './types';
import { MassivePrediction } from './components/MassivePrediction';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { ManualSimulation } from './components/ManualSimulation';
import { 
  Database, 
  Menu,
  Trash2,
  Search, 
  Loader, 
  LayoutDashboard, 
  Zap,
  LogOut
} from 'lucide-react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { Login } from './components/Login';


function App() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'massive' | 'manual'>('massive');
  const [dataset, setDataset] = useState<ProcessedLead[]>([]);
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const storedUser = sessionStorage.getItem('capacitaia_session');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Error parsing stored session", e);
      }
    }
    setCheckingAuth(false);
  }, []);

  useEffect(() => {
    if (!user) {
      setDataset([]);
      setIsLoadingDB(false);
      return;
    }

    const fetchLeads = async () => {
      setIsLoadingDB(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'leads'));
        const rawLeads: ProcessedLead[] = [];
        querySnapshot.forEach((document) => {
          rawLeads.push(document.data() as ProcessedLead);
        });

        if (rawLeads.length === 0) {
          setDataset([]);
          setIsLoadingDB(false);
          return;
        }

        try {
          const { calculatePurchaseProbability } = await import('./utils/predict');
          const csvLeads = rawLeads.map(l => ({
            id_user:              l.id_user,
            asistencia_webinars:  l.asistencia_webinars,
            clicks_bolsa_trabajo: l.clicks_bolsa_trabajo,
            situacion_laboral:    l.situacion_laboral,
            clicks_marketing:     l.clicks_marketing,
            profesion:            l.profesion,
            recencia_interaccion: l.recencia_interaccion,
            cliente_antiguo:      l.cliente_antiguo,
            ubicacion_region:     l.ubicacion_region,
            tipo_entidad_interes: l.tipo_entidad_interes,
            estado_postulacion_historica: l.estado_postulacion_historica,
          }));
          const freshPredictions = await calculatePurchaseProbability(csvLeads);
          if (freshPredictions.length === rawLeads.length) {
            const refreshed: ProcessedLead[] = rawLeads.map((lead, i) => ({
              ...lead,
              prediction: freshPredictions[i],
            }));
            setDataset(refreshed);
          } else {
            setDataset(rawLeads);
          }
        } catch {
          setDataset(rawLeads);
        }
      } catch (error) {
        console.error("Error fetching from Firebase:", error);
      } finally {
        setIsLoadingDB(false);
      }
    };
    fetchLeads();
  }, [user]);

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('capacitaia_session');
  };


  const clearDatabase = async () => {
    if (confirm("¿Estás seguro de que quieres borrar TODOS los leads de la base de datos? Esta acción no se puede deshacer.")) {
      setIsLoadingDB(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'leads'));
        const promises: Promise<void>[] = [];
        querySnapshot.forEach((document) => {
          promises.push(deleteDoc(doc(db, 'leads', document.id)));
        });
        await Promise.all(promises);
        setDataset([]);
      } catch (error) {
        console.error("Error deleting from Firebase:", error);
      } finally {
        setIsLoadingDB(false);
      }
    }
  };

  if (checkingAuth) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--main-bg)',
        color: 'var(--text-muted)',
        gap: '1rem'
      }}>
        <Loader className="animate-spin" size={48} color="var(--accent-orange)" />
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem' }}>Inicializando CapacitaIA...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Login
        onLoginSuccess={(userData) => {
          setUser(userData);
          sessionStorage.setItem('capacitaia_session', JSON.stringify(userData));
        }}
      />
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      {isSidebarOpen && (
        <aside className="sidebar animate-fade-in">
          <div className="logo-container">
            <div className="logo-icon">
              <Zap size={14} color="white" fill="white" />
            </div>
            CapacitaIA
          </div>

          <nav className="nav-links">
            <button 
              className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </button>

            <button 
              className={`nav-item ${activeTab === 'massive' ? 'active' : ''}`}
              onClick={() => setActiveTab('massive')}
            >
              <Database size={18} />
              Predicción Masiva
            </button>
            
            <button 
              className={`nav-item ${activeTab === 'manual' ? 'active' : ''}`}
              onClick={() => setActiveTab('manual')}
            >
              <Search size={18} />
              Simulador Individual
            </button>
          </nav>

          <div className="user-profile" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div className="avatar">
                {user.email ? user.email.substring(0, 2).toUpperCase() : 'U'}
              </div>
              <div className="user-info" style={{ minWidth: 0 }}>
                <h4 style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {user.isDemo ? 'Usuario Demo' : user.email.split('@')[0]}
                </h4>
                <p style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {user.email}
                </p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              style={{
                width: '100%',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                padding: '6px 12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
            >
              <LogOut size={14} />
              Cerrar Sesión
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="main-wrapper">
        <div className="header-top animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '6px', borderRadius: '6px', transition: 'background 0.2s' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseOut={e => e.currentTarget.style.background = 'none'}
              title={isSidebarOpen ? "Ocultar menú" : "Mostrar menú"}
            >
              <Menu size={22} />
            </button>
            <h1>
              {activeTab === 'analytics' && 'Dashboard Overview'}
              {activeTab === 'massive' && 'Segments & Mass Upload'}
              {activeTab === 'manual' && 'Contact Simulation'}
            </h1>
          </div>
          
          <button 
            onClick={clearDatabase} 
            style={{ 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.3)', 
              color: '#ef4444', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              cursor: 'pointer', 
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
          >
            <Trash2 size={16} />
            Borrar Datos
          </button>
        </div>

        {isLoadingDB ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', marginTop: '4rem' }}>
            <Loader className="animate-spin" size={48} color="var(--accent-orange)" />
            <p>Procesando datos...</p>
          </div>
        ) : (
          <>
            {activeTab === 'analytics' && <AnalyticsCharts data={dataset} />}
            {activeTab === 'massive' && <MassivePrediction data={dataset} setData={setDataset} />}
            {activeTab === 'manual' && <ManualSimulation />}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
