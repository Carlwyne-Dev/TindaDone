import { Download, Smartphone, BarChart3, BookOpen, ShieldCheck, HelpCircle, Mail } from 'lucide-react';
import { motion, useScroll, useTransform, type Variants } from 'framer-motion';

function App() {
  const { scrollYProgress } = useScroll();
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 100]);
  
  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } }
  };

  return (
    <>
      <header className="header">
        <div className="container header-container">
          <div className="logo">
            <span className="glow-dot">●</span> TindaDone
          </div>
          <nav className="nav-links">
            <a href="#features">Features</a>
            <a href="#faq">FAQ</a>
            <a href="#contact">Contact</a>
          </nav>
          <motion.a 
            href="#download" 
            className="btn-primary get-apk-btn" 
            style={{ padding: '10px 20px', fontSize: '14px' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Get the APK
          </motion.a>
        </div>
      </header>

      <div className="container">

        <section className="hero">
          <motion.div className="hero-text" variants={container} initial="hidden" animate="show">
            <motion.h1 variants={item}>
              Your Sari-Sari Store, <br />Fully Digital.
            </motion.h1>
            <motion.p variants={item}>
              TindaDone is the ultimate offline-first Point of Sale & Inventory tracker designed specifically for micro-businesses. Throw away the messy notebooks.
            </motion.p>
            <motion.a 
              href="#download" 
              className="btn-primary"
              variants={item}
              whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(16, 185, 129, 0.6)' }}
              whileTap={{ scale: 0.95 }}
            >
              <Download size={22} />
              Download APK Now
            </motion.a>
          </motion.div>
        </section>

        <section id="features" className="features">
          <h2 className="sr-only">Key Features of TindaDone</h2>
          <motion.div className="feature-card" initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <div className="feature-icon"><Smartphone size={28} /></div>
            <h3>Scan & Sell</h3>
            <p style={{ color: 'var(--text-muted)' }}>Fast barcode scanning using your phone's camera. Process transactions in seconds.</p>
          </motion.div>
          <motion.div className="feature-card" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
            <div className="feature-icon"><BookOpen size={28} /></div>
            <h3>Utang Ledger</h3>
            <p style={{ color: 'var(--text-muted)' }}>Keep a clean, trust-based record of customer credits. Never lose an unpaid tab again.</p>
          </motion.div>
          <motion.div className="feature-card" initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }}>
            <div className="feature-icon"><BarChart3 size={28} /></div>
            <h3>Smart Analytics</h3>
            <p style={{ color: 'var(--text-muted)' }}>Get daily, monthly, and yearly insights on your revenue and net profit automatically.</p>
          </motion.div>
        </section>

        <section className="screenshots">
          <motion.h2 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>See it in action</motion.h2>
          <div className="screenshot-container">
            {/* Left Phone */}
            <motion.div 
              className="phone-mockup"
              style={{ y: y1 }}
              initial={{ rotateY: 15, rotateX: 10, scale: 0.9 }}
              whileHover={{ rotateY: 0, rotateX: 0, scale: 1, zIndex: 10 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <img src="/terminal.png" alt="POS Terminal" />
            </motion.div>

            {/* Center Phone */}
            <motion.div 
              className="phone-mockup"
              initial={{ y: -20, scale: 1.05 }}
              whileHover={{ scale: 1.1, zIndex: 10 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <img src="/analytics.png" alt="Analytics Dashboard" />
            </motion.div>

            {/* Right Phone */}
            <motion.div 
              className="phone-mockup"
              style={{ y: y2 }}
              initial={{ rotateY: -15, rotateX: 10, scale: 0.9 }}
              whileHover={{ rotateY: 0, rotateX: 0, scale: 1, zIndex: 10 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <img src="/credit.png" alt="Credit Trust Ledger" />
            </motion.div>
          </div>
        </section>
      </div>

      <section id="download" className="download-section">
        <div className="container">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }} 
            whileInView={{ opacity: 1, scale: 1 }} 
            viewport={{ once: true }}
            className="trial-badge"
          >
            7-Day Free Trial
          </motion.div>
          <motion.h2 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}>Ready to upgrade your store?</motion.h2>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.2 }} style={{ color: 'var(--text-muted)', fontSize: '18px', maxWidth: '600px', margin: '0 auto 40px' }}>
            Download the official TindaDone APK below. You get full access to all features completely free for 7 days. After the trial, simply purchase a permanent activation key to keep your data safe and unlock lifetime access.
          </motion.p>
          <motion.a 
            href="/tindadone.apk" 
            className="btn-primary" 
            download
            whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(16, 185, 129, 0.6)' }}
            whileTap={{ scale: 0.95 }}
          >
            <Download size={22} />
            Download TindaDone.apk
          </motion.a>
          <p style={{ marginTop: '24px', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-muted)' }}>
            <ShieldCheck size={18} color="#10b981" /> 100% Secure & Offline
          </p>
        </div>
      </section>

      <div className="container">
        <section id="faq" className="faq">
          <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            <HelpCircle size={36} color="#10b981" /> FAQ
          </h2>
          <motion.div className="faq-item" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h3>Is TindaDone completely offline?</h3>
            <p>Yes! TindaDone saves all your inventory and sales data directly on your device. You don't need an internet connection to run your store, making it fast and reliable.</p>
          </motion.div>
          <motion.div className="faq-item" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
            <h3>What happens after the 7-day trial?</h3>
            <p>Once your trial ends, your data is securely locked but never deleted. You just need to purchase a lifetime activation key. Once entered, all your records will instantly unlock and you can continue where you left off.</p>
          </motion.div>
          <motion.div className="faq-item" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }}>
            <h3>How do I activate the app?</h3>
            <p>After installing, you will see a unique "Device Code" on your screen. Send this code to our official Facebook page or contact email to purchase your Activation Key.</p>
          </motion.div>
        </section>

        <footer id="contact" className="footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={18} />
                <span>Need help? Contact us at</span>
              </div>
              <a href="mailto:magharicarlwyne@gmail.com" style={{ color: '#fff', fontWeight: 'bold' }}>magharicarlwyne@gmail.com</a>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Smartphone size={18} />
              <span>Call / Text:</span> <a href="tel:09304865506" style={{ color: '#fff', fontWeight: 'bold' }}>09304865506</a>
            </div>
            
            <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
              <a href="https://www.facebook.com/crlwyn" target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#10b981'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a href="https://www.instagram.com/crlwyn_/" target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#10b981'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
            </div>
          </div>
          <p style={{ marginTop: '32px', fontSize: '14px' }}>&copy; {new Date().getFullYear()} TindaDone. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
}

export default App;
