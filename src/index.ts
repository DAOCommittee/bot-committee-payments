import { fetch } from 'undici'
import * as ethers from 'ethers'
import Safe, { PredictedSafeProps } from '@safe-global/protocol-kit'
import SafeApiKit from '@safe-global/api-kit'
import { MetaTransactionData } from '@safe-global/safe-core-sdk-types'
import 'dotenv/config'
import abi from './abi'
import BigNumber from 'bignumber.js'

const contract = new ethers.Contract('0xA1c57f48F0Deb89f569dFbE6E2B7f46D33606fD4', abi)

const committeeAddresses = [
  '0x521b0fef9cdcf250abaf8e7bc798cbe13fa98692', // Kyllian
  '0x0E7C2D47D79D4026472F4f942c4947937dAa94a8', // Tobik
  '0x2D83fFF2D4cE9F629bd636efCCff1662eb206fC4' // Rizk
]

const paymentInUSD = BigNumber(2400)

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC!)
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider)
  const txServiceUrl = 'https://safe-transaction-polygon.safe.global/'
  const safeService = new SafeApiKit({ txServiceUrl, chainId: BigInt(137) })
  const safe = await Safe.init({
    provider: process.env.RPC!,
    signer: process.env.PRIVATE_KEY!,
    safeAddress: process.env.SAFE_ADDRESS!
  })

  const manaPrice = await getMANAPrice()

  const paymentInMANA = paymentInUSD.dividedBy(BigNumber(manaPrice))

  const safeTransactionData: MetaTransactionData[] = await Promise.all(
    committeeAddresses.map(async (address) => await transferTransactionData(address, paymentInMANA))
  )
  console.log(safeTransactionData)

  const nonce = await safe.getNonce()
  const safeTransaction = await safe.createTransaction({ transactions: safeTransactionData, options: { nonce } })
  const safeTxHash = await safe.getTransactionHash(safeTransaction)
  const senderSignature = await safe.signHash(safeTxHash)
  await safeService.proposeTransaction({
    safeAddress: process.env.SAFE_ADDRESS!,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress: signer.address,
    senderSignature: senderSignature.data
  })
}

void main()

async function transferTransactionData(address: string, amount: BigNumber): Promise<MetaTransactionData> {
  let tx = { data: '', to: '' }
  tx = await (contract as any).populateTransaction['transfer'](address, toWei(amount))

  const data: MetaTransactionData = { data: tx.data, to: tx.to, value: '0' }
  return data
}

async function getMANAPrice(): Promise<number> {
  const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=decentraland&vs_currencies=usd')
  const json = (await res.json()) as CoinGeckoResponse
  return json.decentraland.usd
}

function toWei(amount: BigNumber): string {
  return amount.multipliedBy(BigNumber(10).pow(18)).toFixed(0)
}

interface CoinGeckoResponse {
  decentraland: { usd: number }
}
