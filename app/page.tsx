import styles from './page.module.css'
import Link from 'next/link'

export default function Home() {
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
          <Link
            href="/chat/general"
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
          </Link>
        </div>

        <div style={{ marginTop: '2rem', fontSize: '0.9rem', opacity: 0.7 }}>
          <a href="/api/health" target="_blank" style={{ color: 'inherit', textDecoration: 'underline' }}>
            System Health Check
          </a>
        </div>
      </div>
    </div>
  )
}
