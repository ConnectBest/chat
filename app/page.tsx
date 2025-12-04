<<<<<<< HEAD
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import Link from 'next/link';
=======
import styles from './page.module.css'
import Link from 'next/link'
>>>>>>> 399e8d1b7b8b74bbff8cb0637d760c3feae65df8

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
      // Redirect to chat if logged in
      router.push('/chat');
    }
  }, [router]);

  return (
    <div className={styles.particles}>
      <div className={styles.particle}></div>
      <div className={styles.particle}></div>
      <div className={styles.particle}></div>
      <div className={styles.particle}></div>
      <div className={styles.particle}></div>
      <div className={styles.particle}></div>
      <div className={styles.particle}></div>
      <div className={styles.particle}></div>
      <div className={styles.particle}></div>

      <div className={styles.container}>
        <div className={styles.logo}>🧠✨</div>
        <h1 className={styles.title}>ConnectBest</h1>
        <p className={styles.tagline}>Where Teams Connect, Collaborate & Create</p>

        <div className={styles.features}>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>💬</div>
            <div className={styles.featureText}>Real-time Chat</div>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>👥</div>
            <div className={styles.featureText}>Team Channels</div>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🚀</div>
            <div className={styles.featureText}>Seamless Integration</div>
          </div>
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
<<<<<<< HEAD
          <Link 
            href="/login" 
            style={{
              padding: '0.75rem 2rem',
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              color: 'white',
              textDecoration: 'none',
              fontWeight: '500',
              transition: 'all 0.3s',
            }}
          >
            Login
          </Link>
          <Link 
            href="/register" 
            style={{
              padding: '0.75rem 2rem',
              background: 'white',
              border: '1px solid white',
              borderRadius: '8px',
              color: '#6366f1',
              textDecoration: 'none',
              fontWeight: '500',
              transition: 'all 0.3s',
            }}
          >
            Register
=======
          <Link
            href="/chat"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '12px 32px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '1rem',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
          >
            Start Chatting
>>>>>>> 399e8d1b7b8b74bbff8cb0637d760c3feae65df8
          </Link>
        </div>

        <div style={{ marginTop: '2rem', fontSize: '0.9rem', opacity: 0.7 }}>
          <a href="/api/health" target="_blank" style={{ color: 'inherit', textDecoration: 'underline' }}>
            System Health Check
          </a>
        </div>
      </div>
    </div>
  );
}
