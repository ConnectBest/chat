"use client";

import { Button } from "@/components/ui/button";
import { useAuthActions } from '@convex-dev/auth/react';
import styles from './page.module.css';

export default function Home() {
  const { signOut } = useAuthActions();

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

      <Button onClick={() => signOut()}>
        Sign out!
      </Button>


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

        <div style={{ marginTop: '2rem', fontSize: '0.9rem', opacity: 0.7 }}>
          <a href="/api/health" target="_blank" style={{ color: 'inherit', textDecoration: 'underline' }}>
            System Health Check
          </a>
        </div>
      </div>
    </div>
  )
}
