import { ApiPromise, WsProvider } from '@polkadot/api';
import keyring from '@polkadot/ui-keyring';
import { decodeAddress } from '@polkadot/util-crypto';

const wsProvider = new WsProvider('wss://private.chain.opentensor.ai');
// const wsProvider = new WsProvider('wss://test.finney.opentensor.ai:443');

export async function transfer(mnemonic: string, to: string, amount: string,keyring:any) {
    const formattedAmount = BigInt(parseFloat(amount).toFixed(9));

    const sender = keyring.createFromUri(mnemonic);
    const api = await ApiPromise.create({ provider: wsProvider });
    const info = await api.tx.balances.transfer(to, (formattedAmount)).paymentInfo(sender);
    
    console.log(`
    class=${info.class.toString()},
    weight=${info.weight.toString()},
    partialFee=${info.partialFee.toHuman()}
  `);
    await api.tx.balances.transfer(to, amount).signAndSend(sender, { nonce: -1 });
}
export function isValidAddress(address: string): boolean {
    try {
        decodeAddress(address);
        return true;
    } catch (error) {
        return false;
    }
}
