import { fetch } from 'undici'
import * as ethers from 'ethers'
import Safe, { EthersAdapter } from '@safe-global/protocol-kit'
import SafeApiKit from '@safe-global/api-kit'
import { MetaTransactionData } from '@safe-global/safe-core-sdk-types'
import 'dotenv/config'
import abi from './abi'
import BigNumber from 'bignumber.js'

const contract = new ethers.Contract('0xFEC09d5C192aaf7Ec7E2C89Cc8D3224138391B2E', abi)

const committeeAddresses = [
  '0x521b0fef9cdcf250abaf8e7bc798cbe13fa98692', // Kyllian
  '0x0E7C2D47D79D4026472F4f942c4947937dAa94a8' // Tobik
]

const DAOMultiSig = '0x89214c8Ca9A49E60a3bfa8e00544F384C93719b1'

const paymentInUSD = BigNumber(2400)

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC!)
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider)
  const ethAdapterSigner = new EthersAdapter({ ethers, signerOrProvider: signer })
  const txServiceUrl = 'https://safe-transaction-polygon.safe.global/'
  const safeService = new SafeApiKit({ txServiceUrl, ethAdapter: ethAdapterSigner })
  const safe = await Safe.create({ ethAdapter: ethAdapterSigner, safeAddress: process.env.SAFE_ADDRESS! })

  const manaPrice = await getMANAPrice()

  const paymentInMANA = paymentInUSD.dividedBy(BigNumber(manaPrice))

  const safeTransactionData: MetaTransactionData[] = await Promise.all(
    committeeAddresses.map(async (address) => await transferTransactionData(address, paymentInMANA))
  )
  console.log(safeTransactionData)

  const safeTransaction = await safe.createTransaction({ safeTransactionData })
  const safeTxHash = await safe.getTransactionHash(safeTransaction)
  const senderSignature = await safe.signTransactionHash(safeTxHash)
  /* await safeService.proposeTransaction({
    safeAddress: process.env.SAFE_ADDRESS!,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress: signer.address,
    senderSignature: senderSignature.data
  }) */
}

void main()

async function transferTransactionData(address: string, amount: BigNumber): Promise<MetaTransactionData> {
  let tx = { data: '', to: '' }
  tx = await (contract as any).populateTransaction['transferFrom'](DAOMultiSig, address, toWei(amount))

  const data: MetaTransactionData = { data: tx.data, to: tx.to, value: '0' }
  return data
}

async function getMANAPrice(): Promise<number> {
  const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=decentraland&vs_currencies=usd')
  const json = (await res.json()) as CoinGeckoResponse
  return json.decentraland.usd
}

function toWei(amount: BigNumber): string {
  return amount.multipliedBy(BigNumber(10).pow(18)).toString()
}

interface CoinGeckoResponse {
  decentraland: { usd: number }
}