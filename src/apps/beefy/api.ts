import got from '../../utils/got'
import { Address } from 'viem'
import { NetworkId } from '../../types/networkId'
import { LRUCache } from 'lru-cache'

export type BeefyVault = {
  id: string
  name: string
  type: string // cowcentrated, gov
  subType?: string
  token: string
  tokenAddress: Address | undefined
  tokenDecimals: number
  tokenProviderId: string
  earnedToken: string
  earnContractAddress: Address
  status: string
  platformId: string
  assets: string[]
  // risks can be an array of strings or undefined/null
  risks?: string[]
  strategyTypeId: string
  network: string
  chain: string
  zaps: any[]
  isGovVault: boolean
  oracle: string
  oracleId: string
  createdAt: number
}

export type BaseBeefyVault = BeefyVault & {
  earnedTokenAddress: Address
  depositTokenAddresses: string[]
  strategy: Address
  pricePerFullShare: string
}

export type GovVault = BeefyVault & {
  type: 'gov'
  isGovVault: true
  earnedTokenAddress: Address[]
}

type BeefyData = Record<string, number | undefined>

type BeefyPrices = BeefyData

type BeefyTvls = BeefyData

type BeefyApyBreakdown = Record<string, Record<string, number> | undefined>

export const NETWORK_ID_TO_BEEFY_BLOCKCHAIN_ID: Record<
  NetworkId,
  string | null
> = {
  [NetworkId['celo-mainnet']]: 'celo',
  [NetworkId['ethereum-mainnet']]: 'ethereum',
  [NetworkId['arbitrum-one']]: 'arbitrum',
  [NetworkId['op-mainnet']]: 'optimism',
  [NetworkId['polygon-pos-mainnet']]: 'polygon',
  [NetworkId['base-mainnet']]: 'base',
  [NetworkId['celo-alfajores']]: null,
  [NetworkId['ethereum-sepolia']]: null,
  [NetworkId['arbitrum-sepolia']]: null,
  [NetworkId['op-sepolia']]: null,
  [NetworkId['polygon-pos-amoy']]: null,
  [NetworkId['base-sepolia']]: null,
}

const NETWORK_ID_TO_CHAIN_ID: {
  [networkId in NetworkId]: number
} = {
  [NetworkId['ethereum-mainnet']]: 1,
  [NetworkId['arbitrum-one']]: 42161,
  [NetworkId['op-mainnet']]: 10,
  [NetworkId['celo-mainnet']]: 42220,
  [NetworkId['polygon-pos-mainnet']]: 137,
  [NetworkId['base-mainnet']]: 8453,
  [NetworkId['ethereum-sepolia']]: 11155111,
  [NetworkId['arbitrum-sepolia']]: 421614,
  [NetworkId['op-sepolia']]: 11155420,
  [NetworkId['celo-alfajores']]: 44787,
  [NetworkId['polygon-pos-amoy']]: 80002,
  [NetworkId['base-sepolia']]: 84532,
}

const CACHE_CONFIG = {
  max: 20,
  ttl: 5 * 1000, // 5 seconds
  allowStale: true, // allow stale-while-revalidate behavior
} as const

// Cache used for non-parametrized endpoints
const urlCache = new LRUCache({
  ...CACHE_CONFIG,
  fetchMethod: async (url: string) => {
    return got.get(url).json()
  },
})

const vaultsCache = new LRUCache<
  NetworkId,
  { vaults: BaseBeefyVault[]; govVaults: GovVault[] }
>({
  ...CACHE_CONFIG,
  fetchMethod: async (networkId: NetworkId) => {
    const [vaults, govVaults] = await Promise.all([
      got
        .get(
          `https://api.beefy.finance/harvestable-vaults/${NETWORK_ID_TO_BEEFY_BLOCKCHAIN_ID[networkId]}`,
        )
        .json<BaseBeefyVault[]>(),
      got
        .get(
          `https://api.beefy.finance/gov-vaults/${NETWORK_ID_TO_BEEFY_BLOCKCHAIN_ID[networkId]}`,
        )
        .json<GovVault[]>(),
    ])

    return {
      vaults,
      govVaults,
    }
  },
})

const pricesCache = new LRUCache<NetworkId, BeefyData>({
  ...CACHE_CONFIG,
  fetchMethod: async (networkId: NetworkId): Promise<BeefyData> => {
    const [lpsPrices, tokenPrices, tokens] = await Promise.all([
      got.get(`https://api.beefy.finance/lps`).json<BeefyData>(),
      got.get(`https://api.beefy.finance/prices`).json<BeefyData>(),
      got
        .get(
          `https://api.beefy.finance/tokens/${NETWORK_ID_TO_BEEFY_BLOCKCHAIN_ID[networkId]}`,
        )
        .json<
          Record<
            string, // oracleId
            {
              // These are the fields we need, but there are more
              address: string
              oracle: string // examples: 'lps', 'tokens'
              oracleId: string
            }
          >
        >(),
    ])

    // Combine lps prices with token prices
    return {
      ...lpsPrices,
      ...Object.fromEntries(
        Object.entries(tokens)
          .filter(([, { oracle }]) => oracle === 'tokens')
          .map(([, { address, oracleId }]) => [
            address.toLowerCase(),
            tokenPrices[oracleId],
          ]),
      ),
    }
  },
})

export async function getApyBreakdown(): Promise<BeefyApyBreakdown> {
  const apyBreakdown = (await urlCache.fetch(
    'https://api.beefy.finance/apy/breakdown/',
  )) as BeefyApyBreakdown | undefined
  if (!apyBreakdown) {
    throw new Error('Failed to fetch APY breakdown data')
  }
  return apyBreakdown
}

export async function getTvls(networkId: NetworkId): Promise<BeefyTvls> {
  const tvlResponse = (await urlCache.fetch(
    'https://api.beefy.finance/tvl/',
  )) as Record<number, BeefyTvls> | undefined
  if (!tvlResponse) {
    throw new Error('Failed to fetch TVL data')
  }
  return tvlResponse[NETWORK_ID_TO_CHAIN_ID[networkId]] ?? {}
}

export async function getBeefyVaults(
  networkId: NetworkId,
): Promise<{ vaults: BaseBeefyVault[]; govVaults: GovVault[] }> {
  const result = await vaultsCache.fetch(networkId)

  if (!result) {
    throw new Error('Failed to fetch vaults data')
  }

  return result
}

export async function getBeefyPrices(
  networkId: NetworkId,
): Promise<BeefyPrices> {
  const prices = await pricesCache.fetch(networkId)
  if (!prices) {
    throw new Error('Failed to fetch prices data')
  }
  return prices
}
