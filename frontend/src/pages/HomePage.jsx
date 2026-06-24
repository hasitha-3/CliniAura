import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../index.css';

const HomePage = () => {
  const navigate = useNavigate();
  const [vitalsData, setVitalsData] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('cliniaura_user');
    const user = storedUser ? JSON.parse(storedUser) : null;
    
    if (user && user.role === 'PATIENT') {
      const fetchLive = async () => {
        try {
          const res = await fetch('http://100.88.162.102:8000/dashboard/live');
          if (!res.ok) return;
          const data = await res.json();
          // Assuming user.patientId corresponds to the edge node ID, else fallback to 1049
          const pId = user.patientId || '1049'; 
          const myData = data.find(d => String(d.patient_id) === String(pId));
          if (myData) {
            setVitalsData({
              heartRate: myData.heart_rate,
              spO2: myData.spo2,
              bloodPressureSys: myData.systolic_bp,
              bloodPressureDia: myData.diastolic_bp,
              temperature: myData.temperature ? parseFloat(myData.temperature).toFixed(1) : 98.6
            });
          }
        } catch (e) { }
      };
      const intId = setInterval(fetchLive, 2000);
      return () => clearInterval(intId);
    }
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('cliniaura_user');
    const user = storedUser ? JSON.parse(storedUser) : null;
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), i * 80);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    const elements = document.querySelectorAll('.animate');
    elements.forEach(el => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, []);

  const scrollToSection = (e, id) => {
    e.preventDefault();
    const el = document.querySelector(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      {/* HERO */}
      <section className="hero" id="home">
        <div className="hero-bg">
          <div className="hero-grid"></div>
        </div>
        <div className="hero-content">
          <div className="hero-badge"><span className="dot"></span> IoT + Edge AI Healthcare</div>
          <h1>Smarter monitoring.<br/><em>Safer patients.</em></h1>
          <p>CliniAura is a state-of-the-art IoT and Edge-Based patient monitoring system that detects clinical deterioration before it becomes critical — enabling real-time, continuous care.</p>
          <div className="hero-actions">
            <a href="#contact" onClick={(e) => scrollToSection(e, '#contact')} className="btn-primary">
              Request a Demo <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
            </a>
            <a href="#solution" onClick={(e) => scrollToSection(e, '#solution')} className="btn-secondary">Learn More</a>
          </div>
          <div className="hero-stats">
            <div className="hero-stat"><div className="num">60%</div><div className="label">Warning signs missed</div></div>
            <div className="hero-stat"><div className="num">4–8h</div><div className="label">Between spot checks</div></div>
            <div className="hero-stat"><div className="num">1 in 10</div><div className="label">Patients harmed globally</div></div>
          </div>
        </div>

        {/* Floating monitor card (decorative / live data) */}
        {(() => {
          const storedUser = localStorage.getItem('cliniaura_user');
          const user = storedUser ? JSON.parse(storedUser) : null;
          return (!user || user?.role === 'PATIENT') && (
            <div className="hero-visual">
              <div className="monitor-card">
                <div className="monitor-card-header">
                  <span>Patient Vitals</span>
                  <div className="live">LIVE</div>
                </div>
                <div className="vitals-grid">
                  <div className="vital-item vital-hr">
                    <div className="vital-label">Heart Rate</div>
                    <div className="vital-value">{vitalsData?.heartRate || '-'}<span className="vital-unit">bpm</span></div>
                  </div>
                  <div className="vital-item vital-spo2">
                    <div className="vital-label">SpO2</div>
                    <div className="vital-value">{vitalsData?.spO2 || '-'}<span className="vital-unit">%</span></div>
                  </div>
                  <div className="vital-item vital-bp">
                    <div className="vital-label">Blood Pressure</div>
                    <div className="vital-value">{vitalsData ? `${vitalsData.bloodPressureSys}/${vitalsData.bloodPressureDia}` : '-/-'}</div>
                  </div>
                  <div className="vital-item vital-temp">
                    <div className="vital-label">Temperature</div>
                    <div className="vital-value">{vitalsData?.temperature || '-'} <span className="vital-unit">°F</span></div>
                  </div>
                </div>
                <div className="ai-alert">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#00d4aa" strokeWidth="1.5"><path d="M8 1v6M8 11h.01"/><circle cx="8" cy="8" r="7"/></svg>
                  <div className="ai-alert-text"><strong>AI Insight:</strong> {(vitalsData?.heartRate > 100) ? 'Elevated heart rate detected. Monitoring closely.' : 'Hemodynamic trend stable. No intervention predicted.'}</div>
                </div>
              </div>
            </div>
          );
        })()}

      </section>

      {/* PROBLEM */}
      <section className="problem" id="problem">
        <div className="section-label">The Problem</div>
        <div className="section-title">The "Spot-Check" monitoring gap <em>costs lives</em></div>
        <div className="problem-grid">
          <div className="problem-text animate">
            <p>In most hospitals worldwide, patient vitals are checked every 4–8 hours — leaving massive unmonitored windows where silent physiological decline goes unnoticed. By the time deterioration is detected, it's often too late for early intervention.</p>
            <p style={{ marginTop: '1rem' }}>Over 60% of critical events show warning signs that are missed. In India, 31% of post-operative complications require unplanned ICU admission, and the out-of-pocket burden for patients is catastrophically high.</p>
          </div>
          <div className="problem-cards animate">
            <div className="problem-card pc-red">
              <div className="icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01M4.93 4.93l14.14 14.14"/><circle cx="12" cy="12" r="10"/></svg>
              </div>
              <h4>Missed Warning Signs</h4>
              <p>Silent physiological decline between infrequent spot-checks goes undetected until crisis point.</p>
            </div>
            <div className="problem-card pc-amber">
              <div className="icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v10l4 4"/><circle cx="12" cy="12" r="10"/></svg>
              </div>
              <h4>Late Intervention</h4>
              <p>20–30% increase in hospital mortality is associated with delayed recognition of deterioration.</p>
            </div>
            <div className="problem-card pc-blue">
              <div className="icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
              </div>
              <h4>Alarm Fatigue</h4>
              <p>Threshold-based systems generate excessive false alarms, leading clinical staff to ignore critical alerts.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how" id="solution">
        <div className="section-label">How It Works</div>
        <div className="section-title">Edge AI that <em>anticipates</em>, not just monitors</div>
        <div className="how-steps">
          <div className="how-step animate">
            <div className="step-num">01</div>
            <h4>Wearable Sensors</h4>
            <p>Contact-based IoT sensors continuously capture vital data at the bedside — heart rate, SpO2, blood pressure, temperature, and more.</p>
            <div className="how-connector"></div>
          </div>
          <div className="how-step animate">
            <div className="step-num">02</div>
            <h4>Edge AI Processing</h4>
            <p>On-device multimodal AI models analyse physiological patterns in real-time — no cloud dependency, no latency, full privacy.</p>
            <div className="how-connector"></div>
          </div>
          <div className="how-step animate">
            <div className="step-num">03</div>
            <h4>Predictive Alerts</h4>
            <p>Context-aware AI alerts predict intervention needs and prioritise events — eliminating false alarm fatigue for clinicians.</p>
            <div className="how-connector"></div>
          </div>
          <div className="how-step animate">
            <div className="step-num">04</div>
            <h4>Treatment Auditing</h4>
            <p>Compares patient state with expected protocols, detects incorrect or delayed interventions, and identifies therapy inefficiency.</p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features" id="technology">
        <div className="section-label">Core Capabilities</div>
        <div className="section-title">Built for hospitals that <em>never sleep</em></div>
        <div className="features-grid">
          <div className="feature-card animate">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            </div>
            <h4>Edge-Native Intelligence</h4>
            <p>All processing happens on the bedside device. No cloud dependency means zero-latency alerts and uncompromised data privacy.</p>
          </div>
          <div className="feature-card animate">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <h4>Continuous Monitoring</h4>
            <p>24/7 real-time vital sign tracking replaces intermittent spot-checks — capturing every critical physiological change.</p>
          </div>
          <div className="feature-card animate">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h4>HIPAA &amp; CDSCO Compliant</h4>
            <p>Full regulatory compliance for both international and Indian healthcare standards, ensuring secure and lawful data handling.</p>
          </div>
          <div className="feature-card animate">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <h4>Event Prediction</h4>
            <p>AI models identify subtle time-linked patterns preceding deterioration — giving clinicians hours of advance warning.</p>
          </div>
          <div className="feature-card animate">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
            </div>
            <h4>Treatment Auditing</h4>
            <p>Automatically compares patient state with expected protocols to detect incorrect, delayed, or inefficient therapy interventions.</p>
          </div>
          <div className="feature-card animate">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01"/></svg>
            </div>
            <h4>Low-Connectivity Ready</h4>
            <p>Offline-first architecture works in low-bandwidth environments with optional cloud sync — ideal for resource-constrained settings.</p>
          </div>
        </div>
      </section>

      {/* DEEP HARDWARE & MULTIMODAL INTEGRATION */}
      <section className="features" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="section-label">Hardware Architecture</div>
        <div className="section-title">Multimodal Bedside System <em>(MBS)</em></div>
        <p style={{ maxWidth: '800px', margin: '0 auto 3rem auto', textAlign: 'center', color: 'var(--text-dim)' }}>
          Integrating FDA-cleared and CDSCO-compliant continuous wearable biosensors directly into high-performance embedded bedside units for uncompromised hemodynamic surveillance.
        </p>
        
        <div className="grid grid-cols-2 animate" style={{ gap: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
          <div className="glass-panel" style={{ background: 'rgba(0, 212, 170, 0.03)', border: '1px solid rgba(0, 212, 170, 0.15)' }}>
            <h4 style={{ color: 'var(--teal)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              Continuous Multi-Parameter Telemetry
            </h4>
            <p style={{ fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1rem' }}>
              Unlike standard manual spot-check workflows, CliniAura leverages contact-based continuous biosensors (e.g. VitalPatch architecture) attached to the patient's chest.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              <li style={{ marginBottom: '8px' }}><strong>• Core Vital Streams:</strong> Continuous Heart Rate (HR), Respiration Rate (RR), and core body temp.</li>
              <li style={{ marginBottom: '8px' }}><strong>• Advanced Metrics:</strong> Heart Rate Variability (HRV) tracking autonomous nerve stress.</li>
              <li style={{ marginBottom: '8px' }}><strong>• Physical Context:</strong> Automatic Body Posture logging and instant Fall Detection.</li>
            </ul>
          </div>

          <div className="glass-panel" style={{ background: 'rgba(0, 194, 224, 0.03)', border: '1px solid rgba(0, 194, 224, 0.15)' }}>
            <h4 style={{ color: 'var(--cyan)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Predictive Early Warning Horizon
            </h4>
            <p style={{ fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1rem' }}>
              Embedded bedside units calculate the <strong>Modified Early Warning Score (MEWS)</strong> and multi-parameter <strong>Hemodynamic Stability Indices</strong> in absolute real-time.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              <li style={{ marginBottom: '8px' }}><strong>• 4–6 Hour Lead Time:</strong> Identifies silent physiological compensation hours before vital collapse.</li>
              <li style={{ marginBottom: '8px' }}><strong>• Sepsis Resuscitation Bundles:</strong> Proactively audits MAP and Stroke Volume trends.</li>
              <li style={{ marginBottom: '8px' }}><strong>• ICU Burden Reduction:</strong> Early therapeutic alerts drastically lower emergency transfers.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="comparison">
        <div style={{ textAlign: 'center' }}>
          <div className="section-label">Why CliniAura</div>
          <div className="section-title" style={{ margin: '0 auto' }}><em>Rethinking</em> patient monitoring</div>
        </div>
        <div className="comp-table animate">
          <div className="comp-header">
            <div>Capability</div>
            <div>Existing Systems</div>
            <div>CliniAura Approach</div>
          </div>
          <div className="comp-row">
            <div>Architecture</div>
            <div><svg className="comp-icon" viewBox="0 0 18 18" fill="none" stroke="#ff4d6a" strokeWidth="2"><path d="M4 14L14 4M14 14L4 4"/></svg> Centralised, cloud-dependent</div>
            <div><svg className="comp-icon" viewBox="0 0 18 18" fill="none" stroke="#00d4aa" strokeWidth="2"><path d="M3 9l4 4 8-8"/></svg> Edge-native intelligence</div>
          </div>
          <div className="comp-row">
            <div>Alerting</div>
            <div><svg className="comp-icon" viewBox="0 0 18 18" fill="none" stroke="#ff4d6a" strokeWidth="2"><path d="M4 14L14 4M14 14L4 4"/></svg> Threshold-based alarms</div>
            <div><svg className="comp-icon" viewBox="0 0 18 18" fill="none" stroke="#00d4aa" strokeWidth="2"><path d="M3 9l4 4 8-8"/></svg> Context-aware AI alerts</div>
          </div>
          <div className="comp-row">
            <div>Alarm Quality</div>
            <div><svg className="comp-icon" viewBox="0 0 18 18" fill="none" stroke="#ff4d6a" strokeWidth="2"><path d="M4 14L14 4M14 14L4 4"/></svg> High false alarm fatigue</div>
            <div><svg className="comp-icon" viewBox="0 0 18 18" fill="none" stroke="#00d4aa" strokeWidth="2"><path d="M3 9l4 4 8-8"/></svg> Event prediction &amp; prioritisation</div>
          </div>
          <div className="comp-row">
            <div>Monitoring</div>
            <div><svg className="comp-icon" viewBox="0 0 18 18" fill="none" stroke="#ff4d6a" strokeWidth="2"><path d="M4 14L14 4M14 14L4 4"/></svg> Passive monitoring</div>
            <div><svg className="comp-icon" viewBox="0 0 18 18" fill="none" stroke="#00d4aa" strokeWidth="2"><path d="M3 9l4 4 8-8"/></svg> Actionable clinical insights</div>
          </div>
          <div className="comp-row">
            <div>Connectivity</div>
            <div><svg className="comp-icon" viewBox="0 0 18 18" fill="none" stroke="#ff4d6a" strokeWidth="2"><path d="M4 14L14 4M14 14L4 4"/></svg> Requires high bandwidth</div>
            <div><svg className="comp-icon" viewBox="0 0 18 18" fill="none" stroke="#00d4aa" strokeWidth="2"><path d="M3 9l4 4 8-8"/></svg> Works in low-connectivity</div>
          </div>
        </div>
      </section>

      {/* COMPANY BACKGROUND */}
      <section className="company-info" style={{ background: 'var(--surface2)', padding: '5rem 3rem', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <div className="section-label">Institutional Roots</div>
          <div className="section-title" style={{ margin: '0 auto 1.5rem auto' }}>About <em>CliniAura</em></div>
          <p style={{ fontSize: '1.1rem', color: 'var(--text)', lineHeight: '1.8', marginBottom: '2rem' }}>
            CliniAura is a deep-tech healthcare enterprise founded with a singular mission: to eliminate the catastrophic 4-to-8 hour "spot-check" blindspots that compromise patient safety in hospitals globally.
          </p>
          
          <div className="grid grid-cols-3 animate" style={{ gap: '1.5rem', textAlign: 'left', marginTop: '2.5rem' }}>
            <div className="glass-panel" style={{ background: 'var(--surface)', padding: '1.5rem' }}>
              <h4 style={{ color: 'var(--teal)', marginBottom: '0.5rem', fontSize: '1.05rem' }}>Incubated Deep-Tech</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: '1.6' }}>
                Grounded in world-class academic research, CliniAura leverages embedded engineering frameworks backed by the <strong>Center for VLSI and Embedded Systems Technologies (CVEST)</strong> and the <strong>Center for Security, Theory and Algorithmic Research (CSTAR/CSG)</strong> at <strong>IIIT-Hyderabad</strong>.
              </p>
            </div>
            <div className="glass-panel" style={{ background: 'var(--surface)', padding: '1.5rem' }}>
              <h4 style={{ color: 'var(--cyan)', marginBottom: '0.5rem', fontSize: '1.05rem' }}>Clinical Synergy</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: '1.6' }}>
                Engineered in direct partnership with leading clinical department heads from institutions like <strong>Gandhi Medical College</strong> and <strong>AIG Hospitals</strong>, guaranteeing our Edge AI workflows map flawlessly to complex acute-care thermodynamics.
              </p>
            </div>
            <div className="glass-panel" style={{ background: 'var(--surface)', padding: '1.5rem' }}>
              <h4 style={{ color: 'var(--teal-dim)', marginBottom: '0.5rem', fontSize: '1.05rem' }}>Resource Optimization</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: '1.6' }}>
                Designed specifically for resource-constrained multi-ward setups. By catching subtle decompensation early, we target substantial out-of-pocket savings for patients by averting emergency ICU admissions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TEAM */}
      <section className="team" id="team">
        <div style={{ textAlign: 'center' }}>
          <div className="section-label">The Team</div>
          <div className="section-title" style={{ margin: '0 auto' }}>Doctors, researchers &amp; <em>engineers united</em></div>
        </div>
        <div className="team-grid">
          <div className="team-card animate">
            <div className="team-avatar">JV</div>
            <h4>Dr Jayathi Vasala</h4>
            <div className="role">Founder &amp; CEO</div>
            <div className="affiliation">CliniAura</div>
          </div>
          <div className="team-card animate">
            <div className="team-avatar">AV</div>
            <h4>Dr Anjaneyulu Vasala</h4>
            <div className="role">Clinical Lead</div>
            <div className="affiliation">HOD, Gandhi Medical College</div>
          </div>
          <div className="team-card animate">
            <div className="team-avatar">PS</div>
            <h4>Dr Priyesh Shukla</h4>
            <div className="role">AI Research Lead</div>
            <div className="affiliation">Asst Professor, CVEST &amp; CSG, IIIT-H</div>
          </div>
          <div className="team-card animate">
            <div className="team-avatar">ST</div>
            <h4>Dr Sai Tarun V</h4>
            <div className="role">Clinical Advisor</div>
            <div className="affiliation">Senior Gastro Surgeon, AIG</div>
          </div>
          <div className="team-card animate">
            <div className="team-avatar">VK</div>
            <h4>Dr Vishal Karungulam</h4>
            <div className="role">Strategy Advisor</div>
            <div className="affiliation">Asst Professor, ISB</div>
          </div>
          <div className="team-card animate">
            <div className="team-avatar">RL</div>
            <h4>Prof Ramesh Loganathan</h4>
            <div className="role">Technology Advisor</div>
            <div className="affiliation">IIIT-Hyderabad</div>
          </div>
        </div>
      </section>

      {/* REVENUE MODEL */}
      <section className="revenue">
        <div style={{ textAlign: 'center' }}>
          <div className="section-label">Business Model</div>
          <div className="section-title" style={{ margin: '0 auto' }}>Multiple <em>revenue streams</em></div>
        </div>
        <div className="revenue-grid">
          <div className="revenue-card rev-1 animate">
            <div className="rev-icon">🏥</div>
            <h4>B2B SaaS Licensing</h4>
            <p>Monthly and annual licenses for hospitals and nursing homes, with tiered pricing based on bed strength.</p>
          </div>
          <div className="revenue-card rev-2 animate">
            <div className="rev-icon">🏢</div>
            <h4>Enterprise Subscriptions</h4>
            <p>Corporate hospital chains with custom dashboards, deep integrations, and analytics tailored to their network.</p>
          </div>
          <div className="revenue-card rev-3 animate">
            <div className="rev-icon">👤</div>
            <h4>Per-Patient Monitoring</h4>
            <p>Remote monitoring and AI alerts — ideal for elderly care and chronic disease programmes.</p>
          </div>
        </div>
      </section>



      {/* VISION QUOTE */}
      <section className="vision">
        <div className="section-label">Our Vision</div>
        <div className="vision-quote animate">
          "CliniAura is not just a platform — it's a <span>living hospital intelligence system</span>. We integrate edge-based AI, IoT sensors and clinical insights to create real-time, adaptive hospital environments that listen, learn and respond."
        </div>
        <div className="vision-attr">— The CliniAura Team</div>
      </section>

      {/* CTA */}
      <section className="cta" id="contact">
        <h2>Ready to transform patient monitoring?</h2>
        <p>Join the hospitals already moving beyond spot-check medicine. Let's talk about bringing CliniAura to your wards.</p>
        <a href="mailto:hello@clini-aura.com" className="btn-primary">
          Contact Us <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
        </a>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-left">
          <div className="flogo">
            <svg viewBox="0 0 40 40" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 2C10.06 2 2 10.06 2 20s8.06 18 18 18 18-8.06 18-18S29.94 2 20 2z" stroke="#00d4aa" strokeWidth="2" fill="none"/>
              <circle cx="20" cy="20" r="2.5" fill="#00d4aa"/>
            </svg>
            CliniAura
          </div>
          <p>State-of-the-Art IoT + Edge-Based Patient Monitoring System. Empowering early detection without cloud reliance.</p>
        </div>
        <div className="footer-links">
          <div className="footer-col">
            <h5>Product</h5>
            <a href="#solution" onClick={(e) => scrollToSection(e, '#solution')}>How It Works</a>
            <a href="#technology" onClick={(e) => scrollToSection(e, '#technology')}>Technology</a>
          </div>
          <div className="footer-col">
            <h5>Company</h5>
            <a href="#team" onClick={(e) => scrollToSection(e, '#team')}>Team</a>
            <a href="#contact" onClick={(e) => scrollToSection(e, '#contact')}>Contact</a>
            <a href="/">Careers</a>
          </div>
          <div className="footer-col">
            <h5>Connect</h5>
            <a href="https://linkedin.com/company/cliniaura" target="_blank" rel="noreferrer">LinkedIn</a>
            <a href="https://twitter.com/cliniaura" target="_blank" rel="noreferrer">Twitter</a>
            <a href="mailto:hello@clini-aura.com">hello@clini-aura.com</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; 2026 CliniAura. All rights reserved.</span>
          <div className="compliance">
            <span>HIPAA</span>
            <span>CDSCO</span>
            <span>ISO 13485</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
