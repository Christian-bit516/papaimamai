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
  Zap
} from 'lucide-react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';

function App() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'massive' | 'manual'>('massive');
  const [dataset, setDataset] = useState<ProcessedLead[]>([]);
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
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
  }, []);

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

          <div className="user-profile">
            <div className="avatar">JD</div>
            <div className="user-info">
              <h4>John Doe</h4>
              <p>My Account</p>
            </div>
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
