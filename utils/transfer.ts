import { ApiPromise, WsProvider } from '@polkadot/api';
import keyring from '@polkadot/ui-keyring';
import { decodeAddress } from '@polkadot/util-crypto';

const wsProvider = new WsProvider('wss://private.chain.opentensor.ai');
// const wsProvider = new WsProvider('wss://test.finney.opentensor.ai:443');

export async function transfer(mnemonic: string, to: string, amount: string,keyring:any) {
    const api = await ApiPromise.create({ provider: wsProvider });
    const formattedAmount = BigInt(Math.floor(parseFloat(amount) * 1e9))
    
    const sender = keyring.createFromUri(mnemonic);
    const info = await api.tx.balances.transfer(to, (formattedAmount)).paymentInfo(sender);
    
    console.log(`
    class=${info.class.toString()},
    weight=${info.weight.toString()},
    partialFee=${info.partialFee.toHuman()}
    `);
    const tx = await api.tx.balances.transfer(to, formattedAmount).signAndSend(sender)
    console.log(tx.toHuman())
    return tx
}

export async function getBalance(address: string) {
    const api = await ApiPromise.create({ provider: wsProvider });
    const balance:any = await (await api.query.system.account(address)).toHuman()

    const formattedBalance = Number(balance?.data?.free?.replace(/,/g, ''))/1e9
    return formattedBalance??0
}

export function isValidAddress(address: string): boolean {
    try {
        decodeAddress(address);
        return true;
    } catch (error) {
        return false;
    }
}

// getBalance("5DWMXCHd97EQ4uTFjaokioT9UqceimahyDmHJ3w9MMLuTEkv")