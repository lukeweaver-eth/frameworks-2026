import { createQueryClient } from '@1001-digital/dapp-query-core'
import { idbCache } from '@1001-digital/dapp-query-core'
import { dappQueryPlugin } from '@1001-digital/dapp-query-vue'
import { createQueries, type MintQueries } from '@base/queries'
import type { QueryClient } from '@1001-digital/dapp-query-core'

export default defineNuxtPlugin((nuxtApp) => {
  const config = nuxtApp.$config.public

  // Use a chain-scoped cache name to avoid stale mainnet data bleeding
  // into a Sepolia deployment (the base app uses 'mint-query' which
  // gets shared across all deployments in the same browser profile).
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
