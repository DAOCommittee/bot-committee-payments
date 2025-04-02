import { fetch } from 'undici'
import * as ethers from 'ethers'
import Safe from '@safe-global/protocol-kit'
import SafeApiKit from '@safe-global/api-kit'
import { MetaTransactionData, OperationType } from '@safe-global/safe-core-sdk-types'
import 'dotenv/config'
import abi from './abi'
import BigNumber from 'bignumber.js'

const contract = new ethers.Contract('0xA1c57f48F0Deb89f569dFbE6E2B7f46D33606fD4', abi)

const councilAddresses = [
  '0x3f6b1d01b6823ab235fc343069b62b6472774cd1', // MetaRyuk
  '0xd6eFf8F07cAF3443A1178407d3de4129149D6eF6', // Canessa
  '0x02e11F84C4c0b412977c2eD3D00fAc1f28EADC11', // Fehz
  '0x8DD060AD7f867ad890490fd87657c1b7e63C622f', // Agus
  '0xb0145Ae156D201d6E371d07265FE3C045071c967' // Maraoz
]

const paymentInUSD = BigNumber(1000)

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC!)
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider)
  const safeService = new SafeApiKit({ chainId: BigInt(137) })

  const safe = await Safe.init({
    provider: process.env.RPC!,
    signer: process.env.PRIVATE_KEY!,
    safeAddress: process.env.SAFE_ADDRESS!
  })

  const manaPrice = await getMANAPrice()

  const paymentInMANA = paymentInUSD.dividedBy(BigNumber(manaPrice))

  const safeTransactionData: MetaTransactionData[] = await Promise.all(
    councilAddresses.map(async (address) => await transferTransactionData(address, paymentInMANA))
  )

  const nonce = await safe.getNonce()

  const safeTransaction = await safe.createTransaction({
    transactions: safeTransactionData,
    options: { nonce },
    onlyCalls: true
  })

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

  tx = await (contract as any).transfer.populateTransaction(address, toWei(amount))

  const data: MetaTransactionData = { data: tx.data, to: tx.to, value: '0', operation: OperationType.Call }
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
