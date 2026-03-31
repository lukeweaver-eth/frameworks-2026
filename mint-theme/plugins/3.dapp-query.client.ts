import { createQueryClient } from '@1001-digital/dapp-query-core'
import { idbCache } from '@1001-digital/dapp-query-core'
import { dappQueryPlugin } from '@1001-digital/dapp-query-vue'
import { createQueries, type MintQueries } from '@base/queries'
import type { QueryClient } from '@1001-digital/dapp-query-core'

export default defineNuxtPlugin((nuxtApp) => {
  const config = nuxtApp.$config.public

  // Chain-scoped cache key avoids stale mainnet data (factory 0xd717)
  // bleeding into this Sepolia deployment via shared IndexedDB.
  const cacheKey = `mint-query-${config.chainId}`

  const queryClient = createQueryClient({
    cache: idbCache(cacheKey),
    defaultStaleTime: 60_000,
  })

  const endpoints = config.indexerEndpoints
    ? String(config.indexerEndpoints).split(/\s+/).filter(Boolean)
    : []

  const queries = createQueries({
    wagmi: nuxtApp.$wagmi as any,
    chainId: Number(config.chainId),
    factory: config.factoryAddress as `0x${string}`,
    endpoints,
  })

  nuxtApp.vueApp.use(dappQueryPlugin, queryClient)

  return {
    provide: {
      queryClient,
      queries,
    },
  }
})

declare module '#app' {
  interface NuxtApp {
    $queryClient: QueryClient
    $queries: MintQueries
  }
}
