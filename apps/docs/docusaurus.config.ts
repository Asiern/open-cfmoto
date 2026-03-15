import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'open-cfmoto Docs',
  tagline: 'Reverse engineering findings and package documentation',
  favicon: 'img/logo.svg',

  future: {
    v4: true,
  },

  url: 'https://open-cfmoto.dev',
  baseUrl: '/',

  organizationName: 'open-cfmoto',
  projectName: 'open-cfmoto',

  onBrokenLinks: 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          id: 'packages',
          path: 'docs/packages',
          routeBasePath: 'packages',
          sidebarPath: './sidebars.packages.ts',
          editUrl: 'https://github.com/open-cfmoto/open-cfmoto/tree/main/apps/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'findings',
        path: '../../tools/apk-analysis/findings',
        routeBasePath: 'findings',
        sidebarPath: './sidebars.findings.ts',
        editUrl: 'https://github.com/open-cfmoto/open-cfmoto/tree/main/tools/apk-analysis/findings/',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'project',
        path: '../../docs',
        routeBasePath: 'project',
        sidebarPath: './sidebars.project.ts',
        editUrl: 'https://github.com/open-cfmoto/open-cfmoto/tree/main/docs/',
      },
    ],
  ],

  themeConfig: {
    image: 'img/logo.svg',
    navbar: {
      title: 'open-cfmoto',
      logo: {
        alt: 'open-cfmoto logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'packagesSidebar',
          docsPluginId: 'packages',
          position: 'left',
          label: 'Packages',
        },
        {
          type: 'docSidebar',
          sidebarId: 'findingsSidebar',
          docsPluginId: 'findings',
          position: 'left',
          label: 'Findings',
        },
        {
          type: 'docSidebar',
          sidebarId: 'projectSidebar',
          docsPluginId: 'project',
          position: 'left',
          label: 'Project',
        },
        {
          href: 'https://github.com/open-cfmoto/open-cfmoto',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Packages', to: '/packages' },
            { label: 'Reverse Engineering Findings', to: '/findings/ble-protocol' },
            { label: 'Project Notes', to: '/project/protocol' },
          ],
        },
        {
          title: 'Community',
          items: [{ label: 'GitHub', href: 'https://github.com/open-cfmoto/open-cfmoto' }],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} open-cfmoto`,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
