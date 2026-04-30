import React, { useContext } from 'react';
import { Activity, Shield, HeartPulse, Activity as ActivityIcon, ArrowRight, Zap, Globe, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';
import '../index.css';

const HomePage = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <div style={{ overflowX: 'hidden' }}>
      {/* Hero Section */}
      <section style={{ 
        minHeight: '80vh', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        textAlign: 'center',
        padding: '100px 20px',
        position: 'relative'
      }}>
        {/* Background decorative elements */}
        <div style={{
          position: 'absolute', top: '10%', left: '10%', width: '300px', height: '300px',
          background: 'radial-gradient(circle, rgba(14,165,233,0.15) 0%, rgba(15,23,42,0) 70%)',
          borderRadius: '50%', zIndex: -1, animation: 'pulse 8s infinite alternate'
        }}></div>
        <div style={{
          position: 'absolute', bottom: '10%', right: '10%', width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(56,189,248,0.1) 0%, rgba(15,23,42,0) 70%)',
          borderRadius: '50%', zIndex: -1, animation: 'pulse 12s infinite alternate-reverse'
        }}></div>

        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid #334155', marginBottom: '30px', animation: 'float 6s ease-in-out infinite' }}>
          <Activity size={50} className="text-gradient" />
        </div>
        
        <h1 style={{ fontSize: '4rem', marginBottom: '20px', lineHeight: '1.1', maxWidth: '800px', fontWeight: '800' }}>
          The Future of <span className="text-gradient">Clinical Intelligence</span>
        </h1>
        
        <p style={{ fontSize: '1.3rem', color: '#94a3b8', maxWidth: '700px', margin: '0 auto 40px', lineHeight: '1.6' }}>
          CliniAura transforms hospital data into life-saving action. Edge AI analytics, predictive early warning systems, and automated medicolegal auditing built for the modern clinical environment.
        </p>

        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {user ? (
            <button onClick={() => navigate('/dashboard')} className="btn btn-primary" style={{ padding: '15px 40px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Enter System <ArrowRight size={20} />
            </button>
          ) : (
            <>
              <button onClick={() => navigate('/login')} className="btn btn-primary" style={{ padding: '15px 40px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                Access Portal <Lock size={20} />
              </button>
              <button onClick={() => {
                document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
              }} className="btn" style={{ padding: '15px 40px', fontSize: '1.1rem', background: 'transparent', border: '1px solid #38bdf8', color: '#38bdf8' }}>
                Explore Features
              </button>
            </>
          )}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" style={{ padding: '80px 20px', background: 'rgba(15, 23, 42, 0.4)', borderTop: '1px solid #1e293b' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '15px' }}>Enterprise-Grade Healthcare IT</h2>
            <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
              We provide the critical infrastructure required to monitor hemodynamics, manage alerts, and maintain compliance at scale.
            </p>
          </div>

          <div className="grid grid-cols-3" style={{ gap: '30px' }}>
            <div className="glass-panel hover-lift" style={{ padding: '30px', transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}>
              <div style={{ background: 'rgba(56, 189, 248, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <Zap size={24} color="#38bdf8" />
              </div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '10px' }}>Smart Alarm Orchestration</h3>
              <p style={{ color: '#94a3b8', lineHeight: '1.5' }}>
                Combat nurse fatigue with intelligent alarm clustering, automatic deduplication, and multi-tier escalation via Twilio integration.
              </p>
            </div>

            <div className="glass-panel hover-lift" style={{ padding: '30px', transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <Shield size={24} color="#10b981" />
              </div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '10px' }}>Immutable Audit Ledger</h3>
              <p style={{ color: '#94a3b8', lineHeight: '1.5' }}>
                Protect your practice with a tamper-evident, SHA-256 hash-chained ledger. Generate Board-ready PDF compliance reports instantly.
              </p>
            </div>

            <div className="glass-panel hover-lift" style={{ padding: '30px', transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}>
              <div style={{ background: 'rgba(139, 92, 246, 0.1)', width: '50px', height: '50px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <ActivityIcon size={24} color="#8b5cf6" />
              </div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '10px' }}>Multi-Patient Command</h3>
              <p style={{ color: '#94a3b8', lineHeight: '1.5' }}>
                Monitor the entire ward in real-time. Live sparkline charts, risk scoring, and prioritized alert queues built with Zustand & WebSockets.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Global CSS required for specific animations */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
          100% { transform: translateY(0px); }
        }
        @keyframes pulse {
          0% { opacity: 0.5; transform: scale(1); }
          100% { opacity: 1; transform: scale(1.1); }
        }
        .hover-lift:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
};

export default HomePage;
