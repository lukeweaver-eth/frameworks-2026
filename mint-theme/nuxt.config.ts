import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const currentDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  extends: ['@visualizevalue/mint-app-base'],

  ssr: false,

  alias: {
    '@base': '@visualizevalue/mint-app-base',
  },

  runtimeConfig: {
    public: {
      title: 'Frameworks',
      description: 'A spatial content structure tool for constructing compositions in 3D space.',
      platformUrl: 'https://mint.frameworks.art',
      chainId: 1,
      creatorAddress: '0xeE514bd06a8479e3E4771f03Cd01D2AF22aEb86D',
    },
  },

  css: [
    join(currentDir, './assets/theme.css'),
  ],

  app: {
    head: {
      title: 'Frameworks',
      link: [{ rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' }],
    },
  },
})
