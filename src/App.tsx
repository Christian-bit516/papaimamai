import { useState, useEffect } from 'react';
import './App.css';
import type { ProcessedLead } from './types';
import { MassivePrediction } from './components/MassivePrediction';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { ManualSimulation } from './components/ManualSimulation';
import { 
  Database, 
  PieChart as PieChartIcon, 
  Search, 
  Loader, 
  LayoutDashboard, 
  BookOpen,
  Zap
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

function App() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'massive' | 'manual'>('massive');
  const [dataset, setDataset] = useState<ProcessedLead[]>([]);
  const [isLoadingDB, setIsLoadingDB] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'leads'));
        const rawLeads: ProcessedLead[] = [];
        querySnapshot.forEach((doc) => {
          rawLeads.push(doc.data() as ProcessedLead);
        });

        if (rawLeads.length === 0) {
          setDataset([]);
          setIsLoadingDB(false);
          return;
        }

        // Re-calculate predictions with the current backend model
        // to ensure scores are always fresh and consistent
        try {
          const { calculatePurchaseProbability } = await import('./utils/predict');
          const csvLeads = rawLeads.map(l => ({
            id_user:              l.id_user,
            asistencia_webinars:  l.asistencia_webinars,
            clicks_bolsa_trabajo: l.clicks_bolsa_trabajo,
            situacion_laboral:    l.situacion_laboral,
            clicks_marketing:     l.clicks_marketing,
            profesion:            l.profesion,
          }));
          const freshPredictions = await calculatePurchaseProbability(csvLeads);
          if (freshPredictions.length === rawLeads.length) {
            const refreshed: ProcessedLead[] = rawLeads.map((lead, i) => ({
              ...lead,
              prediction: freshPredictions[i],
            }));
            setDataset(refreshed);
          } else {
            // Backend unavailable — use stored predictions as fallback
            setDataset(rawLeads);
          }
        } catch {
          // Backend unavailable — use stored predictions as fallback
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

  return (
    <div className="app-layout">
      {/* Sidebar */}
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

      {/* Main Content */}
      <main className="main-wrapper">
        <div className="header-top animate-fade-in">
          <h1>
            {activeTab === 'analytics' && 'Dashboard Overview'}
            {activeTab === 'massive' && 'Segments & Mass Upload'}
            {activeTab === 'manual' && 'Contact Simulation'}
          </h1>
        </div>

        {isLoadingDB ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', marginTop: '4rem' }}>
            <Loader className="animate-spin" size={48} color="var(--accent-orange)" />
            <p>Loading database...</p>
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
