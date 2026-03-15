import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  packagesSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Package Docs',
      items: ['ble-protocol', 'cloud-client', 'mobile-app'],
    },
  ],
};

export default sidebars;

