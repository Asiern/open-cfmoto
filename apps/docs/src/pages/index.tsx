import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

import styles from './index.module.css';

type Card = {
  title: string;
  description: string;
  to: string;
};

const cards: Card[] = [
  {
    title: 'Reverse Engineering Findings',
    description:
      'APK-derived BLE findings, packet structures, commands, GATT mapping, and control code evidence.',
    to: '/findings/ble-protocol',
  },
  {
    title: 'Packages Documentation',
    description:
      'Implementation docs for ble-protocol, cloud-client, and mobile app architecture.',
    to: '/packages',
  },
  {
    title: 'Project Notes',
    description: 'Audit notes, test coverage snapshots, hardware validation logs, and protocol guides.',
    to: '/project/protocol',
  },
];

function Home(): JSX.Element {
  return (
    <Layout
      title="Docs"
      description="open-cfmoto documentation for reverse engineering findings and package docs"
    >
      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.kicker}>open-cfmoto documentation</p>
          <h1>Build, verify, and document the protocol in one place.</h1>
          <p className={styles.subtitle}>
            This docs site consolidates reverse engineering evidence and implementation details for the
            monorepo packages.
          </p>
        </section>
        <section className={styles.grid}>
          {cards.map((card) => (
            <Link key={card.title} className={clsx(styles.card)} to={card.to}>
              <h2>{card.title}</h2>
              <p>{card.description}</p>
            </Link>
          ))}
        </section>
      </main>
    </Layout>
  );
}

export default Home;

