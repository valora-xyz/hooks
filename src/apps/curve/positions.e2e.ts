import hook from './positions'
import { NetworkId } from '../../types/networkId'
import { t } from '../../../test/i18next'

// TODO: Re-enable when migrated to Alchemy
// eslint-disable-next-line jest/no-disabled-tests -- disabled temporarily because the api is returning errors
describe.skip.each([
  NetworkId['ethereum-mainnet'],
  NetworkId['celo-mainnet'],
  NetworkId['arbitrum-one'],
])('getPositionDefinitions for networkId %s', (networkId) => {
  it('should get the address definitions successfully', async () => {
    const positions = await hook.getPositionDefinitions({
      networkId,
      address: '0x2b8441ef13333ffa955c9ea5ab5b3692da95260d',
      t,
    })
    // Simple check to make sure we got some definitions
    expect(positions.length).toBeGreaterThan(0)
  })

  it('should get definitions successfully when no address is provided', async () => {
    const positions = await hook.getPositionDefinitions({ networkId, t })
    // Simple check to make sure we got some definitions
    expect(positions.length).toBeGreaterThan(0)
  })
})
