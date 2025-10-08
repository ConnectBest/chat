import styles from './page.module.css'

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
        <div className={styles.comingSoon}>Coming Soon</div>

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
      </div>
    </div>
  )
}
