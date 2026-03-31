import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const currentDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  extends: ['@visualizevalue/mint-app-base'],

  ssr: false,

  nitro: {
    preset: 'static',
  },

  alias: {
    '@base': '@visualizevalue/mint-app-base',
  },

  runtimeConfig: {
    public: {
      title: 'Frameworks',
      description: 'A spatial content structure tool for constructing compositions in 3D space.',
      platformUrl: 'https://mint.frameworks.art',
      chainId: 11155111,
      creatorAddress: '0xeE514bd06a8479e3E4771f03Cd01D2AF22aEb86D',
      rpc1: 'https://sepolia.infura.io/v3/e0257a7934fe49e79af76206d479e2bf',
      rpc2: 'https://ethereum-sepolia-rpc.publicnode.com',
      rpc3: 'https://sepolia.drpc.org',
      mainnetRpc1: 'https://eth.llamarpc.com',
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
